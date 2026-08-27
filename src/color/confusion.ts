/**
 * Confusion lines: the sets of colors a given dichromat cannot tell apart.
 *
 * Under the reduction hypothesis, a protanope's vision collapses every color
 * that differs only in L-cone excitation, a deuteranope's only in M, a
 * tritanope's only in S. So in the 3D LMS space a confusion line is simply a
 * line parallel to the missing cone's axis.
 *
 * Both CIE xy and CIE 1976 u'v' are projective transforms of XYZ, and projective
 * transforms map straight lines to straight lines. That means a confusion line
 * is also perfectly straight in the u'v' chromaticity plane -- so a single
 * direction vector describes it exactly, at any amplitude, with no
 * approximation. We obtain that direction by differentiating the u'v' image of
 * the LMS confusion line at the background point.
 *
 * Deriving directions this way, rather than from tabulated copunctal points,
 * guarantees the stimuli we generate are exactly consistent with the simulation
 * in `cvd.ts`, since both are driven by the same cone fundamentals. (The
 * published copunctal points are used as a sanity check in the test suite.)
 */
import { CONE_INDEX, linearFromLms, lmsFromLinear, type CvdAxis } from './lms';
import {
  hexFromSrgb,
  inGamut,
  linearFromSrgb,
  srgbFromLinear,
  type Srgb,
} from './srgb';
import {
  uvFromXyz,
  xyzFromLinear,
  xyzFromUv,
  linearFromXyz,
  uvDistance,
  type Uv,
} from './xyz';
import { desaturateIntoGamut, maxAmplitudeInGamut } from './gamut';

export type Uv2 = readonly [number, number];

/**
 * Unit vector in the u'v' plane along which colors become indistinguishable for
 * the given deficiency, evaluated at a background chromaticity and luminance.
 *
 * The sign is normalised so the vector points toward increasing excitation of
 * the affected cone, which keeps stimulus polarity consistent between trials.
 */
export function confusionDirection(axis: CvdAxis, backgroundUv: Uv, Y: number): Uv2 {
  // Cached without Y in the key on purpose. Chromaticity is a projective
  // function of XYZ, so scaling a colour's luminance leaves its u'v' unchanged;
  // the perturbation step below is likewise relative to the cone excitation, so
  // it scales with it. The direction therefore depends only on the background
  // *chromaticity*, not on how bright it is. This matters because the plate
  // renderer asks for a direction once per dot per frame at a different
  // luminance each time, and recomputing it there dominated the frame budget.
  const key = `${axis}|${backgroundUv[0]}|${backgroundUv[1]}`;
  const cached = directionCache.get(key);
  if (cached) return cached;

  const computed = computeConfusionDirection(axis, backgroundUv, Y);
  directionCache.set(key, computed);
  return computed;
}

const directionCache = new Map<string, Uv2>();

function computeConfusionDirection(axis: CvdAxis, backgroundUv: Uv, Y: number): Uv2 {
  const xyz = xyzFromUv(backgroundUv, Y);
  const lms = lmsFromLinear(linearFromXyz(xyz));
  const i = CONE_INDEX[axis];

  // Central difference on the cone axis. The step is relative to the cone
  // excitation itself so it stays well-conditioned for S, which is ~50x smaller
  // than L and M under Smith-Pokorny scaling.
  const h = Math.max(Math.abs(lms[i]), 1e-4) * 1e-3;

  const plus = [...lms] as [number, number, number];
  const minus = [...lms] as [number, number, number];
  plus[i] += h;
  minus[i] -= h;

  const uvPlus = uvFromXyz(xyzFromLinear(linearFromLms(plus)));
  const uvMinus = uvFromXyz(xyzFromLinear(linearFromLms(minus)));

  const du = uvPlus[0] - uvMinus[0];
  const dv = uvPlus[1] - uvMinus[1];
  const len = Math.hypot(du, dv);
  if (len === 0) throw new Error(`Degenerate confusion direction for ${axis}`);
  return [du / len, dv / len];
}

