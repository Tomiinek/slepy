/**
 * Scoring for the cap arrangement stage.
 *
 * Two numbers come out of it:
 *
 *  - A total error score, which says how badly the ordering is scrambled. This
 *    grades severity, and is directly comparable in spirit to the D-15's TES.
 *
 *  - A confusion angle, which says *which way* the mistakes point. This is the
 *    valuable one. Following Vingrys & King-Smith's moment analysis, each
 *    transposition contributes a vector in the chromaticity plane joining the two
 *    caps that got swapped. Someone who cannot tell red from green produces error
 *    vectors lying along the red-green direction; a tritan's lie along
 *    blue-yellow. Averaging those directions identifies the axis independently of
 *    the threshold staircases.
 *
 * Direction has to be averaged as an *axis*, not a heading: swapping caps A and B
 * is the same error as swapping B and A, so the vectors are sign-ambiguous.
 * Doubling the angles before averaging and halving afterwards handles that
 * correctly; a naive circular mean would cancel opposing vectors to nothing.
 */
import { ADAPT_Y, NEUTRAL_UV, confusionDirection } from '../color/confusion';
import { CVD_AXES, type CvdAxis } from '../color/lms';
import { linearFromSrgb } from '../color/srgb';
import { uvFromXyz, xyzFromLinear, type Uv } from '../color/xyz';
import { CAPS, CAP_COUNT, type Cap } from '../stimuli/caps';

export interface ArrangementResult {
  /** Sum of order jumps beyond the minimum. 0 is a perfect arrangement. */
  readonly totalErrorScore: number;
  /** Error score normalised so 0 is perfect and 1 is a random shuffle. */
  readonly normalisedError: number;
  /** Axis angle of the error vectors, in degrees, 0..180. Null if no errors. */
  readonly confusionAngle: number | null;
  /**
   * How consistently the errors point one way, 0..1. A genuine deficiency gives
   * a tight bundle; careless dragging gives a low value, and the classifier
   * should then not trust the angle.
   */
  readonly axisStrength: number;
  /** Best-matching deficiency axis, or null when there is nothing to match. */
  readonly matchedAxis: CvdAxis | null;
  /** Angular distance from the matched axis, in degrees. */
  readonly matchedAxisDelta: number | null;
  readonly order: readonly number[];
}

function capUv(cap: Cap): Uv {
  return uvFromXyz(xyzFromLinear(linearFromSrgb(cap.color)));
}

/** Axis angle in u'v' of each deficiency's confusion direction, in degrees. */
export function axisAngles(): Record<CvdAxis, number> {
  const out = {} as Record<CvdAxis, number>;
  for (const axis of CVD_AXES) {
    const d = confusionDirection(axis, NEUTRAL_UV, ADAPT_Y);
    out[axis] = normaliseAxisAngle((Math.atan2(d[1], d[0]) * 180) / Math.PI);
  }
  return out;
}

/**
 * `order` is the observer's arrangement, as cap indices in the sequence they
 * placed them. It must be a permutation of all caps.
 */
export function scoreArrangement(order: readonly number[]): ArrangementResult {
  const n = CAP_COUNT;

  // Order jumps. Adjacent caps in a correct arrangement differ by one step
  // around the circle, so anything larger is an error.
  let score = 0;
  for (let i = 0; i < order.length - 1; i++) {
    score += circularStep(order[i], order[i + 1], n) - 1;
  }

  // Error vectors, weighted by how big the jump was.
  let sumCos = 0;
  let sumSin = 0;
  let weightTotal = 0;

  for (let i = 0; i < order.length - 1; i++) {
    const jump = circularStep(order[i], order[i + 1], n);
    if (jump <= 1) continue;

    const a = capUv(CAPS[order[i]]);
    const b = capUv(CAPS[order[i + 1]]);
    const du = b[0] - a[0];
    const dv = b[1] - a[1];
    const len = Math.hypot(du, dv);
    if (len === 0) continue;

    const angle = Math.atan2(dv, du);
    const weight = (jump - 1) * len;
    sumCos += Math.cos(2 * angle) * weight;
    sumSin += Math.sin(2 * angle) * weight;
    weightTotal += weight;
  }

  const resultant = Math.hypot(sumCos, sumSin);
  const axisStrength = weightTotal > 0 ? resultant / weightTotal : 0;
  const confusionAngle =
    weightTotal > 0
      ? normaliseAxisAngle((Math.atan2(sumSin, sumCos) * 90) / Math.PI)
      : null;

  let matchedAxis: CvdAxis | null = null;
  let matchedAxisDelta: number | null = null;
  if (confusionAngle !== null) {
    const angles = axisAngles();
    for (const axis of CVD_AXES) {
      const delta = axisAngleDistance(confusionAngle, angles[axis]);
      if (matchedAxisDelta === null || delta < matchedAxisDelta) {
        matchedAxisDelta = delta;
        matchedAxis = axis;
      }
    }
  }

  return {
    totalErrorScore: score,
    normalisedError: Math.min(1, score / expectedRandomError(n)),
    confusionAngle,
    axisStrength,
    matchedAxis,
    matchedAxisDelta,
    order: order.slice(),
  };
}

/**
 * Mean error score of a uniformly random arrangement, used to normalise. For a
 * random permutation each adjacent pair's circular step averages about n/4, so
 * the whole sequence accumulates roughly (n - 1) * (n/4 - 1).
 */
function expectedRandomError(n: number): number {
  return (n - 1) * (n / 4 - 1);
}

/** Steps between two caps the short way round the hue circle. */
function circularStep(a: number, b: number, n: number): number {
  const d = Math.abs(a - b) % n;
  return Math.min(d, n - d);
}

function normaliseAxisAngle(deg: number): number {
  let a = deg % 180;
  if (a < 0) a += 180;
  return a;
}

/** Smallest angle between two axes (not headings), so at most 90 degrees. */
export function axisAngleDistance(a: number, b: number): number {
  const d = Math.abs(normaliseAxisAngle(a) - normaliseAxisAngle(b)) % 180;
  return Math.min(d, 180 - d);
}

/** A shuffled starting arrangement, with the anchor cap held in place. */
export function shuffledStart(
  rng: { shuffle<T>(items: readonly T[]): T[] },
  anchor = 0,
): number[] {
  const movable = CAPS.map((c) => c.index).filter((i) => i !== anchor);
  return [anchor, ...rng.shuffle(movable)];
}
