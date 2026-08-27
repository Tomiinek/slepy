/**
 * Gradient stops approximating the visible spectrum, for use as a chart axis.
 *
 * Putting a spectrum strip under a wavelength axis removes the need to explain
 * that 566 nm is red and 441 nm is blue -- the axis says it. The colours come
 * from the same spectral locus data the chromaticity diagram uses, mapped into
 * the display gamut, so the strip is consistent with the rest of the report
 * rather than a decorative hand-picked ramp.
 *
 * Saturated spectral colours are outside sRGB, so these are necessarily
 * desaturated approximations; that is unavoidable on any screen.
 */
import { uvToDisplayHex } from '../../color/confusion';
import { SPECTRAL_LOCUS_UV } from '../../color/spectralData';

export interface SpectrumStop {
  readonly offset: number;
  readonly color: string;
}

export function spectrumStops(lo: number, hi: number): SpectrumStop[] {
  const stops: SpectrumStop[] = [];

  for (const [nm, u, v] of SPECTRAL_LOCUS_UV) {
    if (nm < lo || nm > hi) continue;
    const hex = uvToDisplayHex(u, v);
    if (!hex) continue;
    stops.push({ offset: (nm - lo) / (hi - lo), color: hex });
  }

  return stops;
}
