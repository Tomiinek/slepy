/**
 * Colour caps for the arrangement stage, in the spirit of the Farnsworth D-15.
 *
 * The observer puts them in a smooth colour order. Someone with normal colour
 * vision walks the hue circle; someone with a deficiency reaches a region where
 * neighbouring caps look identical, guesses, and produces transpositions that
 * line up along their own confusion axis. The *direction* of those errors is the
 * useful output -- it identifies the deficiency type by a completely different
 * route from the threshold staircases, which is what makes it worth the extra
 * ninety seconds.
 *
 * Caps are equally spaced in OKLCh hue at constant lightness and chroma, so no
 * cap stands out by being lighter or more vivid. Chroma is set to the largest
 * value that keeps every hue inside sRGB, since a cap that had to be gamut-
 * clipped would differ in a way the test is not asking about.
 */
import { oklchFromSrgb, srgbFromOklch } from '../color/oklab';
import { inGamut, linearFromSrgb, hexFromSrgb, type Srgb } from '../color/srgb';
import { linearFromOklab, oklabFromOklch } from '../color/oklab';

export const CAP_COUNT = 16;

/** Fixed lightness for all caps. Mid-range keeps the most chroma available. */
const CAP_LIGHTNESS = 0.68;

/**
 * Largest OKLCh chroma at which every hue on the circle is displayable. Solved
 * once at module load rather than hard-coded, so the caps stay correct if the
 * lightness is ever retuned.
 */
export const CAP_CHROMA: number = (() => {
  const fits = (chroma: number) => {
    for (let i = 0; i < 180; i++) {
      const hue = (i / 180) * 360;
      const lin = linearFromOklab(oklabFromOklch([CAP_LIGHTNESS, chroma, hue]));
      if (!inGamut(lin, 1e-4)) return false;
    }
    return true;
  };

  let lo = 0;
  let hi = 0.4;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) lo = mid;
    else hi = mid;
  }
  return lo;
})();

export interface Cap {
  /** Position in the correct ordering, 0-based. */
  readonly index: number;
  readonly hue: number;
  readonly color: Srgb;
  readonly hex: string;
}

export function buildCaps(): Cap[] {
  const caps: Cap[] = [];
  for (let i = 0; i < CAP_COUNT; i++) {
    const hue = (i / CAP_COUNT) * 360;
    const color = srgbFromOklch([CAP_LIGHTNESS, CAP_CHROMA, hue]);
    caps.push({ index: i, hue, color, hex: hexFromSrgb(color) });
  }
  return caps;
}

export const CAPS: readonly Cap[] = buildCaps();

/** The cap left fixed as the starting anchor, as in the printed test. */
export const ANCHOR_INDEX = 0;

/** Sanity: caps really are equally spaced and uniform in lightness/chroma. */
export function capUniformity(): { lightnessSpread: number; chromaSpread: number } {
  const lch = CAPS.map((c) => oklchFromSrgb(c.color));
  const l = lch.map((v) => v[0]);
  const ch = lch.map((v) => v[1]);
  return {
    lightnessSpread: Math.max(...l) - Math.min(...l),
    chromaSpread: Math.max(...ch) - Math.min(...ch),
  };
}

export function capLinear(cap: Cap) {
  return linearFromSrgb(cap.color);
}
