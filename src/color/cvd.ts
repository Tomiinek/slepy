/**
 * Simulation of color vision deficiency.
 *
 * Implements Brettel, Vienot & Mollon (1997) -- the dichromat's color space is
 * two half-planes meeting at the neutral axis, and every stimulus is replaced by
 * its projection onto whichever half-plane it falls in. Also implements the
 * Vienot, Brettel & Mollon (1999) single-matrix simplification, which is exact
 * enough for protan and deutan but known to be wrong for tritan.
 *
 * Anomalous trichromacy (the common, partial forms) is modelled by interpolating
 * between the original color and the fully dichromatic projection. The
 * literature reports this tracks Machado et al. (2009) closely for protanomaly
 * and deuteranomaly, while being far simpler and free of tabulated constants.
 *
 * The matrices below fold the whole pipeline (linear RGB -> LMS -> projection ->
 * linear RGB) into single 3x3 matrices operating on linear-light sRGB, and the
 * half-plane test normal is likewise pre-transformed into linear RGB space. They
 * come from libDaltonLens, generated from DaltonLens-Python's
 * `Simulator_Brettel1997(LMSModel_sRGB_SmithPokorny75())`, i.e. Smith & Pokorny
 * (1975) cone fundamentals combined with modern sRGB primaries. The projection
 * planes use display white rather than equal-energy white as the neutral
 * element, which is the common choice among Brettel implementations because it
 * keeps far more projected colors inside the sRGB gamut.
 */
import { apply, lerpMat3, type Mat3, type Vec3 } from './matrix';
import { CVD_AXES, type CvdAxis } from './lms';
import {
  clampSrgb,
  linearFromSrgb,
  srgbFromLinear,
  type LinearRgb,
  type Srgb,
} from './srgb';
import { desaturateIntoGamut } from './gamut';

interface BrettelParams {
  /** rgbFromLms . projection1 . lmsFromRgb */
  readonly plane1: Mat3;
  /** rgbFromLms . projection2 . lmsFromRgb */
  readonly plane2: Mat3;
  /** Separation plane normal, already expressed in linear RGB space. */
  readonly separationNormal: Vec3;
}

const BRETTEL: Record<CvdAxis, BrettelParams> = {
  protan: {
    plane1: [
      [0.1498, 1.19548, -0.34528],
      [0.10764, 0.84864, 0.04372],
      [0.00384, -0.0054, 1.00156],
    ],
    plane2: [
      [0.1457, 1.16172, -0.30742],
      [0.10816, 0.85291, 0.03892],
      [0.00386, -0.00524, 1.00139],
    ],
    separationNormal: [0.00048, 0.00393, -0.00441],
  },
  deutan: {
    plane1: [
      [0.36477, 0.86381, -0.22858],
      [0.26294, 0.64245, 0.09462],
      [-0.02006, 0.02728, 0.99278],
    ],
    plane2: [
      [0.37298, 0.88166, -0.25464],
      [0.25954, 0.63506, 0.1054],
      [-0.0198, 0.02784, 0.99196],
    ],
    separationNormal: [-0.00281, -0.00611, 0.00892],
  },
  tritan: {
    plane1: [
      [1.01277, 0.13548, -0.14826],
      [-0.01243, 0.86812, 0.14431],
      [0.07589, 0.805, 0.11911],
    ],
    plane2: [
      [0.93678, 0.18979, -0.12657],
      [0.06154, 0.81526, 0.1232],
      [-0.37562, 1.12767, 0.24796],
    ],
    separationNormal: [0.03901, -0.02788, -0.01113],
  },
};

/** Vienot et al. (1999) single-matrix dichromacy simulation, in linear RGB. */
const VIENOT: Record<CvdAxis, Mat3> = {
  protan: [
    [0.11238, 0.88762, 0.0],
    [0.11238, 0.88762, 0.0],
    [0.00401, -0.00401, 1.0],
  ],
  deutan: [
    [0.29275, 0.70725, 0.0],
    [0.29275, 0.70725, 0.0],
    [-0.02234, 0.02234, 1.0],
  ],
  tritan: [
    [1.0, 0.14461, -0.14461],
    [0.0, 0.85924, 0.14076],
    [0.0, 0.85924, 0.14076],
  ],
};

/** What the observer's vision is like. Severity 0 = typical, 1 = dichromatic. */
export interface Deficiency {
  readonly axis: CvdAxis;
  /** 0..1. Values below ~0.05 are treated as normal trichromacy. */
  readonly severity: number;
}

export const NORMAL_VISION = null;
/** `null` means normal trichromacy, i.e. no transform at all. */
export type Vision = Deficiency | typeof NORMAL_VISION;

