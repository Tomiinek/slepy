/**
 * Procedural pseudoisochromatic plates.
 *
 * These are the "Ishihara-style" dotted plates, but generated rather than
 * scanned. That buys three things the printed originals cannot give us:
 *
 *  1. No copyright entanglement, and nothing that can be looked up or memorised,
 *     because the dot layout and the digits are different on every run.
 *  2. The chromatic difference between figure and background is a free
 *     parameter, so a plate set can sweep amplitude and actually *grade*
 *     severity instead of only detecting it.
 *  3. Figure and background are placed on a confusion line computed from the
 *     same cone fundamentals the simulator uses, so "invisible to a deuteranope"
 *     is a property we can assert in a unit test rather than hope for.
 *
 * Every dot's luminance is randomised. Without that, a confusion pair still
 * carries a residual brightness difference for the affected observer (see the
 * colour test suite), and they could read the digit by brightness alone.
 */
import {
  ADAPT_Y,
  NEUTRAL_UV,
  confusionDirection,
  symmetricGamutLimit,
  type Uv2,
} from '../color/confusion';
import type { CvdAxis } from '../color/lms';
import { simulateLinear, type Deficiency } from '../color/cvd';
import { desaturateIntoGamut } from '../color/gamut';
import { hexFromLinear, hexFromSrgb, relativeLuminance, type Srgb } from '../color/srgb';
import { linearFromXyz, xyzFromUv, type Uv } from '../color/xyz';
import { makeRng, type Rng } from '../util/rng';

export type PlateMode =
  /** Figure sits on a confusion line: invisible to the matching deficiency. */
  | 'standard'
  /** Figure differs along a direction everyone can see. Catches inattention. */
  | 'control'
  /**
   * Figure carried by a cue red-green observers keep, buried under red-green
   * noise they cannot see. Easy for them, camouflaged for everyone else.
   */
  | 'hiddenDigit';

export interface PlateDot {
  readonly x: number;
  readonly y: number;
  readonly r: number;
  readonly figure: boolean;
  /** Per-dot luminance multiplier, the masking noise. */
  readonly lum: number;
  /**
   * Per-dot position along the decoy chromatic axis, only used by hidden-digit
   * plates. Range -1..1.
   */
  readonly decoy: number;
}

export interface PlateSpec {
  readonly id: string;
  readonly mode: PlateMode;
  readonly axis: CvdAxis;
  /** The answer, as a string of digits. */
  readonly answer: string;
  /** Displacement along the confusion line, in raw u'v' units. */
  readonly amplitude: number;
  /** Fraction of the gamut-limited maximum, for reporting. */
  readonly amplitudeFraction: number;
  readonly diameter: number;
  readonly dots: readonly PlateDot[];
  readonly seed: number;
}

/** Luminance noise depth. +/-22% is enough to swamp the residual cue. */
const LUM_JITTER = 0.22;

/**
 * How the noise budget is split between the fixed per-dot offset and the drifting
 * component. They add, so the two shares sum to 1 and the total stays inside
 * LUM_JITTER -- which the gamut headroom in `plateGamutLimit` assumes.
 */
const STATIC_NOISE_SHARE = 0.7;
const DRIFT_NOISE_SHARE = 0.3;

/**
 * How much luminance noise each plate mode wants, as a fraction of LUM_JITTER.
 *
 * Standard plates need the full amount: their whole validity rests on the figure
 * being carried by chromaticity alone, and a confusion pair still differs
 * slightly in brightness for the affected observer.
 *
 * Control plates carry the figure *in* luminance, so noise would fight the cue.
 * Hidden-digit plates likewise, and there the camouflage comes from chromatic
 * decoy noise instead -- adding luminance noise would hide the digit from the
 * very observers who are supposed to read it.
 */
const NOISE_DEPTH: Record<PlateMode, number> = {
  standard: 1,
  control: 0.25,
  hiddenDigit: 0,
};

/** Luminance ratio between figure and ground where the figure is achromatic. */
const CONTROL_LUM_STEP = 1.5;
const HIDDEN_LUM_STEP = 1.18;

/**
 * The gaps between dots, inside the plate disc.
 *
 * This has to differ from the dots' mean luminance, and originally it did not:
 * the disc was filled with the same grey as the adaptation field, which is also
 * the dots' mean level. On standard plates the full-depth luminance noise hid the
 * problem, but on control plates -- where the noise is deliberately shallow so it
 * does not fight the luminance cue -- the background dots became invisible and
 * the figure appeared to float in an empty circle. Which destroys the point of a
 * control plate: it should look like every other plate to anyone who cannot read
 * the figure.
 *
 * Printed plates get this for free from white paper showing between the dots.
 * Going darker rather than lighter keeps the surround as the brightest large area
 * so the observer stays adapted to it, and avoids a glary white disc.
 */
