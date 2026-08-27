/**
 * Synthetic observers, and a harness that runs them through the real test
 * engine.
 *
 * This is the part that makes the assessment trustworthy rather than merely
 * plausible-looking. A virtual protanope, deuteranomal, tritanope or normal
 * trichromat is constructed from the CVD model, driven through the actual plate
 * stage, staircases, luminance probe and arrangement stage, and the classifier's
 * output is compared against the vision it was built with. Nothing here
 * shortcuts the production code paths.
 *
 * Each observer decides whether it can see a stimulus by simulating both colours
 * through its own vision and comparing the perceptual difference against its own
 * discrimination criterion, with a Weibull psychometric function and the correct
 * chance floor for the task. That is a model of an observer, not of the answer,
 * so it can genuinely fail to reproduce the input if the engine is wrong.
 */
import { simulateSrgb, type Vision } from '../src/color/cvd';
import { deltaChromaOk, deltaEOk } from '../src/color/oklab';
import { CAPS } from '../src/stimuli/caps';
import { ORIENTATIONS, type Orientation } from '../src/stimuli/landolt';
import { plateColorSpec, plateDotColor, type PlateSpec } from '../src/stimuli/plate';
import { landoltMask } from '../src/stimuli/landolt';
import { buildPlateSet } from '../src/stimuli/plateSet';
import { ThresholdBlock } from '../src/engine/thresholdBlock';
import { scoreArrangement } from '../src/engine/arrangement';
import {
  interpretLuminanceMatch,
  predictedMatchScale,
} from '../src/engine/luminanceMatch';
import { summarisePlates, type PlateResponse } from '../src/engine/scoring/plates';
import { classify, type Assessment } from '../src/engine/classify';
import { makeRng, type Rng } from '../src/util/rng';
import { oklabFromSrgb } from '../src/color/oklab';

export interface ObserverSpec {
  readonly name: string;
  readonly vision: Vision;
  /**
   * Smallest perceptual difference (OKLab units) this observer can reliably
   * resolve. 0.012 is roughly a just-noticeable difference for patches of this
   * size, so it stands in for a normally-sighted person.
   */
  readonly criterion?: number;
  /** Probability of a lapse (blink, misclick) on any trial. */
  readonly lapseRate?: number;
  /** Extra sloppiness in the arrangement stage, in cap positions. */
  readonly arrangementNoise?: number;
}

const DEFAULT_CRITERION = 0.012;
const SLOPE = 3.2;

export class SyntheticObserver {
  readonly spec: ObserverSpec;
  private readonly rng: Rng;

  constructor(spec: ObserverSpec, seed: number) {
    this.spec = spec;
    this.rng = makeRng(seed);
  }

  private get criterion(): number {
    return this.spec.criterion ?? DEFAULT_CRITERION;
  }

  /**
   * How different two colours look to this observer.
   *
   * `chromaticOnly` models the masking that the plate's luminance noise
   * performs. It matters far more than it sounds: a confusion pair held at
   * constant normal-observer luminance still differs in brightness for the
   * affected observer, by as much as 0.022 in OKLab lightness for a protan --
   * comfortably above a just-noticeable difference. On a standard plate the
   * per-dot luminance jitter is many times larger than that residual, so the
   * cue is unusable and only chromatic information remains. An observer model
   * that ignored this would "see" figures a real observer cannot, and would
   * make a genuine dichromat look merely moderately affected.
   */
  perceivedDifference(
    a: readonly [number, number, number],
    b: readonly [number, number, number],
    chromaticOnly: boolean,
  ): number {
    const sa = oklabFromSrgb(simulateSrgb(a as [number, number, number], this.spec.vision));
    const sb = oklabFromSrgb(simulateSrgb(b as [number, number, number], this.spec.vision));
    return chromaticOnly ? deltaChromaOk(sa, sb) : deltaEOk(sa, sb);
  }

  /**
   * Probability of a correct response given the visible difference and the
   * number of response alternatives.
   */
  private pCorrect(difference: number, alternatives: number): number {
    const chance = 1 / alternatives;
    const detect = 1 - Math.exp(-Math.pow(difference / this.criterion, SLOPE));
    const lapse = this.spec.lapseRate ?? 0.02;
    return (chance + (1 - chance) * detect) * (1 - lapse) + chance * lapse;
  }

  /** Figure-versus-ground difference for a generated plate or Landolt C. */
  private figureContrast(spec: PlateSpec): number {
    const fixed = { lum: 1, decoy: 0, x: 0, y: 0, r: 4 };
    // Standard plates deliberately drown the luminance channel in noise, so only
    // chroma is available. Control and reverse plates carry the figure *in*
    // luminance and run with little or no noise, so lightness counts there.
    const chromaticOnly = spec.mode === 'standard';
    return this.perceivedDifference(
      plateDotColor(spec, { ...fixed, figure: true }),
      plateDotColor(spec, { ...fixed, figure: false }),
      chromaticOnly,
    );
  }

