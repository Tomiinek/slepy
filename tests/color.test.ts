import { describe, expect, it } from 'vitest';
import {
  hexFromSrgb,
  linearFromSrgb,
  srgbFromHex,
  srgbFromLinear,
  relativeLuminance,
  inGamut,
} from '../src/color/srgb';
import { invert, multiply, apply, IDENTITY3 } from '../src/color/matrix';
import {
  uvFromXyz,
  xyzFromUv,
  xyzFromLinear,
  linearFromXyz,
  xyFromXyz,
  uvFromXy,
  xyFromUv,
} from '../src/color/xyz';
import { lmsFromLinear, linearFromLms, LMS_FROM_LINEAR_RGB } from '../src/color/lms';
import {
  oklabFromSrgb,
  oklabFromLinear,
  srgbFromOklab,
  deltaEOkSrgb,
  deltaChromaOk,
} from '../src/color/oklab';
import { desaturateIntoGamut } from '../src/color/gamut';
import {
  confusionDirection,
  confusionColor,
  copunctalUv,
  NEUTRAL_UV,
  ADAPT_Y,
  symmetricGamutLimit,
} from '../src/color/confusion';
import { simulateSrgb, simulateLinear, vienotMatrix } from '../src/color/cvd';
import { xyFromUv as xyFromUvAlias } from '../src/color/xyz';
import { CVD_AXES } from '../src/color/lms';

const close = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;

describe('sRGB encoding', () => {
  it('round-trips gamma encoding', () => {
    for (let i = 0; i <= 255; i++) {
      const v = i / 255;
      const back = srgbFromLinear(linearFromSrgb([v, v, v]))[0];
      expect(close(back, v, 1e-9)).toBe(true);
    }
  });

  it('round-trips hex', () => {
    for (const hex of ['#000000', '#ffffff', '#6ea8fe', '#7c7c7c', '#f2777a']) {
      expect(hexFromSrgb(srgbFromHex(hex))).toBe(hex);
    }
  });

  it('expands 3-digit hex', () => {
    expect(hexFromSrgb(srgbFromHex('#fff'))).toBe('#ffffff');
  });

  it('gives white a relative luminance of 1', () => {
    expect(close(relativeLuminance([1, 1, 1]), 1, 1e-9)).toBe(true);
  });
});

describe('matrix helpers', () => {
  it('inverts to identity', () => {
    const m = LMS_FROM_LINEAR_RGB;
    const p = multiply(m, invert(m));
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        expect(close(p[i][j], IDENTITY3[i][j], 1e-12)).toBe(true);
      }
    }
  });

  it('applies a matrix consistently with its inverse', () => {
    const v = [0.3, 0.7, 0.15] as const;
    const back = apply(invert(LMS_FROM_LINEAR_RGB), apply(LMS_FROM_LINEAR_RGB, v));
    v.forEach((c, i) => expect(close(back[i], c, 1e-12)).toBe(true));
  });
});

describe('XYZ and chromaticity', () => {
  it('round-trips linear RGB through XYZ', () => {
    const samples = [
      [1, 1, 1],
      [0.2, 0.2, 0.2],
      [0.9, 0.1, 0.35],
      [0.01, 0.5, 0.99],
    ] as const;
    for (const rgb of samples) {
      const back = linearFromXyz(xyzFromLinear(rgb));
      rgb.forEach((c, i) => expect(close(back[i], c, 1e-10)).toBe(true));
    }
  });

  it("round-trips u'v' at a fixed luminance", () => {
    const xyz = xyzFromLinear([0.6, 0.3, 0.1]);
    const uv = uvFromXyz(xyz);
    const back = xyzFromUv(uv, xyz[1]);
    xyz.forEach((c, i) => expect(close(back[i], c, 1e-10)).toBe(true));
  });

  it("agrees between the xy and u'v' conversion routes", () => {
    const xyz = xyzFromLinear([0.4, 0.8, 0.2]);
    const viaXy = uvFromXy(xyFromXyz(xyz));
    const direct = uvFromXyz(xyz);
    expect(close(viaXy[0], direct[0], 1e-12)).toBe(true);
    expect(close(viaXy[1], direct[1], 1e-12)).toBe(true);
    const xyBack = xyFromUvAlias(direct);
    const xy = xyFromXyz(xyz);
    expect(close(xyBack[0], xy[0], 1e-12)).toBe(true);
    expect(close(xyBack[1], xy[1], 1e-12)).toBe(true);
  });

  it('places D65 white near its book chromaticity', () => {
    const uv = uvFromXyz(xyzFromLinear([1, 1, 1]));
    const xy = xyFromUv(uv);
    expect(close(xy[0], 0.3127, 2e-3)).toBe(true);
    expect(close(xy[1], 0.329, 2e-3)).toBe(true);
  });
});

