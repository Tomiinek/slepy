import { apply, invert, type Mat3, type Vec3 } from './matrix';
import type { LinearRgb } from './srgb';

/** Cone excitations (long / medium / short wavelength cones). */
export type Lms = Vec3;

/**
 * Smith & Pokorny (1975) cone fundamentals, expressed directly as a transform
 * from sRGB linear light. This folds together the Judd-Vos corrected XYZ space
 * that the Smith-Pokorny fundamentals are defined on with the sRGB primaries,
 * following the approximation Vienot et al. (1999) validated for exactly this
 * purpose. Values from the DaltonLens reference implementation, divided by 100.
 *
 * These fundamentals (rather than e.g. Hunt-Pointer-Estevez) are the right
 * choice here because the whole point is to model cone-level color confusion,
 * and Smith-Pokorny is the set the dichromacy simulation literature is built on.
 */
export const LMS_FROM_LINEAR_RGB: Mat3 = [
  [0.1788240413, 0.4351609057, 0.0411934969],
  [0.0345564232, 0.2715538246, 0.0386713084],
  [0.0002995656, 0.0018430896, 0.0146708614],
];

export const LINEAR_RGB_FROM_LMS: Mat3 = invert(LMS_FROM_LINEAR_RGB);

export function lmsFromLinear(rgb: LinearRgb): Lms {
  return apply(LMS_FROM_LINEAR_RGB, rgb);
}

export function linearFromLms(lms: Lms): LinearRgb {
  return apply(LINEAR_RGB_FROM_LMS, lms);
}

/** Index of the cone class that is missing or anomalous for each deficiency. */
export const CONE_INDEX = { protan: 0, deutan: 1, tritan: 2 } as const;

export type CvdAxis = keyof typeof CONE_INDEX;

export const CVD_AXES: readonly CvdAxis[] = ['protan', 'deutan', 'tritan'];

export const CONE_LABEL: Record<CvdAxis, string> = {
  protan: 'L-cone',
  deutan: 'M-cone',
  tritan: 'S-cone',
};

/** Display white in LMS. Brettel's two half-planes meet on this neutral axis. */
export const NEUTRAL_LMS: Lms = lmsFromLinear([1, 1, 1]);