  readPlate(spec: PlateSpec): boolean {
    // Reading a two-digit numeral out of a dot mosaic is effectively unlimited
    // choice, so there is no meaningful chance floor: 40 alternatives is a stand
    // in for "you either see it or you do not".
    return this.rng.next() < this.pCorrect(this.figureContrast(spec), 40);
  }

  respondLandolt(spec: PlateSpec, actual: Orientation): Orientation {
    const correct = this.rng.next() < this.pCorrect(this.figureContrast(spec), 4);
    if (correct) return actual;
    const wrong = ORIENTATIONS.filter((o) => o !== actual);
    return this.rng.pick(wrong);
  }

  /** Brightness-match settings, with realistic scatter between repeats. */
  luminanceSettings(repeats: number): number[] {
    const ideal = predictedMatchScale(this.spec.vision);
    return Array.from({ length: repeats }, () =>
      ideal * Math.exp(this.rng.normal() * 0.11),
    );
  }

  /**
   * Arrange the caps by how they look to this observer. Caps that collapse
   * together get ordered arbitrarily, which is precisely the transposition
   * pattern the arrangement scorer looks for.
   */
  arrangeCaps(): number[] {
    const noise = this.spec.arrangementNoise ?? 0.06;
    const seen = CAPS.map((cap) => {
      const lab = oklabFromSrgb(simulateSrgb(cap.color, this.spec.vision));
      return {
        index: cap.index,
        // Their perceived hue angle, plus scatter proportional to how faint the
        // remaining chromatic signal is.
        key:
          Math.atan2(lab[2], lab[1]) +
          this.rng.normal() * noise / Math.max(0.02, Math.hypot(lab[1], lab[2])) * 0.05,
      };
    });

    const ordered = seen.sort((a, b) => a.key - b.key).map((s) => s.index);

    // Rotate so the anchor cap leads, matching how the UI presents it.
    const anchorAt = ordered.indexOf(0);
    return [...ordered.slice(anchorAt), ...ordered.slice(0, anchorAt)];
  }
}

export interface HarnessResult {
  readonly assessment: Assessment;
  readonly plateTrials: number;
  readonly thresholdTrials: number;
}

/** Run one synthetic observer through the entire assessment. */
export function runAssessment(spec: ObserverSpec, seed: number): HarnessResult {
  const observer = new SyntheticObserver(spec, seed);

  // ---- Plate stage, using the real plate set and colour pipeline ----
  // Dot geometry is deliberately skipped: whether a plate is readable depends
  // only on the figure/ground colours, and the packing has its own tests.
  const plateResponses: PlateResponse[] = buildPlateSet(seed).map((plan) => {
    const correct = observer.readPlate(plateColorSpec(plan));
    return {
      plan,
      response: correct ? plan.answer : null,
      correct,
      elapsedMs: 2600,
    };
  });

  // ---- Threshold stage, using the real interleaved staircases ----
  const block = new ThresholdBlock(seed);
  let guard = 0;
  while (!block.finished && guard++ < 500) {
    const trial = block.nextTrial();
    if (!trial) break;
    const landolt = plateColorSpec({
      mode: 'standard',
      axis: trial.axis,
      answer: trial.orientation,
      amplitudeFraction: 0,
      amplitude: trial.amplitude,
      seed: trial.seed,
      id: `t-${trial.index}`,
    });
    block.respondWithOrientation(observer.respondLandolt(landolt, trial.orientation));
  }

  const assessment = classify({
    thresholds: block.results(),
    plates: summarisePlates(plateResponses),
    luminance: interpretLuminanceMatch(observer.luminanceSettings(4)),
    arrangement: scoreArrangement(observer.arrangeCaps()),
  });

  return {
    assessment,
    plateTrials: plateResponses.length,
    thresholdTrials: block.trialCount,
  };
}

/** Majority verdict across several seeds, since any single run is noisy. */
export function runRepeated(spec: ObserverSpec, seeds: readonly number[]) {
  const runs = seeds.map((seed) => runAssessment(spec, seed).assessment);
  const tally = <T extends string | null>(values: readonly T[]) => {
    const counts = new Map<T, number>();
    for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  };

  return {
    runs,
    verdict: tally(runs.map((r) => r.verdict)),
    axis: tally(runs.map((r) => r.axis)),
    meanSeverity: runs.reduce((a, r) => a + r.severity, 0) / runs.length,
    axisAgreement:
      runs.filter((r) => r.axis === tally(runs.map((x) => x.axis))).length / runs.length,
  };
}

export { landoltMask };
