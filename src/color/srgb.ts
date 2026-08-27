import { clamp, type Vec3 } from './matrix';

/** Gamma-encoded sRGB, each channel in 0..1. */
export type Srgb = Vec3;
/** Linear-light sRGB, each channel in 0..1 (may go out of range mid-pipeline). */
export type LinearRgb = Vec3;

export function linearFromEncodedChannel(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

export function encodedFromLinearChannel(c: number): number {
  return c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

export function linearFromSrgb(rgb: Srgb): LinearRgb {
  return [
    linearFromEncodedChannel(rgb[0]),
    linearFromEncodedChannel(rgb[1]),
    linearFromEncodedChannel(rgb[2]),
  ];
}

export function srgbFromLinear(rgb: LinearRgb): Srgb {
  return [
    encodedFromLinearChannel(rgb[0]),
    encodedFromLinearChannel(rgb[1]),
    encodedFromLinearChannel(rgb[2]),
  ];
}

export function clampSrgb(rgb: Srgb): Srgb {
  return [clamp(rgb[0], 0, 1), clamp(rgb[1], 0, 1), clamp(rgb[2], 0, 1)];
}

export function inGamut(rgb: LinearRgb, tolerance = 1e-6): boolean {
  return rgb.every((c) => c >= -tolerance && c <= 1 + tolerance);
}

export function hexFromSrgb(rgb: Srgb): string {
  const to2 = (c: number) =>
    Math.round(clamp(c, 0, 1) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${to2(rgb[0])}${to2(rgb[1])}${to2(rgb[2])}`;
}

export function srgbFromHex(hex: string): Srgb {
  let h = hex.trim().replace(/^#/, '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  if (!/^[0-9a-fA-F]{6}$/.test(h)) throw new Error(`Not a hex color: ${hex}`);
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ];
}

export function hexFromLinear(rgb: LinearRgb): string {
  return hexFromSrgb(clampSrgb(srgbFromLinear(rgb)));
}

export function linearFromHex(hex: string): LinearRgb {
  return linearFromSrgb(srgbFromHex(hex));
}

/** Relative luminance under BT.709 / sRGB primaries, from linear light. */
export function relativeLuminance(rgb: LinearRgb): number {
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}

/** WCAG contrast ratio between two gamma-encoded sRGB colors. */
export function contrastRatio(a: Srgb, b: Srgb): number {
  const la = relativeLuminance(linearFromSrgb(a));
  const lb = relativeLuminance(linearFromSrgb(b));
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}
