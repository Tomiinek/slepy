import { relativeLuminance, type LinearRgb } from './srgb';
import { clamp } from './matrix';

/**
 * Bring an out-of-gamut linear RGB color into the sRGB cube by mixing it with a
 * neutral of the same luminance, i.e. reducing saturation while preserving hue
 * and lightness. Naive per-channel clipping instead shifts hue, which matters a
 * lot here because the whole app is about hue relationships.
 */
export function desaturateIntoGamut(rgb: LinearRgb): LinearRgb {
  if (rgb[0] >= 0 && rgb[0] <= 1 && rgb[1] >= 0 && rgb[1] <= 1 && rgb[2] >= 0 && rgb[2] <= 1) {
    return rgb;
  }

  const y = clamp(relativeLuminance(rgb), 0, 1);
  const grey: LinearRgb = [y, y, y];

  // Binary search the largest blend toward the original color that still fits.
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    const c: LinearRgb = [
      grey[0] + (rgb[0] - grey[0]) * mid,
      grey[1] + (rgb[1] - grey[1]) * mid,
      grey[2] + (rgb[2] - grey[2]) * mid,
    ];
    const ok = c.every((v) => v >= -1e-9 && v <= 1 + 1e-9);
    if (ok) lo = mid;
    else hi = mid;
  }

  const t = lo;
  return [
    clamp(grey[0] + (rgb[0] - grey[0]) * t, 0, 1),
    clamp(grey[1] + (rgb[1] - grey[1]) * t, 0, 1),
    clamp(grey[2] + (rgb[2] - grey[2]) * t, 0, 1),
  ];
}

/**
 * How far along a chromaticity direction we can travel from a starting point
 * before leaving the sRGB gamut at a fixed luminance. Used to cap stimulus
 * amplitude: past this point the display physically cannot show the color, so a
 * staircase that reaches the cap has hit a hard ceiling rather than a threshold.
 */
export function maxAmplitudeInGamut(
  isInGamut: (amplitude: number) => boolean,
  upperBound: number,
): number {
  if (!isInGamut(0)) return 0;
  if (isInGamut(upperBound)) return upperBound;
  let lo = 0;
  let hi = upperBound;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (isInGamut(mid)) lo = mid;
    else hi = mid;
  }
  return lo;
}
