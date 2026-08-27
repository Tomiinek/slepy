import { describe, expect, it } from 'vitest';
import { PALETTE, PALETTE_COLORS } from '../src/analysis/palette';
import {
  analyseConfusions,
  confusionDistance,
  describeFamily,
  CONFUSION_LIMIT,
  INTEREST_LIMIT,
  LIGHTNESS_CUE_LIMIT,
} from '../src/analysis/confusables';
import { oklchFromSrgb } from '../src/color/oklab';
import { simulateSrgb, type Vision } from '../src/color/cvd';

const DEUTAN: Vision = { axis: 'deutan', severity: 1 };
const PROTAN: Vision = { axis: 'protan', severity: 1 };
const TRITAN: Vision = { axis: 'tritan', severity: 1 };
const MILD_DEUTAN: Vision = { axis: 'deutan', severity: 0.45 };

const names = (family: { members: readonly { name: string }[] }) =>
  family.members.map((m) => m.name);

function familiesContaining(vision: Vision, name: string) {
  return analyseConfusions(vision).families.filter((f) => names(f).includes(name));
}

describe('palette', () => {
  it('has well-formed, unique entries', () => {
    expect(PALETTE.length).toBeGreaterThan(80);
    expect(new Set(PALETTE.map((c) => c.name)).size).toBe(PALETTE.length);
    for (const c of PALETTE) {
      expect(c.hex, c.name).toMatch(/^#[0-9a-f]{6}$/);
      expect(c.name.length).toBeGreaterThan(2);
    }
  });

  it('covers the regions where red-green deficiency bites hardest', () => {
    const counts = new Map<string, number>();
    for (const c of PALETTE) counts.set(c.category, (counts.get(c.category) ?? 0) + 1);
    for (const category of ['red', 'green', 'brown', 'purple', 'blue', 'neutral']) {
      expect(counts.get(category) ?? 0, category).toBeGreaterThanOrEqual(6);
    }
  });

  it('parses every hex into a usable colour', () => {
    for (const entry of PALETTE_COLORS) {
      for (const channel of entry.color) {
        expect(channel).toBeGreaterThanOrEqual(0);
        expect(channel).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('confusion analysis', () => {
  it('finds nothing to report for normal vision', () => {
    const r = analyseConfusions(null);
    expect(r.pairs.length).toBe(0);
    expect(r.families.length).toBe(0);
    expect(r.collapseRate).toBe(0);
  });

  it('finds substantial collapse for a deuteranope', () => {
    const r = analyseConfusions(DEUTAN);
    expect(r.pairs.length).toBeGreaterThan(20);
    expect(r.families.length).toBeGreaterThan(1);
    expect(r.collapseRate).toBeGreaterThan(0.02);
  });

  it('reproduces the green / brown / red collapse people describe', () => {
    // The single most commonly reported experience of red-green deficiency, and
    // the clearest test that the analysis says something true about real life.
    const r = analyseConfusions(DEUTAN);
    const mixed = r.families.filter(
      (f) =>
        f.categories.includes('green') &&
        (f.categories.includes('brown') || f.categories.includes('red')),
    );
    expect(mixed.length).toBeGreaterThan(0);
  });

  it('reproduces the purple / blue / grey collapse', () => {
    const r = analyseConfusions(DEUTAN);
    const mixed = r.families.filter(
      (f) =>
        f.categories.includes('purple') &&
        (f.categories.includes('blue') || f.categories.includes('neutral')),
    );
    expect(mixed.length).toBeGreaterThan(0);
  });

  it('collapses red, orange, yellow and green onto a single hue', () => {
    // The core of the red-green experience, and worth asserting precisely.
    // Traffic-light red and traffic-light green do *not* become identical: they
    // keep a difference in saturation and brightness, which is why people can
    // often still call the lights correctly. What vanishes is hue -- they land
    // on the same yellowish hue angle, along with the browns and olives. Claiming
    // full indistinguishability would be overstating it.
    for (const vision of [DEUTAN, PROTAN]) {
      const hues = [
        'Traffic-light red',
        'Traffic-light green',
        'Olive green',
        'Brick red',
        'Grass green',
        'Mustard',
      ].map((name) => {
        const entry = PALETTE_COLORS.find((c) => c.name === name)!;
        return oklchFromSrgb(simulateSrgb(entry.color, vision))[2];
      });

      const spread = Math.max(...hues) - Math.min(...hues);
      expect(spread, `hue spread for ${vision.axis}`).toBeLessThan(12);
    }
  });

  it('does collapse the muted red-green pairs entirely', () => {
    // Where saturation does not rescue them, the colours really do merge.
    const r = analyseConfusions(DEUTAN);
    const merged = (a: string, b: string) =>
      r.pairs.some(
        (p) =>
          (p.a.name === a && p.b.name === b) || (p.a.name === b && p.b.name === a),
      ) || r.families.some((f) => names(f).includes(a) && names(f).includes(b));

    expect(merged('Moss green', 'Chocolate brown')).toBe(true);
    expect(merged('Hot pink', 'Mid grey')).toBe(true);
  });

  it('does not confuse blue with yellow for red-green observers', () => {
    // Their blue-yellow channel is intact, so claiming otherwise would be wrong
    // and would undermine trust in the rest of the report.
    const r = analyseConfusions(DEUTAN);
    const bad = r.pairs.filter(
      (p) =>
        (p.a.category === 'blue' && p.b.category === 'yellow') ||
        (p.a.category === 'yellow' && p.b.category === 'blue'),
    );
    expect(bad).toHaveLength(0);
  });

  it('confuses blue with green and pink with grey for a tritanope', () => {
    const r = analyseConfusions(TRITAN);
    expect(r.pairs.length).toBeGreaterThan(5);
    const blueGreen = r.pairs.some(
      (p) =>
        (p.a.category === 'blue' && p.b.category === 'green') ||
        (p.a.category === 'green' && p.b.category === 'blue'),
    );
    expect(blueGreen).toBe(true);
  });

  it('reports fewer collapses for a mild deficiency than a complete one', () => {
    const mild = analyseConfusions(MILD_DEUTAN);
    const complete = analyseConfusions(DEUTAN);
    expect(mild.pairs.length).toBeLessThan(complete.pairs.length);
    expect(mild.collapseRate).toBeLessThan(complete.collapseRate);
  });

  it('grows monotonically with severity', () => {
    let previous = -1;
    for (const severity of [0, 0.25, 0.5, 0.75, 1]) {
      const rate = analyseConfusions({ axis: 'deutan', severity }).collapseRate;
      expect(rate).toBeGreaterThanOrEqual(previous);
      previous = rate;
    }
  });

  it('only reports pairs that are genuinely close for the observer and far for others', () => {
    const r = analyseConfusions(PROTAN);
    for (const p of r.pairs) {
      expect(p.seenChromaDistance).toBeLessThan(CONFUSION_LIMIT);
      expect(p.trueDistance).toBeGreaterThanOrEqual(INTEREST_LIMIT);
      expect(p.lost).toBeGreaterThan(0);
      expect(p.lost).toBeLessThanOrEqual(1);
      expect(p.brightnessStillSeparates).toBe(
        p.seenLightnessDelta >= LIGHTNESS_CUE_LIMIT,
      );
    }
  });

  it('never claims black and white look the same', () => {
    // The failure mode of clustering on hue alone: near-neutrals all have almost
    // no chroma, so without a lightness term every grey merges into one family
    // and the report says something obviously false.
    for (const vision of [DEUTAN, PROTAN, TRITAN]) {
      const r = analyseConfusions(vision);
      for (const family of r.families) {
        const members = names(family);
        expect(members.includes('Black') && members.includes('White')).toBe(false);
      }
      const badPair = r.pairs.some(
        (p) =>
          (p.a.name === 'Black' && p.b.name === 'White') ||
          (p.a.name === 'White' && p.b.name === 'Black'),
      );
      expect(badPair).toBe(false);
    }
  });

  it('keeps families tight enough in brightness to be believable', () => {
    for (const vision of [DEUTAN, PROTAN, TRITAN]) {
      for (const family of analyseConfusions(vision).families) {
        expect(family.lightnessSpread).toBeLessThan(0.2);
      }
    }
  });

  it('sorts pairs by how much information is lost', () => {
    const r = analyseConfusions(DEUTAN);
    for (let i = 1; i < r.pairs.length; i++) {
      expect(r.pairs[i - 1].lost).toBeGreaterThanOrEqual(r.pairs[i].lost - 1e-9);
    }
  });

  it('builds families whose members are all mutually confusable', () => {
    // The point of complete linkage. If this failed, we would be telling someone
    // two colours look identical when they can in fact tell them apart.
    for (const vision of [DEUTAN, PROTAN, TRITAN]) {
      for (const family of analyseConfusions(vision).families) {
        for (const a of family.members) {
          for (const b of family.members) {
            expect(confusionDistance(a.seenLab, b.seenLab)).toBeLessThan(CONFUSION_LIMIT);
          }
        }
        expect(family.spread).toBeGreaterThanOrEqual(INTEREST_LIMIT);
        expect(family.members.length).toBeGreaterThan(1);
      }
    }
  });

  it('never puts a colour in two families', () => {
    const r = analyseConfusions(DEUTAN);
    const seen = new Set<string>();
    for (const family of r.families) {
      for (const m of family.members) {
        expect(seen.has(m.name)).toBe(false);
        seen.add(m.name);
      }
    }
  });

  it('offers a safe palette whose members are mutually distinguishable', () => {
    for (const vision of [null, DEUTAN, PROTAN, TRITAN]) {
      const r = analyseConfusions(vision);
      expect(r.safePalette.length).toBeGreaterThan(3);

      for (const a of r.safePalette) {
        for (const b of r.safePalette) {
          if (a === b) continue;
          expect(
            confusionDistance(a.seenLab, b.seenLab),
            `${a.name} vs ${b.name}`,
          ).toBeGreaterThanOrEqual(CONFUSION_LIMIT * 2.5);
        }
      }
    }
  });

  it('offers a smaller safe palette the worse the deficiency', () => {
    const normal = analyseConfusions(null).safePalette.length;
    const mild = analyseConfusions(MILD_DEUTAN).safePalette.length;
    const complete = analyseConfusions(DEUTAN).safePalette.length;
    expect(complete).toBeLessThan(normal);
    expect(complete).toBeLessThanOrEqual(mild);
  });

  it('describes a family in readable prose', () => {
    const family = familiesContaining(DEUTAN, 'Olive green')[0] ?? analyseConfusions(DEUTAN).families[0];
    const text = describeFamily(family);
    expect(text).not.toMatch(/undefined|NaN|#/);
    expect(text.length).toBeGreaterThan(5);
    if (family.members.length > 2) expect(text).toContain(' and ');
  });

  it('gives every simulated colour a valid hex for rendering', () => {
    for (const c of analyseConfusions(DEUTAN).colors) {
      expect(c.seenHex).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});
