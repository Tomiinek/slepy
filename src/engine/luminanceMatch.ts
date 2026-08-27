/**
 * Heterochromatic brightness matching, the probe that separates protan from
 * deutan.
 *
 * Telling protanomaly from deuteranomaly is the hard part of this whole
 * assessment. Their confusion lines point in almost the same direction, so
 * chromatic thresholds alone give only a weak, noisy hint. But there is a second,
 * quite separate signature: protans are missing (or have shifted) the L cone,
 * which is the cone that contributes most of the luminance signal at long
 * wavelengths. Deep red therefore looks markedly *darker* to a protan, while a
 * deutan's luminous efficiency stays close to normal.
 *
 * So we simply ask the observer to make a red patch as bright as a neutral one.
 * A protan will wind the red up much further than anyone else.
 *
 * The prediction is not a fudge factor: perceived brightness of a colour is the
 * luminance of what that observer actually sees, which is precisely what the
 * simulation computes. Because everything is linear in luminance, the match
 * setting follows in closed form.
 */
import { simulateLinear, type Deficiency, type Vision } from '../color/cvd';
import { linearFromHex, relativeLuminance, type LinearRgb } from '../color/srgb';

/**
 * A deep, long-wavelength red at unit scale. Saturation matters: the more the
 * stimulus depends on L-cone excitation, the larger the protan/deutan
 * separation, so we go as far toward the red primary as sRGB allows.
 */
export const RED_PRIMARY: LinearRgb = linearFromHex('#ff0000');

const PROTANOPE: Deficiency = { axis: 'protan', severity: 1 };
const DEUTERANOPE: Deficiency = { axis: 'deutan', severity: 1 };

/**
 * Scale is a multiple of the red primary, so 1.0 is the brightest red the display
 * can produce and there is nothing above it. An earlier version allowed up to
 * 6.0, which silently clipped: the top 83% of the slider all rendered as
 * #ff0000.
 */
export const MAX_SCALE = 1.0;
export const MIN_SCALE = 0.08;

/**
 * Luminance of the neutral reference patch.
 *
 * This has to be derived rather than picked, and getting it wrong breaks the
 * probe in a way that is invisible from the code. The match setting is
 * REFERENCE_Y divided by the observer's perceived luminance of the red, so a
 * reference that is too bright pushes the required setting above the brightest
 * red the display can make -- and it does so *first* for protans, who perceive
 * red as darkest. That is precisely backwards: the one group this probe exists to
 * identify would be the one group unable to complete it, left pushing the slider
 * to the top while the red stayed visibly darker.
 *
 * So the reference is anchored to a full protanope's perceived red, with headroom
 * kept below the ceiling so even they settle inside the range rather than at its
 * edge.
 *
 * It was previously set equal to the adaptation grey, which had a second
 * consequence: the reference patch was rendered in exactly the same colour as the
 * surround and was therefore invisible. Observers saw one red square and nothing
 * to match it against.
 */
const CEILING_HEADROOM = 0.75;
export const REFERENCE_Y =
  relativeLuminance(simulateLinear(RED_PRIMARY, PROTANOPE)) * CEILING_HEADROOM;

/**
 * The scale factor at which this observer perceives the red patch as equal in
 * brightness to the neutral reference.
 */
export function predictedMatchScale(vision: Vision): number {
  const perceivedPerUnit = relativeLuminance(simulateLinear(RED_PRIMARY, vision));
  if (perceivedPerUnit <= 0) return MAX_SCALE;
  return REFERENCE_Y / perceivedPerUnit;
}

/** Displayed red for a given slider setting, in linear light. */
export function redAtScale(scale: number): LinearRgb {
  const s = clamp(scale, MIN_SCALE, MAX_SCALE);
  return [RED_PRIMARY[0] * s, RED_PRIMARY[1] * s, RED_PRIMARY[2] * s];
}

export interface LuminanceMatchResult {
  /** Geometric mean of the observer's settings. */
  readonly scale: number;
  readonly settings: readonly number[];
  /**
   * How far the setting sits along the line from a normal observer's predicted
   * match to a protanope's, in log space. 0 means normal or deutan-like, 1 means
   * fully protanopic. Values outside 0..1 are clamped for reporting but the raw
   * figure is kept so the classifier can see an implausible result.
   */
  readonly protanIndex: number;
  readonly rawProtanIndex: number;
  /** Spread across repeats, as a multiplicative factor. Large means unreliable. */
  readonly consistency: number;
}

export function interpretLuminanceMatch(settings: readonly number[]): LuminanceMatchResult {
  const usable = settings.filter((s) => Number.isFinite(s) && s > 0);
  const scale = usable.length ? geometricMean(usable) : predictedMatchScale(null);

  const normal = predictedMatchScale(null);
  const protan = predictedMatchScale(PROTANOPE);

  // Work in log space: the quantity is a ratio, and a factor-of-two error should
  // count the same whether it lands above or below.
  const span = Math.log(protan) - Math.log(normal);
  const raw = span === 0 ? 0 : (Math.log(scale) - Math.log(normal)) / span;

  return {
    scale,
    settings: usable,
    protanIndex: clamp(raw, 0, 1),
    rawProtanIndex: raw,
    consistency: usable.length > 1 ? Math.max(...usable) / Math.min(...usable) : 1,
  };
}

/**
 * Reference predictions, exposed for the report so it can show the observer
 * where their setting fell relative to each hypothesis.
 */
export function matchReferences(): { normal: number; protan: number; deutan: number } {
  return {
    normal: predictedMatchScale(null),
    protan: predictedMatchScale(PROTANOPE),
    deutan: predictedMatchScale(DEUTERANOPE),
  };
}

/**
 * Starting positions for the repeats. Alternating high and low starts cancels
 * the hysteresis in this kind of adjustment task: people tend to stop as soon as
 * the difference stops being obvious, which biases the setting toward wherever
 * they started from.
 *
 * The high starts have to sit above *every* plausible match, including a full
 * protanope's, which is the highest of them. They previously topped out at 0.7
 * while a protanope matches near 0.75 -- so protans, the group this probe exists
 * to identify, always approached from below and their hysteresis went
 * uncancelled, biasing them toward a lower setting and therefore toward looking
 * less protan than they are.
 */
export function startingScales(): number[] {
  return [MIN_SCALE * 1.5, MAX_SCALE * 0.95, MIN_SCALE * 2.5, MAX_SCALE * 0.85];
}

function geometricMean(values: readonly number[]): number {
  return Math.exp(values.reduce((a, v) => a + Math.log(v), 0) / values.length);
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