const GAP_Y_RATIO = 0.45;

/**
 * Amplitude has to stay inside the gamut at the *brightest* jittered luminance,
 * not just at the mean, or the brightest dots would clip and betray the figure.
 */
function safeAmplitude(axis: CvdAxis, fraction: number): number {
  return plateGamutLimit(axis) * fraction;
}

export function plateGamutLimit(axis: CvdAxis): number {
  const brightestY = ADAPT_Y * (1 + LUM_JITTER);
  return Math.min(
    symmetricGamutLimit(axis, NEUTRAL_UV, ADAPT_Y),
    symmetricGamutLimit(axis, NEUTRAL_UV, brightestY),
  );
}

/**
 * A mask decides which dots belong to the figure. In the browser this comes from
 * rasterising digits to an offscreen canvas; the tests pass simple analytic
 * shapes. Coordinates are normalised to 0..1 across the plate.
 */
export type FigureMask = (x: number, y: number) => boolean;

export interface PlateOptions {
  readonly mode: PlateMode;
  readonly axis: CvdAxis;
  readonly answer: string;
  /** 0..1 of the gamut-limited maximum displacement. */
  readonly amplitudeFraction: number;
  /**
   * Absolute displacement in u'v' units, overriding `amplitudeFraction`. The
   * threshold staircase works in absolute units because that is what gets
   * reported and compared against normative data.
   */
  readonly amplitude?: number;
  readonly diameter: number;
  readonly mask: FigureMask;
  readonly seed: number;
  readonly id: string;
}

export function generatePlate(opts: PlateOptions): PlateSpec {
  const rng = makeRng(opts.seed);
  return {
    ...plateColorSpec(opts),
    diameter: opts.diameter,
    dots: packDots(opts.diameter, rng, opts.mask),
  };
}

/**
 * Everything about a plate except its geometry.
 *
 * Whether an observer can read a plate is decided entirely by the figure and
 * ground colours, so anything that only needs to reason about visibility -- the
 * synthetic-observer harness, most of the test suite -- can use this and skip
 * generating fourteen hundred dots it will never look at.
 */
export function plateColorSpec(
  opts: Omit<PlateOptions, 'diameter' | 'mask'> & { diameter?: number },
): PlateSpec {
  const limit = plateGamutLimit(opts.axis);
  const amplitude =
    opts.amplitude !== undefined
      ? Math.min(opts.amplitude, limit)
      : safeAmplitude(opts.axis, opts.amplitudeFraction);

  return {
    id: opts.id,
    mode: opts.mode,
    axis: opts.axis,
    answer: opts.answer,
    amplitude,
    amplitudeFraction: limit > 0 ? amplitude / limit : 0,
    diameter: opts.diameter ?? 0,
    dots: [],
    seed: opts.seed,
  };
}

/**
 * Circle packing by greedy largest-disc insertion.
 *
 * Two earlier approaches failed in ways worth recording. A jittered hex lattice
 * gave good density but capped each dot's jitter at its own slack, so high
 * coverage meant large dots pinned to their lattice points -- and a visible grid
 * is fatal here, because a regular texture hands the eye a non-chromatic
 * structure to lock onto. Poisson-disc sampling with each dot sized from its
 * nearest neighbour looked right but reached only 46% coverage.
 *
 * The reason is a fact about packing rather than a bug: equal discs dropped at
 * random saturate near 55% coverage no matter how long you try. Printed plates
 * are far denser than that, and they achieve it with a wide *range* of dot sizes
 * -- big dots with progressively smaller ones tucked into the gaps.
 *
 * So each candidate position takes the largest radius that still clears its
 * neighbours, `min(distance - r_j)`, capped. Early candidates land in open space
 * and come out large; later ones only fit in the interstices and come out small.
 * That reproduces the printed size distribution as a consequence of the
 * algorithm rather than as a tuned parameter, reaches about 70% coverage, and is
 * non-overlapping by construction -- the radius is chosen so it cannot overlap,
 * and existing dots never change.
 *
 * The small dots earn their place twice over: they also let the figure edge
 * follow a digit's curves instead of stair-stepping across it.
 */
