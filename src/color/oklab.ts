/**
 * OKLab (Bjorn Ottosson, 2020) and its cylindrical form OKLCh.
 *
 * Used for perceptual distance in this app rather than CIELAB because it behaves
 * much better for saturated blues, which matters when we compare how far apart
 * colors are for a tritan observer.
 */
import { apply, type Mat3, type Vec3 } from './matrix';
import { linearFromSrgb, srgbFromLinear, type LinearRgb, type Srgb } from './srgb';

export type Oklab = Vec3;
/** [L, C, h] with h in degrees. */
export type Oklch = Vec3;

const LMS_FROM_LINEAR: Mat3 = [
  [0.4122214708, 0.5363325363, 0.0514459929],
  [0.2119034982, 0.6806995451, 0.1073969566],
  [0.0883024619, 0.2817188376, 0.6299787005],
];

const LAB_FROM_LMS_PRIME: Mat3 = [
  [0.2104542553, 0.793617785, -0.0040720468],
  [1.9779984951, -2.428592205, 0.4505937099],
  [0.0259040371, 0.7827717662, -0.808675766],
];

const LINEAR_FROM_LMS: Mat3 = [
  [4.0767416621, -3.3077115913, 0.2309699292],
  [-1.2684380046, 2.6097574011, -0.3413193965],
  [-0.0041960863, -0.7034186147, 1.707614701],
];

const LMS_PRIME_FROM_LAB: Mat3 = [
  [1, 0.3963377774, 0.2158037573],
  [1, -0.1055613458, -0.0638541728],
  [1, -0.0894841775, -1.291485548],
];

export function oklabFromLinear(rgb: LinearRgb): Oklab {
  const lms = apply(LMS_FROM_LINEAR, rgb);
  const prime: Vec3 = [Math.cbrt(lms[0]), Math.cbrt(lms[1]), Math.cbrt(lms[2])];
  return apply(LAB_FROM_LMS_PRIME, prime);
}

export function linearFromOklab(lab: Oklab): LinearRgb {
  const prime = apply(LMS_PRIME_FROM_LAB, lab);
  const lms: Vec3 = [prime[0] ** 3, prime[1] ** 3, prime[2] ** 3];
  return apply(LINEAR_FROM_LMS, lms);
}

export function oklabFromSrgb(rgb: Srgb): Oklab {
  return oklabFromLinear(linearFromSrgb(rgb));
}

export function srgbFromOklab(lab: Oklab): Srgb {
  return srgbFromLinear(linearFromOklab(lab));
}

export function oklchFromOklab(lab: Oklab): Oklch {
  const c = Math.hypot(lab[1], lab[2]);
  let h = (Math.atan2(lab[2], lab[1]) * 180) / Math.PI;
  if (h < 0) h += 360;
  return [lab[0], c, h];
}

export function oklabFromOklch(lch: Oklch): Oklab {
  const rad = (lch[2] * Math.PI) / 180;
  return [lch[0], lch[1] * Math.cos(rad), lch[1] * Math.sin(rad)];
}

export function oklchFromSrgb(rgb: Srgb): Oklch {
  return oklchFromOklab(oklabFromSrgb(rgb));
}

export function srgbFromOklch(lch: Oklch): Srgb {
  return srgbFromOklab(oklabFromOklch(lch));
}

/**
 * Euclidean distance in OKLab. Roughly 0.01 is a just-noticeable difference for
 * large patches, so the values shown in the report are scaled by 100 to give a
 * familiar "delta E"-like magnitude.
 */
export function deltaEOk(a: Oklab, b: Oklab): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

export function deltaEOkSrgb(a: Srgb, b: Srgb): number {
  return deltaEOk(oklabFromSrgb(a), oklabFromSrgb(b));
}

/** Chromatic-only distance, ignoring lightness. */
export function deltaChromaOk(a: Oklab, b: Oklab): number {
  return Math.hypot(a[1] - b[1], a[2] - b[2]);
}