/**
 * The Vienot 1999 single-matrix approximation.
 *
 * Only for cases that structurally require one 3x3 matrix, such as an SVG
 * `feColorMatrix` filter. Do NOT use it for anything measured or reported: it
 * collapses the red and green output rows, which is accurate enough mid-gamut
 * but badly wrong at the gamut edges (saturated blue is off by a wide margin,
 * and the authors themselves note it is invalid for tritanopia). `simulateLinear`
 * uses Brettel's two-plane projection instead, and everything user-facing in
 * this app goes through that.
 */
export function vienotMatrix(def: Deficiency): Mat3 {
  return lerpMat3(
    [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ],
    VIENOT[def.axis],
    clampSeverity(def.severity),
  );
}

function clampSeverity(s: number): number {
  return s < 0 ? 0 : s > 1 ? 1 : s;
}

/**
 * Simulate a deficiency on a linear-light RGB color using Brettel 1997.
 * The result may fall slightly outside the sRGB gamut; callers that need a
 * displayable color should pass it through `desaturateIntoGamut`.
 */
export function simulateLinear(rgb: LinearRgb, vision: Vision): LinearRgb {
  if (!vision) return rgb;
  const severity = clampSeverity(vision.severity);
  if (severity <= 0) return rgb;

  const p = BRETTEL[vision.axis];
  const n = p.separationNormal;
  const side = rgb[0] * n[0] + rgb[1] * n[1] + rgb[2] * n[2];
  const projected = apply(side >= 0 ? p.plane1 : p.plane2, rgb);

  if (severity >= 1) return projected;
  return [
    rgb[0] + (projected[0] - rgb[0]) * severity,
    rgb[1] + (projected[1] - rgb[1]) * severity,
    rgb[2] + (projected[2] - rgb[2]) * severity,
  ];
}

/**
 * Simulate a deficiency on a gamma-encoded sRGB color, returning a displayable
 * sRGB color. Out-of-gamut projections are desaturated toward white rather than
 * per-channel clipped, which avoids the hue shifts that naive clipping causes on
 * saturated inputs.
 */
export function simulateSrgb(rgb: Srgb, vision: Vision): Srgb {
  if (!vision) return rgb;
  const out = simulateLinear(linearFromSrgb(rgb), vision);
  return clampSrgb(srgbFromLinear(desaturateIntoGamut(out)));
}

/**
 * Simulate a deficiency over RGBA pixel data in place. Used by the scene and
 * image simulators, where per-pixel object allocation would be far too slow.
 */
export function simulateImageData(data: Uint8ClampedArray, vision: Vision): void {
  if (!vision) return;
  const severity = clampSeverity(vision.severity);
  if (severity <= 0) return;

  const p = BRETTEL[vision.axis];
  const [n0, n1, n2] = p.separationNormal;
  const inv = 1 - severity;

  // A 256-entry LUT removes the pow() call from the inner loop; sRGB decode is
  // by far the most expensive part of a naive per-pixel implementation.
  const decode = SRGB_DECODE_LUT;

  for (let i = 0; i < data.length; i += 4) {
    const r = decode[data[i]];
    const g = decode[data[i + 1]];
    const b = decode[data[i + 2]];

    const m = r * n0 + g * n1 + b * n2 >= 0 ? p.plane1 : p.plane2;

    let cr = m[0][0] * r + m[0][1] * g + m[0][2] * b;
    let cg = m[1][0] * r + m[1][1] * g + m[1][2] * b;
    let cb = m[2][0] * r + m[2][1] * g + m[2][2] * b;

    if (severity < 1) {
      cr = r * inv + cr * severity;
      cg = g * inv + cg * severity;
      cb = b * inv + cb * severity;
    }

    data[i] = encodeByte(cr);
    data[i + 1] = encodeByte(cg);
    data[i + 2] = encodeByte(cb);
  }
}

const SRGB_DECODE_LUT: Float32Array = (() => {
  const lut = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const v = i / 255;
    lut[i] = v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  }
  return lut;
})();

function encodeByte(v: number): number {
  if (v <= 0) return 0;
  if (v >= 1) return 255;
  return 255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);
}

/** Human-readable names, indexed by axis and whether severity is complete. */
export function deficiencyName(def: Deficiency): string {
  const dichromatic = def.severity >= 0.95;
  switch (def.axis) {
    case 'protan':
      return dichromatic ? 'protanopia' : 'protanomaly';
    case 'deutan':
      return dichromatic ? 'deuteranopia' : 'deuteranomaly';
    case 'tritan':
      return dichromatic ? 'tritanopia' : 'tritanomaly';
  }
}

export { CVD_AXES };
export type { CvdAxis };