function packDots(diameter: number, rng: Rng, mask: FigureMask): PlateDot[] {
  const radius = diameter / 2;
  const inset = diameter * 0.006;

  const rMax = diameter * 0.0165;
  // Below about a fifth of the largest dot, dots stop reading as dots and start
  // looking like print noise.
  const rMin = rMax * 0.22;

  const grid = new CircleGrid(diameter, rMax * 2);
  const dots: PlateDot[] = [];

  // Enough attempts to saturate: once the plate is full almost everything is
  // rejected, so the cost is a grid lookup per attempt rather than a placement.
  const ATTEMPTS = 26000;
  for (let i = 0; i < ATTEMPTS; i++) {
    const angle = rng.next() * Math.PI * 2;
    const dist = Math.sqrt(rng.next()) * (radius - inset);
    const x = radius + Math.cos(angle) * dist;
    const y = radius + Math.sin(angle) * dist;

    // Largest radius that clears every neighbour and stays inside the disc.
    let r = Math.min(rMax, radius - inset - Math.hypot(x - radius, y - radius));
    grid.forEachNear({ x, y }, (q) => {
      const room = Math.hypot(q.x - x, q.y - y) - q.r;
      if (room < r) r = room;
    });

    // A hairline gap, so touching dots stay visually separate.
    r *= 0.97;
    if (r < rMin) continue;

    const dot: PlateDot = {
      x,
      y,
      r,
      figure: mask(x / diameter, y / diameter),
      // Bounded on purpose. A Gaussian draw here reached +/-47% at the tails,
      // which showed up as near-black and near-white dots -- visually blotchy,
      // and wide enough that the brightest dots risked clipping the figure
      // colour out of gamut and betraying it.
      lum: 1 + rng.range(-1, 1) * LUM_JITTER * STATIC_NOISE_SHARE,
      decoy: rng.range(-1, 1),
    };
    dots.push(dot);
    grid.insert(dot);
  }

  return dots;
}

interface Circle {
  readonly x: number;
  readonly y: number;
  readonly r: number;
}

/**
 * Uniform bucket grid over the plate. Packing is dominated by "what is near this
 * point", and scanning the whole dot list per attempt made plate generation the
 * slowest thing in the app.
 *
 * Cells are sized at the largest possible dot diameter, so two dots can only
 * touch if they are in adjacent cells and a single ring of neighbours is always
 * enough to find every possible contact.
 */
class CircleGrid {
  private readonly cell: number;
  private readonly cols: number;
  private readonly buckets: Circle[][];

  constructor(extent: number, cell: number) {
    this.cell = cell;
    this.cols = Math.ceil(extent / cell) + 2;
    this.buckets = Array.from({ length: this.cols * this.cols }, () => []);
  }

  insert(c: Circle): void {
    const gx = Math.min(this.cols - 1, Math.max(0, Math.floor(c.x / this.cell)));
    const gy = Math.min(this.cols - 1, Math.max(0, Math.floor(c.y / this.cell)));
    this.buckets[gx + gy * this.cols].push(c);
  }

  forEachNear(p: { x: number; y: number }, visit: (c: Circle) => void): void {
    const gx = Math.floor(p.x / this.cell);
    const gy = Math.floor(p.y / this.cell);
    for (let ny = gy - 1; ny <= gy + 1; ny++) {
      if (ny < 0 || ny >= this.cols) continue;
      for (let nx = gx - 1; nx <= gx + 1; nx++) {
        if (nx < 0 || nx >= this.cols) continue;
        for (const c of this.buckets[nx + ny * this.cols]) visit(c);
      }
    }
  }
}

/**
 * Colour for one dot. Kept as a standalone pure function so the test suite can
 * verify the actual rendered colours, not a reimplementation of them.
 *
 * `noisePhase` shifts the luminance noise so the renderer can animate it;
 * dynamic noise defeats luminance cues considerably better than a static field.
 */
