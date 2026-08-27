import { describe, expect, it } from 'vitest';
import {
  generatePlate,
  plateDotColor,
  plateGamutLimit,
  type FigureMask,
  type PlateMode,
} from '../src/stimuli/plate';
import { buildPlateSet } from '../src/stimuli/plateSet';
import { simulateSrgb } from '../src/color/cvd';
import { deltaEOkSrgb, oklabFromSrgb, deltaChromaOk } from '../src/color/oklab';
import { CVD_AXES, type CvdAxis } from '../src/color/lms';

/** Left half is figure, right half is background. Simple and deterministic. */
const halfMask: FigureMask = (x) => x < 0.5;

function plate(axis: CvdAxis, amplitudeFraction: number, mode: PlateMode = 'standard') {
  return generatePlate({
    mode,
    axis,
    answer: '42',
    amplitudeFraction,
    diameter: 400,
    mask: halfMask,
    seed: 12345,
    id: 'test',
  });
}

describe('plate geometry', () => {
  it('packs a dense, non-overlapping mosaic inside the disc', () => {
    const spec = plate('deutan', 0.9);
    expect(spec.dots.length).toBeGreaterThan(800);

    const r = spec.diameter / 2;
    for (const d of spec.dots) {
      expect(Math.hypot(d.x - r, d.y - r) + d.r).toBeLessThanOrEqual(r);
    }
  });

  /**
   * The regression this guards against was invisible to every other test: the
   * plate generated fine, dots did not overlap, colours were correct, and it
   * still looked wrong -- a washed-out scatter rather than a mosaic, because the
   * dots covered only 42% of the disc. Printed plates sit around 70%. Below
   * roughly 60% the background shows through enough to dilute the figure.
   */
  it('covers most of the disc area', () => {
    const spec = plate('deutan', 0.9);
    const discArea = Math.PI * (spec.diameter / 2) ** 2;
    const dotArea = spec.dots.reduce((sum, d) => sum + Math.PI * d.r ** 2, 0);
    expect(dotArea / discArea).toBeGreaterThan(0.6);
  });

  it('varies dot size over a wide range, as printed plates do', () => {
    const spec = plate('deutan', 0.9);
    const radii = spec.dots.map((d) => d.r);
    // The small dots are what keep the figure edge from stair-stepping.
    expect(Math.min(...radii) / Math.max(...radii)).toBeLessThan(0.4);
  });

  it('does not overlap dots', () => {
    const spec = plate('deutan', 0.9);
    // Spot-check against a spatial subset; a full O(n^2) sweep is wasteful.
    const sample = spec.dots.slice(0, 400);
    for (let i = 0; i < sample.length; i++) {
      for (let j = i + 1; j < sample.length; j++) {
        const a = sample[i];
        const b = sample[j];
        const gap = Math.hypot(a.x - b.x, a.y - b.y) - (a.r + b.r);
        expect(gap).toBeGreaterThan(-1e-9);
      }
    }
  });

  it('splits dots between figure and background per the mask', () => {
    const spec = plate('deutan', 0.9);
    const figure = spec.dots.filter((d) => d.figure).length;
    expect(figure).toBeGreaterThan(spec.dots.length * 0.3);
    expect(figure).toBeLessThan(spec.dots.length * 0.7);
    for (const d of spec.dots) {
      expect(d.figure).toBe(d.x / spec.diameter < 0.5);
    }
  });

  it('is reproducible from its seed', () => {
    const a = plate('protan', 0.5);
    const b = plate('protan', 0.5);
    expect(a.dots.length).toBe(b.dots.length);
    expect(a.dots[100]).toEqual(b.dots[100]);
  });

  /**
   * The luminance noise has to stay inside its stated budget. An unbounded
   * Gaussian draw here reached +/-47%, which looked blotchy and, worse, left the
   * brightest dots close enough to the gamut edge that the figure colour could
   * clip and give the figure away.
   */
  it('keeps luminance noise within its budget', () => {
    const spec = plate('deutan', 0.9);
    for (const dot of spec.dots) {
      expect(Math.abs(dot.lum - 1)).toBeLessThanOrEqual(0.22);
    }

    // And it must actually vary, or there is no masking at all.
    const spread = Math.max(...spec.dots.map((d) => d.lum)) -
      Math.min(...spec.dots.map((d) => d.lum));
    expect(spread).toBeGreaterThan(0.15);
  });
});

