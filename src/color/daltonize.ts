/**
 * Daltonization -- the inverse job to simulation.
 *
 * Simulation answers "what does a color blind person miss?". Daltonization
 * answers "how do we put that information somewhere they can actually see it?".
 * The classic recipe (Fidaner et al., 2005) takes the error between the original
 * color and its simulation, then redistributes that error onto the channels the
 * observer still has. The result is not the true hue -- nothing can give them
 * that -- but differences that had collapsed become visible again.
 *
 * In the report this powers "reveal" mode, so someone who cannot see a red mark
 * on a green background can at least see *that* something is there.
 */
import { simulateLinear, type Deficiency } from './cvd';
import { desaturateIntoGamut } from './gamut';
import { linearFromSrgb, srgbFromLinear, clampSrgb, type LinearRgb, type Srgb } from './srgb';
import type { CvdAxis } from './lms';

/**
 * How the lost error is shifted onto surviving channels, per deficiency.
 * Rows are output R/G/B, columns are the error in R/G/B.
 *
 * For protan and deutan the red-green error is pushed into blue and green,
 * because those observers retain the blue-yellow axis. For tritan the blue-
 * yellow error is pushed into red and green.
 */
const ERROR_SHIFT: Record<CvdAxis, readonly [LinearRgb, LinearRgb, LinearRgb]> = {
  protan: [
    [0, 0, 0],
    [0.7, 1, 0],
    [0.7, 0, 1],
  ],
  deutan: [
    [0, 0, 0],
    [0.7, 1, 0],
    [0.7, 0, 1],
  ],
  tritan: [
    [1, 0, 0.7],
    [0, 1, 0.7],
    [0, 0, 0],
  ],
};

/**
 * `strength` scales how aggressively the lost contrast is reintroduced. Values
 * above ~1.5 look lurid but can be genuinely useful for finding a marker.
 */
export function daltonizeLinear(rgb: LinearRgb, def: Deficiency, strength = 1): LinearRgb {
  const sim = simulateLinear(rgb, def);
  const err: LinearRgb = [rgb[0] - sim[0], rgb[1] - sim[1], rgb[2] - sim[2]];
  const m = ERROR_SHIFT[def.axis];
  return [
    rgb[0] + strength * (m[0][0] * err[0] + m[0][1] * err[1] + m[0][2] * err[2]),
    rgb[1] + strength * (m[1][0] * err[0] + m[1][1] * err[1] + m[1][2] * err[2]),
    rgb[2] + strength * (m[2][0] * err[0] + m[2][1] * err[1] + m[2][2] * err[2]),
  ];
}

export function daltonizeSrgb(rgb: Srgb, def: Deficiency, strength = 1): Srgb {
  const out = daltonizeLinear(linearFromSrgb(rgb), def, strength);
  return clampSrgb(srgbFromLinear(desaturateIntoGamut(out)));
}

/** In-place RGBA daltonization for canvas pixel data. */
export function daltonizeImageData(
  data: Uint8ClampedArray,
  def: Deficiency,
  strength = 1,
): void {
  for (let i = 0; i < data.length; i += 4) {
    const out = daltonizeSrgb(
      [data[i] / 255, data[i + 1] / 255, data[i + 2] / 255],
      def,
      strength,
    );
    data[i] = Math.round(out[0] * 255);
    data[i + 1] = Math.round(out[1] * 255);
    data[i + 2] = Math.round(out[2] * 255);
  }
}
