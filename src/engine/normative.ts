/**
 * Reference values for a colour-normal observer.
 *
 * READ THIS BEFORE TRUSTING THE ABSOLUTE NUMBERS.
 *
 * These are indicative bands, not calibrated norms. Published thresholds come
 * from instruments like the Cambridge Colour Test running on a calibrated CRT at
 * a fixed viewing distance in a darkened room, with a trained operator. We are
 * running in a browser, on an unknown panel, at an unknown brightness, at an
 * unknown distance, possibly with a blue-light filter quietly mangling the
 * primaries. Absolute thresholds measured here can easily be off by a factor of
 * two for reasons that have nothing to do with the observer's cones.
 *
 * That is why the classifier leans on *ratios between the three axes* as its
 * primary evidence. A miscalibrated display, a dirty screen, uncorrected myopia,
 * a small window or a tired observer all inflate every axis at once and largely
 * cancel in the ratio. Only a genuine cone deficiency inflates one axis while
 * leaving the others alone.
 *
 * Values are in raw u'v' displacement. Multiply by UV_UNIT_SCALE (10^4) for the
 * units used in the literature and in the report.
 */
import type { CvdAxis } from '../color/lms';

export interface NormativeBand {
  /** Typical threshold for a colour-normal observer. */
  readonly median: number;
  /** Upper limit of the normal range; above this is suspicious. */
  readonly upper: number;
}

/**
 * Median and upper-normal thresholds, loosely following the ranges reported for
 * the Cambridge Colour Test's Trivector protocol (normals cluster around
 * 50-70 x10^-4 on the red-green axes and 80-110 x10^-4 on tritan, with upper
 * normal limits roughly double the median).
 *
 * Tritan is intrinsically coarser for two reasons worth keeping in mind when
 * reading a result: S cones are far sparser than L and M in the retina, and the
 * blue primary is where consumer displays deviate most from the sRGB standard.
 * A mildly elevated tritan value on its own is weak evidence of anything.
 */
export const NORMATIVE: Record<CvdAxis, NormativeBand> = {
  protan: { median: 0.0058, upper: 0.0115 },
  deutan: { median: 0.0058, upper: 0.0115 },
  tritan: { median: 0.0095, upper: 0.019 },
};

/**
 * Threshold elevation at which we call a deficiency complete (dichromacy).
 *
 * This is deliberately set to a value an sRGB display can actually reach. The
 * largest colour difference available along a confusion line at our adaptation
 * luminance is only about 9 to 10 times the normal threshold, so a scale
 * anchored at, say, 25x would be unreachable by construction and every genuine
 * dichromat would be reported as merely "moderate". A staircase that runs off
 * the top of the gamut is right-censored data, and the classifier handles that
 * case explicitly rather than pretending the censored number is a measurement.
 */
export const DICHROMAT_ELEVATION = 8.5;

/** Elevation above which one axis counts as genuinely affected. */
export const AFFECTED_ELEVATION = 1.9;

export type SeverityLabel = 'none' | 'slight' | 'mild' | 'moderate' | 'strong' | 'complete';

export const SEVERITY_BANDS: readonly { label: SeverityLabel; minElevation: number }[] = [
  { label: 'complete', minElevation: DICHROMAT_ELEVATION },
  { label: 'strong', minElevation: 5.5 },
  { label: 'moderate', minElevation: 3.2 },
  { label: 'mild', minElevation: AFFECTED_ELEVATION },
  { label: 'slight', minElevation: 1.45 },
  { label: 'none', minElevation: 0 },
];

export function severityLabelFor(elevation: number): SeverityLabel {
  for (const band of SEVERITY_BANDS) {
    if (elevation >= band.minElevation) return band.label;
  }
  return 'none';
}

/**
 * Map a threshold elevation onto the 0..1 severity the simulation takes.
 *
 * Logarithmic, because elevation is a ratio: the perceptual step from 2x to 4x
 * is much like the step from 8x to 16x. Anchored so that "just outside normal"
 * lands near 0.15 and dichromat-level elevation reaches 1.
 */
export function severityFromElevation(elevation: number): number {
  if (elevation <= 1) return 0;
  const t = Math.log(elevation) / Math.log(DICHROMAT_ELEVATION);
  return clamp01(t);
}

/**
 * Discrimination performance relative to a typical observer, 0..1, for the
 * report's cone panel. Deliberately expressed as *performance on this axis*
 * rather than "how much of your cone works", because a discrimination threshold
 * cannot separate a missing pigment from a shifted one.
 */
export function relativePerformance(threshold: number, axis: CvdAxis): number {
  if (!Number.isFinite(threshold) || threshold <= 0) return 1;
  return clamp01(NORMATIVE[axis].median / threshold);
}

export function elevation(threshold: number, axis: CvdAxis): number {
  return threshold / NORMATIVE[axis].median;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
