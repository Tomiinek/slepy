/**
 * Prints the confusion families a given deficiency produces, so the palette and
 * clustering thresholds can be sanity-checked against lived experience rather
 * than only against unit tests.
 *
 * Usage: npx vite-node scripts/inspect-confusions.mjs [axis] [severity]
 */
import { analyseConfusions, describeFamily } from '../src/analysis/confusables.ts';

const axis = process.argv[2] ?? 'deutan';
const severity = Number(process.argv[3] ?? 1);
const vision = severity > 0 ? { axis, severity } : null;

const r = analyseConfusions(vision);

console.log(`\n=== ${axis} severity ${severity} ===`);
console.log(`collapse rate: ${(r.collapseRate * 100).toFixed(1)}%`);
console.log(`pairs: ${r.pairs.length}   families: ${r.families.length}\n`);

console.log('--- FAMILIES ---');
for (const f of r.families) {
  const flag = f.indistinguishable ? 'no cue left' : `brightness differs by ${f.lightnessSpread.toFixed(2)}`;
  console.log(`\n[${f.members.length}] seen as ${f.seenHex}  (${flag})`);
  console.log(`  ${describeFamily(f)}`);
  console.log(`  categories: ${f.categories.join(', ')}  spread: ${f.spread.toFixed(3)}`);
}

console.log('\n--- TOP PAIRS ---');
for (const p of r.pairs.slice(0, 14)) {
  console.log(
    `  ${p.a.name.padEnd(22)} ~ ${p.b.name.padEnd(22)} lost ${(p.lost * 100).toFixed(0)}%` +
      `  dL ${p.seenLightnessDelta.toFixed(3)}${p.brightnessStillSeparates ? ' (brightness helps)' : ''}`,
  );
}

console.log(`\n--- RELIABLE (${r.reliable.length}) ---`);
console.log('  ' + r.reliable.slice(0, 16).map((c) => c.name).join(', '));