describe('LMS', () => {
  it('round-trips linear RGB', () => {
    const rgb = [0.3, 0.55, 0.8] as const;
    const back = linearFromLms(lmsFromLinear(rgb));
    rgb.forEach((c, i) => expect(close(back[i], c, 1e-10)).toBe(true));
  });

  it('gives all-positive cone excitations for all gamut corners', () => {
    for (const r of [0, 1]) {
      for (const g of [0, 1]) {
        for (const b of [0, 1]) {
          lmsFromLinear([r, g, b]).forEach((c) => expect(c).toBeGreaterThanOrEqual(0));
        }
      }
    }
  });
});

describe('OKLab', () => {
  it('round-trips sRGB', () => {
    for (const hex of ['#000000', '#ffffff', '#123456', '#c0ffee', '#ff0000']) {
      const rgb = srgbFromHex(hex);
      const back = srgbFromOklab(oklabFromSrgb(rgb));
      // Ottosson's forward and inverse matrices are published independently and
      // are not exact inverses, so sub-microscopic error is expected.
      rgb.forEach((c, i) => expect(close(back[i], c, 1e-6)).toBe(true));
    }
  });

  it('reports zero distance for identical colors and more for different ones', () => {
    const a = srgbFromHex('#804000');
    expect(deltaEOkSrgb(a, a)).toBeCloseTo(0, 12);
    expect(deltaEOkSrgb(srgbFromHex('#000000'), srgbFromHex('#ffffff'))).toBeGreaterThan(0.9);
  });

  it('puts white at L = 1', () => {
    expect(close(oklabFromSrgb([1, 1, 1])[0], 1, 1e-6)).toBe(true);
  });
});

describe('gamut mapping', () => {
  it('leaves in-gamut colors untouched', () => {
    const rgb = [0.2, 0.4, 0.6] as const;
    const out = desaturateIntoGamut(rgb);
    rgb.forEach((c, i) => expect(out[i]).toBe(c));
  });

  it('brings out-of-gamut colors inside while keeping luminance', () => {
    const rgb = [1.4, 0.2, -0.3] as const;
    const out = desaturateIntoGamut(rgb);
    expect(inGamut(out)).toBe(true);
    expect(close(relativeLuminance(out), relativeLuminance(rgb), 0.02)).toBe(true);
  });
});

describe('confusion lines', () => {
  it('lands near the published copunctal points', () => {
    // These are the Smith & Pokorny values quoted in the literature, derived on
    // the Judd-Vos corrected observer. We reach them through modern sRGB/CIE
    // 1931 primaries, so agreement is close but not exact -- especially for
    // deutan, whose copunctal point sits far outside the gamut where small
    // differences in the fundamentals are hugely amplified.
    const expected: Record<string, readonly [number, number, number]> = {
      protan: [0.747, 0.253, 0.05],
      deutan: [1.4, -0.4, 0.6],
      tritan: [0.171, 0.0, 0.05],
    };
    for (const axis of CVD_AXES) {
      const xy = xyFromUv(copunctalUv(axis));
      const [ex, ey, tol] = expected[axis];
      expect(close(xy[0], ex, tol)).toBe(true);
      expect(close(xy[1], ey, tol)).toBe(true);
    }
  });

  it('produces a unit direction vector', () => {
    for (const axis of CVD_AXES) {
      const d = confusionDirection(axis, NEUTRAL_UV, ADAPT_Y);
      expect(close(Math.hypot(d[0], d[1]), 1, 1e-9)).toBe(true);
    }
  });

  it('gives protan and deutan similar but distinct directions', () => {
    // This asymmetry is the whole basis for telling protan from deutan, so if it
    // ever collapses the classifier silently loses its type discrimination.
    const p = confusionDirection('protan', NEUTRAL_UV, ADAPT_Y);
    const d = confusionDirection('deutan', NEUTRAL_UV, ADAPT_Y);
    const cos = Math.abs(p[0] * d[0] + p[1] * d[1]);
    expect(cos).toBeGreaterThan(0.9);
    expect(cos).toBeLessThan(0.9999);
  });

  it('gives tritan a direction well separated from the red-green axes', () => {
    const p = confusionDirection('protan', NEUTRAL_UV, ADAPT_Y);
    const t = confusionDirection('tritan', NEUTRAL_UV, ADAPT_Y);
    expect(Math.abs(p[0] * t[0] + p[1] * t[1])).toBeLessThan(0.8);
  });

  it('keeps stimulus luminance unchanged', () => {
    for (const axis of CVD_AXES) {
      const c = confusionColor({
        axis,
        backgroundUv: NEUTRAL_UV,
        Y: ADAPT_Y,
        amplitude: 0.01,
        sign: 1,
      });
      const Y = xyzFromLinear(linearFromSrgb(c))[1];
      expect(close(Y, ADAPT_Y, 1e-9)).toBe(true);
    }
  });

  it('finds a usable gamut limit on every axis', () => {
    for (const axis of CVD_AXES) {
      const limit = symmetricGamutLimit(axis, NEUTRAL_UV, ADAPT_Y);
      expect(limit).toBeGreaterThan(0.01);
      expect(limit).toBeLessThan(0.35);
    }
  });
});