export function plateDotColor(spec: PlateSpec, dot: PlateDot, noisePhase = 0): Srgb {
  const depth = NOISE_DEPTH[spec.mode];
  const drift = Math.sin((dot.x + dot.y) * 0.7 + noisePhase) * LUM_JITTER * DRIFT_NOISE_SHARE;
  const lum = clampLum(1 + ((dot.lum - 1) + drift) * depth);
  const Y = ADAPT_Y * lum;

  if (spec.mode === 'hiddenDigit') {
    // The digit is carried by a luminance step, which every colour deficiency
    // retains. The camouflage is a large per-dot displacement along a red-green
    // confusion line: loud and attention-grabbing for a normal observer, and
    // literally invisible to a red-green deficient one, who is therefore left
    // with the luminance step as the only structure on the plate.
    const decoyAxis: CvdAxis = spec.axis === 'tritan' ? 'deutan' : spec.axis;
    const decoyAmp = safeAmplitude(decoyAxis, 0.85) * dot.decoy;
    const step = dot.figure ? HIDDEN_LUM_STEP : 1;
    return colorAt(displaced(decoyAxis, decoyAmp, Y * step), Y * step);
  }

  if (spec.mode === 'control') {
    // The figure is a plain luminance step. Chromatic cues are useless here
    // because no single chromatic direction is visible to all three
    // deficiencies -- a tritan-axis figure would be invisible to a tritanope,
    // and a red-green figure invisible to a deuteranope. Luminance survives
    // every deficiency, including complete monochromacy, so this plate is
    // readable by definition and a miss means the display or the instructions
    // are wrong rather than the observer's colour vision.
    const step = dot.figure ? CONTROL_LUM_STEP : 1;
    return colorAt(NEUTRAL_UV, Y * step);
  }

  // Standard plate: figure is displaced along the confusion line, background
  // sits on the neutral point. The figure's luminance is corrected so the pair
  // is isoluminant *for the observer it is meant to hide from*, not merely for a
  // normal observer -- see `dichromatIsoluminantRatio`.
  if (!dot.figure) return colorAt(NEUTRAL_UV, Y);
  const ratio = dichromatIsoluminantRatio(spec.axis, spec.amplitude);
  return colorAt(displaced(spec.axis, spec.amplitude, Y), Y * ratio);
}

/**
 * Luminance ratio that makes a confusion pair equally bright for a dichromat of
 * the given type.
 *
 * Holding luminance constant for a *normal* observer is the obvious thing to do
 * and it is not good enough. The affected observer's luminous efficiency differs
 * from a normal observer's, so a pair that is chromatically invisible to them is
 * still not quite equally bright -- for a protan the residual reaches about 0.026
 * in OKLab lightness, which is above a just-noticeable difference. Luminance
 * noise buries it, but only by a factor of three or so, and an observer can beat
 * noise by pooling across hundreds of dots. Far better to remove the cue itself.
 *
 * Because simulation is a linear map and a colour of chromaticity `uv` at
 * luminance Y is just Y times that colour at unit luminance, the correction is
 * exact and closed-form: scale the figure by the ratio of the two colours'
 * perceived luminance per unit displayed luminance.
 *
 * A normal observer is left with a small luminance difference on top of the
 * chromatic one, which only helps them read a plate they are supposed to read.
 */
function dichromatIsoluminantRatio(axis: CvdAxis, amplitude: number): number {
  const key = `${axis}|${amplitude}`;
  const cached = isoluminantCache.get(key);
  if (cached !== undefined) return cached;

  const vision: Deficiency = { axis, severity: 1 };
  const perceivedPerUnit = (uv: Uv) => {
    const unit = linearFromXyz(xyzFromUv(uv, 1));
    return relativeLuminance(simulateLinear(unit, vision));
  };

  const figure = perceivedPerUnit(displaced(axis, amplitude, ADAPT_Y));
  const ratio = figure > 0 ? perceivedPerUnit(NEUTRAL_UV) / figure : 1;

  isoluminantCache.set(key, ratio);
  return ratio;
}

const isoluminantCache = new Map<string, number>();

function displaced(axis: CvdAxis, amplitude: number, Y: number): Uv {
  if (amplitude === 0) return NEUTRAL_UV;
  const d = confusionDirection(axis, NEUTRAL_UV, Y);
  return [NEUTRAL_UV[0] + d[0] * amplitude, NEUTRAL_UV[1] + d[1] * amplitude];
}

function colorAt(uv: Uv, Y: number): Srgb {
  const linear = desaturateIntoGamut(linearFromXyz(xyzFromUv(uv, Y)));
  // Round-trip through hex so what the tests see is exactly what a canvas paints
  // (8-bit quantisation included, which matters at small amplitudes).
  return hexToSrgb(hexFromLinear(linear));
}

function hexToSrgb(hex: string): Srgb {
  return [
    parseInt(hex.slice(1, 3), 16) / 255,
    parseInt(hex.slice(3, 5), 16) / 255,
    parseInt(hex.slice(5, 7), 16) / 255,
  ];
}

function clampLum(v: number): number {
  const lo = 1 - LUM_JITTER;
  const hi = 1 + LUM_JITTER;
  return v < lo ? lo : v > hi ? hi : v;
}

export function plateDotHex(spec: PlateSpec, dot: PlateDot, noisePhase = 0): string {
  return hexFromSrgb(plateDotColor(spec, dot, noisePhase));
}

/** Colour of the gaps between dots, inside the disc. See `GAP_Y_RATIO`. */
export const PLATE_GAP: Srgb = colorAt(NEUTRAL_UV, ADAPT_Y * GAP_Y_RATIO);

export type { Uv2 };
export { LUM_JITTER };
