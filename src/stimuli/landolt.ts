/**
 * The threshold stimulus: a Landolt C drawn in confusion-line colour on a field
 * of neutral dots, after the design of the Cambridge Colour Test.
 *
 * Why a Landolt C rather than "which of these patches is different?": the
 * observer reports the *orientation of the gap*, one of four choices, so chance
 * performance is a known 25% and there is no way to score above it without
 * actually resolving the shape. A yes/no "can you see anything?" task instead
 * confounds threshold with how willing someone is to guess, which is exactly the
 * bias that makes casual online colour tests unreliable.
 *
 * The C is built from the same dot mosaic as the plates, so the figure has no
 * edge for the eye to latch onto and cannot be found by anything but colour.
 */
import { generatePlate, type FigureMask, type PlateSpec } from './plate';
import type { CvdAxis } from '../color/lms';

export const ORIENTATIONS = ['up', 'right', 'down', 'left'] as const;
export type Orientation = (typeof ORIENTATIONS)[number];

/** Gap direction in radians, measured with y pointing down as on a canvas. */
const GAP_ANGLE: Record<Orientation, number> = {
  up: -Math.PI / 2,
  right: 0,
  down: Math.PI / 2,
  left: Math.PI,
};

/** Angular half-width of the gap. A 60-degree gap is unambiguous at a glance. */
const GAP_HALF_WIDTH = Math.PI / 6;

const OUTER = 0.4;
const INNER = 0.24;

export function landoltMask(orientation: Orientation): FigureMask {
  const gap = GAP_ANGLE[orientation];
  return (x, y) => {
    const dx = x - 0.5;
    const dy = y - 0.5;
    const r = Math.hypot(dx, dy);
    if (r < INNER || r > OUTER) return false;

    let delta = Math.atan2(dy, dx) - gap;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    return Math.abs(delta) > GAP_HALF_WIDTH;
  };
}

export interface LandoltOptions {
  readonly axis: CvdAxis;
  /** Absolute displacement along the confusion line, in u'v' units. */
  readonly amplitude: number;
  readonly orientation: Orientation;
  readonly diameter: number;
  readonly seed: number;
  readonly id: string;
}

export function generateLandolt(opts: LandoltOptions): PlateSpec {
  return generatePlate({
    mode: 'standard',
    axis: opts.axis,
    answer: opts.orientation,
    amplitudeFraction: 0,
    amplitude: opts.amplitude,
    diameter: opts.diameter,
    mask: landoltMask(opts.orientation),
    seed: opts.seed,
    id: opts.id,
  });
}
