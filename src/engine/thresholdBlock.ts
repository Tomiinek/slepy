/**
 * The threshold stage: three staircases, one per confusion axis, interleaved.
 *
 * Interleaving matters for two reasons. Chromatic adaptation drifts if you
 * hammer one axis for two minutes straight, which would bias that axis relative
 * to the others -- and the classifier's main signal is precisely the *ratio*
 * between axes. It also stops the observer from noticing "these are all the
 * pinkish ones" and adopting an axis-specific strategy.
 */
import {
  ADAPT_Y,
  NEUTRAL_UV,
  quantisationFloor,
  symmetricGamutLimit,
} from '../color/confusion';
import { CVD_AXES, type CvdAxis } from '../color/lms';
import { ORIENTATIONS, type Orientation } from '../stimuli/landolt';
import { makeRng, type Rng } from '../util/rng';
import { Staircase, type StaircaseResult } from './staircase';

export interface ThresholdTrialRequest {
  readonly axis: CvdAxis;
  readonly amplitude: number;
  readonly orientation: Orientation;
  readonly seed: number;
  readonly index: number;
}

export type AxisThresholds = Record<CvdAxis, StaircaseResult>;

/** Per-axis display limits, kept so the report can explain a clipped result. */
export interface AxisLimits {
  readonly floor: number;
  readonly ceiling: number;
}

export function axisLimits(axis: CvdAxis): AxisLimits {
  const ceiling = symmetricGamutLimit(axis, NEUTRAL_UV, ADAPT_Y) * 0.94;
  const floor = quantisationFloor(axis, NEUTRAL_UV, ADAPT_Y);
  return { floor, ceiling };
}

export class ThresholdBlock {
  private readonly staircases: Record<CvdAxis, Staircase>;
  private readonly limits: Record<CvdAxis, AxisLimits>;
  private readonly rng: Rng;
  private current: ThresholdTrialRequest | null = null;
  private index = 0;
  private lastAxis: CvdAxis | null = null;
  private activeAxisCount = CVD_AXES.length;

  constructor(seed: number) {
    this.rng = makeRng(seed ^ 0x7a1c);
    this.limits = {} as Record<CvdAxis, AxisLimits>;
    this.staircases = {} as Record<CvdAxis, Staircase>;

    for (const axis of CVD_AXES) {
      const limits = axisLimits(axis);
      this.limits[axis] = limits;
      this.staircases[axis] = new Staircase({
        // Start well above a typical threshold but below the gamut edge, so a
        // normal observer gets an easy first trial and understands the task,
        // while a dichromat is not immediately pinned at the ceiling.
        start: limits.ceiling * 0.55,
        floor: limits.floor,
        ceiling: limits.ceiling,
      });
    }
  }

  get finished(): boolean {
    return CVD_AXES.every((axis) => this.staircases[axis].finished);
  }

  get progress(): number {
    const total = CVD_AXES.reduce((sum, axis) => sum + this.staircases[axis].progress, 0);
    return total / CVD_AXES.length;
  }

  get trialCount(): number {
    return this.index;
  }

  /** How many staircases were still running when the last trial was chosen. */
  get axesStillRunning(): number {
    return this.activeAxisCount;
  }

  /** Rough remaining trials, for a progress bar that does not lie too badly. */
  get estimatedRemaining(): number {
    return CVD_AXES.reduce((sum, axis) => {
      const s = this.staircases[axis];
      return sum + (s.finished ? 0 : Math.max(3, Math.round(22 * (1 - s.progress))));
    }, 0);
  }

  nextTrial(): ThresholdTrialRequest | null {
    if (this.current) return this.current;

    const pending = CVD_AXES.filter((axis) => !this.staircases[axis].finished);
    if (pending.length === 0) return null;

    // Weight selection toward the axis with the fewest trials so the three
    // staircases finish at roughly the same time; a purely random pick leaves
    // one axis running alone at the end, by which point adaptation has drifted.
    const leastTrials = Math.min(...pending.map((a) => this.staircases[a].trialCount));
    const balanced = pending.filter((a) => this.staircases[a].trialCount <= leastTrials + 1);

    // Avoid repeating an axis back to back where there is any alternative. Long
    // runs on one axis let chromatic adaptation drift toward that direction,
    // which would lower its apparent threshold relative to the others.
    const fresh = balanced.filter((a) => a !== this.lastAxis);
    const axis = this.rng.pick(fresh.length > 0 ? fresh : balanced);
    this.lastAxis = axis;
    this.activeAxisCount = pending.length;

    this.current = {
      axis,
      amplitude: this.staircases[axis].next(),
      orientation: this.rng.pick(ORIENTATIONS),
      seed: (this.rng.int(0xffffff) ^ (this.index * 2654435761)) >>> 0,
      index: this.index,
    };
    return this.current;
  }

  respond(correct: boolean): void {
    if (!this.current) return;
    this.staircases[this.current.axis].respond(correct);
    this.current = null;
    this.index++;
  }

  /** Responding with the observer's chosen orientation rather than a boolean. */
  respondWithOrientation(chosen: Orientation): boolean {
    const correct = this.current?.orientation === chosen;
    this.respond(correct);
    return correct;
  }

  results(): AxisThresholds {
    const out = {} as AxisThresholds;
    for (const axis of CVD_AXES) out[axis] = this.staircases[axis].result();
    return out;
  }

  displayLimits(): Record<CvdAxis, AxisLimits> {
    return this.limits;
  }
}
