/**
 * Adaptive threshold estimation by a transformed up/down staircase.
 *
 * The rule is 2-down / 1-up: two consecutive correct responses make the stimulus
 * harder, one mistake makes it easier. For a 4-alternative task this converges on
 * the stimulus level giving roughly 70.7% correct, comfortably above the 25%
 * chance floor, and it needs far fewer trials than measuring a whole
 * psychometric function.
 *
 * Steps are multiplicative, because chromatic discrimination is roughly
 * scale-invariant: halving the amplitude is a constant perceptual step whether
 * you start large or small. Step size shrinks as reversals accumulate, so early
 * trials home in fast and later trials refine. The threshold is the geometric
 * mean of the last few reversals, discarding the coarse-step ones.
 */

export interface StaircaseConfig {
  readonly start: number;
  /** Hard display limits. Amplitude is never requested outside these. */
  readonly floor: number;
  readonly ceiling: number;
  /** Multiplicative step per phase, applied as the reversal count grows. */
  readonly steps?: readonly number[];
  readonly targetReversals?: number;
  readonly maxTrials?: number;
  /** Reversals averaged for the final estimate. Must be even to avoid bias. */
  readonly averagedReversals?: number;
}

export interface StaircaseTrial {
  readonly amplitude: number;
  readonly correct: boolean;
  /** True if the request had to be clipped to a display limit. */
  readonly clippedAtCeiling: boolean;
  readonly clippedAtFloor: boolean;
}

export type StaircaseOutcome =
  /** A real threshold was bracketed. */
  | 'measured'
  /** Failed even at the largest colour the display can make. */
  | 'exceeds-display'
  /** Still correct at the smallest renderable step: better than measurable. */
  | 'below-display'
  /** Ran out of trials without settling. */
  | 'inconclusive';

export interface StaircaseResult {
  readonly threshold: number;
  readonly outcome: StaircaseOutcome;
  readonly reversals: readonly number[];
  readonly trials: readonly StaircaseTrial[];
  /** Spread of the averaged reversals, as a multiplicative factor. */
  readonly precision: number;
}

const DEFAULT_STEPS = [2.0, 1.5, 1.25] as const;

export class Staircase {
  private readonly cfg: Required<StaircaseConfig>;
  private amplitude: number;
  private correctRun = 0;
  private direction: 'up' | 'down' | null = null;
  private readonly reversalLevels: number[] = [];
  private readonly history: StaircaseTrial[] = [];
  private ceilingMisses = 0;
  private floorHits = 0;
  private done = false;

  constructor(config: StaircaseConfig) {
    this.cfg = {
      steps: DEFAULT_STEPS,
      targetReversals: 8,
      maxTrials: 34,
      averagedReversals: 6,
      ...config,
    };
    this.amplitude = clamp(config.start, config.floor, config.ceiling);
  }

  get finished(): boolean {
    return this.done;
  }

  get trialCount(): number {
    return this.history.length;
  }

  /** Amplitude for the next trial, already clipped to what the display can do. */
  next(): number {
    return clamp(this.amplitude, this.cfg.floor, this.cfg.ceiling);
  }

  /** Fraction of the way to termination, for the progress indicator. */
  get progress(): number {
    const byReversals = this.reversalLevels.length / this.cfg.targetReversals;
    const byTrials = this.history.length / this.cfg.maxTrials;
    return Math.min(1, Math.max(byReversals, byTrials));
  }

  respond(correct: boolean): void {
    if (this.done) return;

    const presented = this.next();
    const atCeiling = presented >= this.cfg.ceiling * (1 - 1e-9);
    const atFloor = presented <= this.cfg.floor * (1 + 1e-9);

    this.history.push({
      amplitude: presented,
      correct,
      clippedAtCeiling: atCeiling,
      clippedAtFloor: atFloor,
    });

    // Track the two ways a staircase can run off the end of the display's
    // ability rather than the observer's. Both are reported honestly instead of
    // being silently folded into a number.
    if (atCeiling && !correct) this.ceilingMisses++;
    if (atFloor && correct) this.floorHits++;

    const step = this.currentStep();
    let moved: 'up' | 'down' | null = null;

    if (!correct) {
      this.amplitude = presented * step;
      this.correctRun = 0;
      moved = 'up';
    } else {
      this.correctRun++;
      if (this.correctRun >= 2) {
        this.amplitude = presented / step;
        this.correctRun = 0;
        moved = 'down';
      }
    }

    if (moved) {
      if (this.direction && this.direction !== moved) {
        this.reversalLevels.push(presented);
      }
      this.direction = moved;
    }

    this.amplitude = clamp(this.amplitude, this.cfg.floor, this.cfg.ceiling);

    if (
      this.reversalLevels.length >= this.cfg.targetReversals ||
      this.history.length >= this.cfg.maxTrials ||
      this.ceilingMisses >= 4 ||
      this.floorHits >= 6
    ) {
      this.done = true;
    }
  }

  /**
   * Steps get finer as the staircase settles. The first two reversals are made
   * with the coarse step purely to get into the right region quickly, and are
   * excluded from the final average.
   */
  private currentStep(): number {
    const phase = Math.min(
      this.cfg.steps.length - 1,
      Math.floor(this.reversalLevels.length / 2),
    );
    return this.cfg.steps[phase];
  }

  result(): StaircaseResult {
    if (this.ceilingMisses >= 4) {
      return {
        threshold: this.cfg.ceiling,
        outcome: 'exceeds-display',
        reversals: this.reversalLevels,
        trials: this.history,
        precision: Infinity,
      };
    }

    if (this.floorHits >= 6) {
      return {
        threshold: this.cfg.floor,
        outcome: 'below-display',
        reversals: this.reversalLevels,
        trials: this.history,
        precision: 1,
      };
    }

    // Drop the coarse-step reversals, then average an even number of the rest so
    // upward and downward reversals are equally represented.
    const usable = this.reversalLevels.slice(2);
    const take = Math.min(this.cfg.averagedReversals, usable.length - (usable.length % 2));

    if (take < 2) {
      return {
        threshold: geometricMean(this.reversalLevels.length ? this.reversalLevels : [this.amplitude]),
        outcome: 'inconclusive',
        reversals: this.reversalLevels,
        trials: this.history,
        precision: Infinity,
      };
    }

    const averaged = usable.slice(-take);
    return {
      threshold: geometricMean(averaged),
      outcome: 'measured',
      reversals: this.reversalLevels,
      trials: this.history,
      precision: Math.max(...averaged) / Math.min(...averaged),
    };
  }
}

function geometricMean(values: readonly number[]): number {
  const sum = values.reduce((acc, v) => acc + Math.log(Math.max(v, 1e-12)), 0);
  return Math.exp(sum / values.length);
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