describe('plate colours', () => {
  it('keeps every dot inside the displayable gamut', () => {
    for (const axis of CVD_AXES) {
      const spec = plate(axis, 1);
      for (const phase of [0, 1.5, 3]) {
        for (const d of spec.dots.slice(0, 300)) {
          for (const c of plateDotColor(spec, d, phase)) {
            expect(c).toBeGreaterThanOrEqual(0);
            expect(c).toBeLessThanOrEqual(1);
          }
        }
      }
    }
  });

  it('hides the figure from the matching deficiency but shows it to others', () => {
    for (const axis of CVD_AXES) {
      const spec = plate(axis, 0.9);
      const figure = spec.dots.find((d) => d.figure)!;
      const ground = spec.dots.find((d) => !d.figure)!;

      // Compare at identical luminance noise so we isolate the chromatic cue,
      // which is the thing the plate is supposed to be carrying.
      const fixed = { ...figure, lum: 1, decoy: 0, x: 0, y: 0 };
      const fixedGround = { ...ground, lum: 1, decoy: 0, x: 0, y: 0, figure: false };

      const fg = plateDotColor(spec, fixed);
      const bg = plateDotColor(spec, fixedGround);

      // A normal observer sees a clear difference.
      expect(deltaEOkSrgb(fg, bg)).toBeGreaterThan(0.02);

      // The matching dichromat sees no chromatic difference at all.
      const simFg = simulateSrgb(fg, { axis, severity: 1 });
      const simBg = simulateSrgb(bg, { axis, severity: 1 });
      expect(deltaChromaOk(oklabFromSrgb(simFg), oklabFromSrgb(simBg))).toBeLessThan(2e-3);
    }
  });

  it('makes the control plate visible to every deficiency', () => {
    // If this ever failed, a dichromat could not verify their display was set up
    // correctly, and we would have no way to distinguish "cannot see it" from
    // "did not understand the task".
    for (const plateAxis of CVD_AXES) {
      const spec = plate(plateAxis, 0.9, 'control');
      const fixed = { ...spec.dots.find((d) => d.figure)!, lum: 1, decoy: 0, x: 0, y: 0 };
      const fixedGround = {
        ...spec.dots.find((d) => !d.figure)!,
        lum: 1,
        decoy: 0,
        x: 0,
        y: 0,
        figure: false,
      };
      const fg = plateDotColor(spec, fixed);
      const bg = plateDotColor(spec, fixedGround);

      for (const observerAxis of CVD_AXES) {
        const simFg = simulateSrgb(fg, { axis: observerAxis, severity: 1 });
        const simBg = simulateSrgb(bg, { axis: observerAxis, severity: 1 });
        expect(deltaEOkSrgb(simFg, simBg)).toBeGreaterThan(0.015);
      }
    }
  });

  it('gives hidden-digit plates a cue that survives red-green deficiency', () => {
    const spec = plate('deutan', 0, 'hiddenDigit');
    const base = { lum: 1, decoy: 0.9, x: 0, y: 0, r: 4 } as const;
    const fg = plateDotColor(spec, { ...base, figure: true });
    const bg = plateDotColor(spec, { ...base, figure: false });

    // The figure cue is a luminance step, so it survives the projection.
    const simFg = simulateSrgb(fg, { axis: 'deutan', severity: 1 });
    const simBg = simulateSrgb(bg, { axis: 'deutan', severity: 1 });
    expect(deltaEOkSrgb(simFg, simBg)).toBeGreaterThan(0.01);
  });

  it('buries the hidden digit under chromatic noise a normal observer sees', () => {
    const spec = plate('deutan', 0, 'hiddenDigit');
    // Two background dots at opposite ends of the decoy axis must differ far
    // more, for a normal observer, than a figure/ground pair does. That contrast
    // in salience is what camouflages the digit.
    const at = (decoy: number, figure: boolean) =>
      plateDotColor(spec, { lum: 1, decoy, x: 0, y: 0, r: 4, figure });

    const decoySpread = deltaEOkSrgb(at(-1, false), at(1, false));
    const figureCue = deltaEOkSrgb(at(0, false), at(0, true));
    expect(decoySpread).toBeGreaterThan(figureCue * 2);

    // ...and that noise is invisible to the deficiency it targets.
    const simA = simulateSrgb(at(-1, false), { axis: 'deutan', severity: 1 });
    const simB = simulateSrgb(at(1, false), { axis: 'deutan', severity: 1 });
    expect(deltaChromaOk(oklabFromSrgb(simA), oklabFromSrgb(simB))).toBeLessThan(2e-3);
  });

  it('scales chromatic difference with the amplitude ladder', () => {
    let previous = Infinity;
    for (const fraction of [0.9, 0.62, 0.42, 0.28, 0.18]) {
      const spec = plate('deutan', fraction);
      const fixed = { lum: 1, decoy: 0, x: 0, y: 0, r: 4 };
      const d = deltaEOkSrgb(
        plateDotColor(spec, { ...fixed, figure: true }),
        plateDotColor(spec, { ...fixed, figure: false }),
      );
      expect(d).toBeLessThan(previous);
      previous = d;
    }
  });

  it('leaves the target observer no brightness cue at all', () => {
    // The instrument's validity rests on this. Holding luminance constant for a
    // *normal* observer is not enough, because the affected observer's luminous
    // efficiency differs and a residual brightness step survives -- and an
    // observer can beat luminance noise by pooling across hundreds of dots. The
    // figure is therefore made isoluminant for the deficiency it hides from, so
    // there is no systematic cue left to pool.
    for (const axis of CVD_AXES) {
      const spec = plate(axis, 0.9);
      const fixed = { lum: 1, decoy: 0, x: 0, y: 0, r: 4 } as const;

      const seen = (figure: boolean) =>
        oklabFromSrgb(
          simulateSrgb(plateDotColor(spec, { ...fixed, figure }), { axis, severity: 1 }),
        );

      const residual = Math.abs(seen(true)[0] - seen(false)[0]);

      // Only 8-bit quantisation should remain.
      expect(residual).toBeLessThan(3e-3);

      // And the noise is still far larger, as a second line of defence.
      const lightnesses = spec.dots
        .filter((d) => !d.figure)
        .slice(0, 400)
        .map((d) => oklabFromSrgb(plateDotColor(spec, d))[0]);
      expect(Math.max(...lightnesses) - Math.min(...lightnesses)).toBeGreaterThan(
        residual * 10,
      );
    }
  });

  it('has a usable gamut limit on every axis', () => {
    for (const axis of CVD_AXES) {
      expect(plateGamutLimit(axis)).toBeGreaterThan(0.02);
    }
  });
});