/**
 * Chromaticity of the imaginary stimulus that excites only the affected cone --
 * the copunctal point, where all of that dichromat's confusion lines meet.
 * Exposed mainly so the test suite can compare against published values.
 */
export function copunctalUv(axis: CvdAxis): Uv {
  const lms: [number, number, number] = [0, 0, 0];
  lms[CONE_INDEX[axis]] = 1;
  return uvFromXyz(xyzFromLinear(linearFromLms(lms)));
}

export interface StimulusRequest {
  readonly axis: CvdAxis;
  readonly backgroundUv: Uv;
  readonly Y: number;
  /** Displacement in raw u'v' units (not the x10^4 reporting units). */
  readonly amplitude: number;
  /** Which way along the confusion line. Alternated between trials. */
  readonly sign: 1 | -1;
}

/**
 * A color displaced from the background along a confusion line, at unchanged
 * luminance. For an observer with the corresponding deficiency this is
 * indistinguishable from the background; for everyone else it is a visible hue
 * difference whose size is exactly `amplitude`.
 */
export function confusionColor(req: StimulusRequest): Srgb {
  const d = confusionDirection(req.axis, req.backgroundUv, req.Y);
  const uv: Uv = [
    req.backgroundUv[0] + d[0] * req.amplitude * req.sign,
    req.backgroundUv[1] + d[1] * req.amplitude * req.sign,
  ];
  return srgbFromLinear(linearFromXyz(xyzFromUv(uv, req.Y)));
}

/**
 * Largest amplitude the display can actually reproduce in this direction. A
 * staircase that bottoms out here has hit the monitor's limit rather than the
 * observer's threshold, which the report must state explicitly rather than
 * pretending it measured a number.
 */
export function gamutLimitedAmplitude(
  axis: CvdAxis,
  backgroundUv: Uv,
  Y: number,
  sign: 1 | -1,
  searchCeiling = 0.35,
): number {
  const d = confusionDirection(axis, backgroundUv, Y);
  return maxAmplitudeInGamut((amplitude) => {
    const uv: Uv = [
      backgroundUv[0] + d[0] * amplitude * sign,
      backgroundUv[1] + d[1] * amplitude * sign,
    ];
    return inGamut(linearFromXyz(xyzFromUv(uv, Y)));
  }, searchCeiling);
}

/**
 * The tighter of the two directions, so both polarities remain presentable.
 * Memoised because it costs two binary searches and is asked for on every plate.
 */
export function symmetricGamutLimit(axis: CvdAxis, backgroundUv: Uv, Y: number): number {
  const key = `${axis}|${backgroundUv[0]}|${backgroundUv[1]}|${Y}`;
  const cached = limitCache.get(key);
  if (cached !== undefined) return cached;

  const limit = Math.min(
    gamutLimitedAmplitude(axis, backgroundUv, Y, 1),
    gamutLimitedAmplitude(axis, backgroundUv, Y, -1),
  );
  limitCache.set(key, limit);
  return limit;
}

const limitCache = new Map<string, number>();

/**
 * How far a color sits from a reference along the u'v' plane. Used to express
 * measured confusion-color separations in the same units as thresholds.
 */
export function uvSeparation(a: Srgb, b: Srgb): number {
  return uvDistance(
    uvFromXyz(xyzFromLinear(linearFromSrgb(a))),
    uvFromXyz(xyzFromLinear(linearFromSrgb(b))),
  );
}

/**
 * Smallest displacement that survives 8-bit quantisation, i.e. the smallest
 * amplitude at which the stimulus actually differs from the background in the
 * framebuffer at all.
 *
 * This matters more than it looks. Without a floor, a staircase would keep
 * halving the amplitude past the point where the rendered colour is byte-for-byte
 * identical to the background; the observer would then be guessing at chance,
 * and the recorded "threshold" would be an artefact of the display's bit depth
 * rather than a property of their vision. Anyone who bottoms out here is simply
 * better than this screen can measure, and the report says so.
 */