describe('CVD simulation', () => {
  it('leaves colors alone at zero severity', () => {
    const rgb = srgbFromHex('#c0392b');
    for (const axis of CVD_AXES) {
      const out = simulateSrgb(rgb, { axis, severity: 0 });
      rgb.forEach((c, i) => expect(close(out[i], c, 1e-12)).toBe(true));
    }
  });

  it('leaves neutral greys unchanged for every deficiency', () => {
    for (const axis of CVD_AXES) {
      for (const v of [0.1, 0.35, 0.7]) {
        const out = simulateSrgb([v, v, v], { axis, severity: 1 });
        out.forEach((c) => expect(close(c, v, 0.01)).toBe(true));
      }
    }
  });

  it('collapses a confusion pair chromatically for its own deficiency', () => {
    for (const axis of CVD_AXES) {
      const { bg, fg } = confusionPair(axis);

      // Clearly visible to a normal observer...
      expect(deltaEOkSrgb(bg, fg)).toBeGreaterThan(0.05);

      // ...and chromatically identical for the matching dichromat.
      const simBg = simulateSrgb(bg, { axis, severity: 1 });
      const simFg = simulateSrgb(fg, { axis, severity: 1 });
      expect(deltaChromaOk(oklabFromSrgb(simBg), oklabFromSrgb(simFg))).toBeLessThan(1e-4);
    }
  });

  it('leaves a residual lightness cue that only luminance noise can mask', () => {
    // Our stimuli hold *normal-observer* luminance constant, but a dichromat's
    // luminous efficiency differs from a normal observer's, so a confusion pair
    // that is chromatically identical to them is still not quite equally bright.
    // This is exactly why pseudoisochromatic plates must randomise dot
    // luminance: without noise, an observer could pass by brightness alone.
    const residual = (axis: (typeof CVD_AXES)[number]) => {
      const { bg, fg } = confusionPair(axis);
      const a = oklabFromSrgb(simulateSrgb(bg, { axis, severity: 1 }));
      const b = oklabFromSrgb(simulateSrgb(fg, { axis, severity: 1 }));
      return Math.abs(a[0] - b[0]);
    };

    for (const axis of CVD_AXES) expect(residual(axis)).toBeGreaterThan(0);

    // Protans lose the most long-wavelength luminance, so their residual is the
    // largest. This asymmetry is what the red-luminance probe exploits to tell
    // protan from deutan.
    expect(residual('protan')).toBeGreaterThan(residual('deutan'));
    expect(residual('deutan')).toBeGreaterThan(residual('tritan'));
  });

  it('is monotonic in severity', () => {
    const rgb = srgbFromHex('#2e8b57');
    let prev = 0;
    for (const severity of [0.2, 0.4, 0.6, 0.8, 1]) {
      const d = deltaEOkSrgb(rgb, simulateSrgb(rgb, { axis: 'deutan', severity }));
      expect(d).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = d;
    }
  });

  it('agrees with the Vienot matrix for mid-gamut colors', () => {
    for (const axis of ['protan', 'deutan'] as const) {
      const m = vienotMatrix({ axis, severity: 1 });
      for (const hex of ['#888844', '#4488aa', '#7c7c7c', '#a06050']) {
        const lin = linearFromSrgb(srgbFromHex(hex));
        const brettel = oklabFromLinear(simulateLinear(lin, { axis, severity: 1 }));
        const vienot = oklabFromLinear(apply(m, lin));
        expect(deltaChromaOk(brettel, vienot)).toBeLessThan(0.04);
      }
    }
  });

  it('diverges from the Vienot matrix on saturated blue, as documented', () => {
    // Guard rail: Vienot 1999 collapses the red and green output rows, which is
    // badly wrong at the gamut edges. Nothing that measures or reports anything
    // may use it -- only Brettel. If this ever starts passing at a small
    // tolerance, the matrices have been mixed up somewhere.
    const lin = linearFromSrgb(srgbFromHex('#0000ff'));
    const brettel = oklabFromLinear(simulateLinear(lin, { axis: 'protan', severity: 1 }));
    const vienot = oklabFromLinear(apply(vienotMatrix({ axis: 'protan', severity: 1 }), lin));
    expect(deltaChromaOk(brettel, vienot)).toBeGreaterThan(0.5);
  });
});

function confusionPair(axis: (typeof CVD_AXES)[number]) {
  const amplitude = symmetricGamutLimit(axis, NEUTRAL_UV, ADAPT_Y) * 0.8;
  const at = (a: number) =>
    confusionColor({ axis, backgroundUv: NEUTRAL_UV, Y: ADAPT_Y, amplitude: a, sign: 1 });
  return { bg: at(0), fg: at(amplitude) };
}