describe('plate set', () => {
  it('opens and closes with a control plate', () => {
    const set = buildPlateSet(99);
    expect(set[0].mode).toBe('control');
    expect(set[set.length - 1].mode).toBe('control');
  });

  it('covers all three axes plus hidden-digit plates', () => {
    const set = buildPlateSet(99);
    const standard = set.filter((p) => p.mode === 'standard');
    for (const axis of CVD_AXES) {
      expect(standard.some((p) => p.axis === axis)).toBe(true);
    }
    expect(set.filter((p) => p.mode === 'hiddenDigit').length).toBe(2);
  });

  it('uses a distinct answer for every plate', () => {
    const set = buildPlateSet(99);
    expect(new Set(set.map((p) => p.answer)).size).toBe(set.length);
  });

  it('does not present the difficulty ladder in order', () => {
    const set = buildPlateSet(7);
    const deutan = set.filter((p) => p.mode === 'standard' && p.axis === 'deutan');
    const descending = deutan.every(
      (p, i) => i === 0 || p.amplitudeFraction <= deutan[i - 1].amplitudeFraction,
    );
    expect(descending).toBe(false);
  });

  it('is reproducible from the session seed', () => {
    expect(buildPlateSet(4242)).toEqual(buildPlateSet(4242));
    expect(buildPlateSet(4242)).not.toEqual(buildPlateSet(4243));
  });
});
