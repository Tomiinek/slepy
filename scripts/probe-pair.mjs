/** Inspect how a specific named pair looks to each deficiency. */
import { PALETTE_COLORS } from '../src/analysis/palette.ts';
import { simulateSrgb } from '../src/color/cvd.ts';
import { oklabFromSrgb, deltaChromaOk, deltaEOk, oklchFromSrgb } from '../src/color/oklab.ts';
import { hexFromSrgb } from '../src/color/srgb.ts';

const pairs = [
  ['Traffic-light red', 'Traffic-light green'],
  ['Olive green', 'Brick red'],
  ['Moss green', 'Chocolate brown'],
  ['Violet', 'Royal blue'],
  ['Hot pink', 'Mid grey'],
];

const find = (n) => PALETTE_COLORS.find((c) => c.name === n);

for (const axis of ['protan', 'deutan']) {
  console.log(`\n=== ${axis} (complete) ===`);
  for (const [an, bn] of pairs) {
    const a = find(an);
    const b = find(bn);
    if (!a || !b) {
      console.log(`  MISSING: ${an} / ${bn}`);
      continue;
    }
    const sa = simulateSrgb(a.color, { axis, severity: 1 });
    const sb = simulateSrgb(b.color, { axis, severity: 1 });
    const la = oklabFromSrgb(sa);
    const lb = oklabFromSrgb(sb);
    console.log(
      `  ${an.padEnd(20)} ${hexFromSrgb(sa)} vs ${bn.padEnd(20)} ${hexFromSrgb(sb)}` +
        `  dChroma ${deltaChromaOk(la, lb).toFixed(4)}  dL ${Math.abs(la[0] - lb[0]).toFixed(3)}` +
        `  dE ${deltaEOk(la, lb).toFixed(3)}  hue ${oklchFromSrgb(sa)[2].toFixed(0)}/${oklchFromSrgb(sb)[2].toFixed(0)}`,
    );
  }
}
