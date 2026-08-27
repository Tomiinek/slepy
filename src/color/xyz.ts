import { apply, invert, type Mat3, type Vec3 } from './matrix';
import { linearFromSrgb, srgbFromLinear, type LinearRgb, type Srgb } from './srgb';

/** CIE 1931 XYZ, normalised so that Y = 1 for diffuse white. */
export type Xyz = Vec3;
/** CIE 1976 u'v' chromaticity. */
export type Uv = readonly [number, number];
/** CIE 1931 xy chromaticity. */
export type Xy = readonly [number, number];

/** sRGB (BT.709 primaries, D65 white) linear RGB -> CIE 1931 XYZ. */
export const XYZ_FROM_LINEAR_RGB: Mat3 = [
  [0.4123907992659595, 0.35758433938387796, 0.1804807884018343],
  [0.21263900587151036, 0.7151686787677559, 0.07219231536073371],
  [0.019330818715591851, 0.11919477979462599, 0.9505321522496606],
];

export const LINEAR_RGB_FROM_XYZ: Mat3 = invert(XYZ_FROM_LINEAR_RGB);

/** D65 white point in XYZ at Y = 1. */
export const D65_XYZ: Xyz = [0.9504559270516716, 1, 1.0890577507598784];

export function xyzFromLinear(rgb: LinearRgb): Xyz {
  return apply(XYZ_FROM_LINEAR_RGB, rgb);
}

export function linearFromXyz(xyz: Xyz): LinearRgb {
  return apply(LINEAR_RGB_FROM_XYZ, xyz);
}

export function xyzFromSrgb(rgb: Srgb): Xyz {
  return xyzFromLinear(linearFromSrgb(rgb));
}

export function srgbFromXyz(xyz: Xyz): Srgb {
  return srgbFromLinear(linearFromXyz(xyz));
}

export function uvFromXyz(xyz: Xyz): Uv {
  const denom = xyz[0] + 15 * xyz[1] + 3 * xyz[2];
  if (denom === 0) return [0, 0];
  return [(4 * xyz[0]) / denom, (9 * xyz[1]) / denom];
}

/** Reconstruct XYZ from u'v' chromaticity at a chosen luminance Y. */
export function xyzFromUv(uv: Uv, Y: number): Xyz {
  const [u, v] = uv;
  if (v === 0) return [0, Y, 0];
  const X = (Y * 9 * u) / (4 * v);
  const Z = (Y * (12 - 3 * u - 20 * v)) / (4 * v);
  return [X, Y, Z];
}

export function xyFromXyz(xyz: Xyz): Xy {
  const sum = xyz[0] + xyz[1] + xyz[2];
  if (sum === 0) return [0, 0];
  return [xyz[0] / sum, xyz[1] / sum];
}

export function xyzFromXy(xy: Xy, Y: number): Xyz {
  const [x, y] = xy;
  if (y === 0) return [0, Y, 0];
  return [(Y * x) / y, Y, (Y * (1 - x - y)) / y];
}

export function uvFromXy(xy: Xy): Uv {
  const [x, y] = xy;
  const denom = -2 * x + 12 * y + 3;
  return [(4 * x) / denom, (9 * y) / denom];
}

export function xyFromUv(uv: Uv): Xy {
  const [u, v] = uv;
  const denom = 6 * u - 16 * v + 12;
  return [(9 * u) / denom, (4 * v) / denom];
}

export function uvDistance(a: Uv, b: Uv): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

/**
 * Threshold magnitudes are conventionally reported in u'v' units scaled by
 * 10^4 in the color vision literature (e.g. Cambridge Colour Test), which keeps
 * typical values in a readable 20..1500 range.
 */
export const UV_UNIT_SCALE = 1e4;