export function quantisationFloor(axis: CvdAxis, backgroundUv: Uv, Y: number): number {
  const reference = quantise(srgbFromLinear(linearFromXyz(xyzFromUv(backgroundUv, Y))));
  const differs = (amplitude: number) => {
    const c = quantise(confusionColor({ axis, backgroundUv, Y, amplitude, sign: 1 }));
    return c[0] !== reference[0] || c[1] !== reference[1] || c[2] !== reference[2];
  };

  let lo = 0;
  let hi = 2e-3;
  while (hi < 0.2 && !differs(hi)) hi *= 2;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (differs(mid)) hi = mid;
    else lo = mid;
  }
  return hi;
}

function quantise(rgb: Srgb): [number, number, number] {
  return [
    Math.round(Math.min(1, Math.max(0, rgb[0])) * 255),
    Math.round(Math.min(1, Math.max(0, rgb[1])) * 255),
    Math.round(Math.min(1, Math.max(0, rgb[2])) * 255),
  ];
}

export interface UvLine {
  readonly from: Uv2;
  readonly to: Uv2;
}

/**
 * One of the observer's confusion lines, as a segment long enough to cross the
 * whole diagram.
 *
 * Since every confusion line passes through the copunctal point, a single
 * parameter picks out which line: `t` slides the second defining point along the
 * spectral locus's rough span, fanning the lines across the visible region. The
 * segment is then extended well past both ends and clipped when drawn, which is
 * simpler and more robust than solving for the locus intersections.
 */
export function confusionLineUv(axis: CvdAxis, t: number): UvLine {
  const [cu, cv] = copunctalUv(axis);

  // A point in the middle of the visible region for this line to pass through.
  const through: Uv2 = axis === 'tritan' ? [0.06 + t * 0.5, 0.05 + t * 0.12] : [0.05 + t * 0.35, 0.15 + t * 0.62];

  const du = through[0] - cu;
  const dv = through[1] - cv;
  const len = Math.hypot(du, dv) || 1;
  const ux = du / len;
  const uy = dv / len;

  const reach = 1.6;
  return {
    from: [cu - ux * reach, cv - uy * reach],
    to: [cu + ux * reach, cv + uy * reach],
  };
}

/**
 * Best sRGB rendering of a chromaticity, for painting the diagram interior.
 *
 * Most of the horseshoe is far outside what a screen can show, so the colour is
 * desaturated toward white until it fits rather than clipped, which would distort
 * hue as well as saturation. The result is an honest approximation: correct hue,
 * understated purity. Returns null for chromaticities that are not real colours.
 */
export function uvToDisplayHex(u: number, v: number): string | null {
  if (v <= 1e-6) return null;

  const xyz = xyzFromUv([u, v], 1);
  if (!Number.isFinite(xyz[0]) || xyz[1] <= 0) return null;

  const linear = linearFromXyz(xyz);
  // Outside the locus at all, XYZ turns negative in a way desaturation cannot fix.
  if (linear.every((c) => c <= 0)) return null;

  // Normalise to a consistent brightness before desaturating, so the diagram
  // reads as one surface rather than a patchwork of exposures.
  const peak = Math.max(...linear);
  if (!(peak > 0)) return null;
  const scaled = linear.map((c) => c / peak) as unknown as [number, number, number];

  const fitted = desaturateIntoGamut(scaled);
  return hexFromSrgb(srgbFromLinear(fitted));
}

/** The neutral grey the stimulus screens adapt the observer to. */
export const ADAPT_Y = 0.2;

/** Chromaticity of display white, the neutral background all stimuli sit on. */
export const NEUTRAL_UV: Uv = uvFromXyz(xyzFromLinear([1, 1, 1]));

export const NEUTRAL_BACKGROUND: Srgb = srgbFromLinear([ADAPT_Y, ADAPT_Y, ADAPT_Y]);
