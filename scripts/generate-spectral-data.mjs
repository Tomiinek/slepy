/**
 * Regenerates `src/color/spectralData.ts` from CVRL reference datasets.
 *
 * Inputs (download once into the directory passed as argv[2]):
 *   ciexyz31.csv      CIE 1931 2-deg colour matching functions, 5 nm
 *   linss2_10e_5.csv  Stockman & Sharpe 2-deg cone fundamentals (linear energy), 5 nm
 *
 * Usage: node scripts/generate-spectral-data.mjs /path/to/data
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2];
if (!dir) {
  console.error('Usage: node scripts/generate-spectral-data.mjs <data-dir>');
  process.exit(1);
}

const parse = (file) =>
  readFileSync(join(dir, file), 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.split(',').map((c) => (c.trim() === '' ? 0 : Number(c.trim()))));

const LO = 390;
const HI = 700;

const cmf = parse('ciexyz31.csv').filter(([nm]) => nm >= LO && nm <= HI);
const cones = parse('linss2_10e_5.csv').filter(([nm]) => nm >= LO && nm <= HI);

const r4 = (n) => Number(n.toFixed(4));
const r5 = (n) => Number(n.toFixed(5));

// Spectral locus in CIE 1976 u'v', which is the space we report thresholds in.
const locus = cmf.map(([nm, X, Y, Z]) => {
  const denom = X + 15 * Y + 3 * Z;
  return [nm, r4((4 * X) / denom), r4((9 * Y) / denom)];
});

// Cone fundamentals normalised to unit peak, for the explanatory report graphic.
const peak = [0, 1, 2].map((i) => Math.max(...cones.map((row) => row[i + 1])));
const fundamentals = cones.map(([nm, l, m, s]) => [
  nm,
  r5(l / peak[0]),
  r5(m / peak[1]),
  r5(s / peak[2]),
]);

const fmt = (rows, perLine) =>
  rows
    .map((r) => `  [${r.join(', ')}],`)
    .reduce((acc, line, i) => acc + line + (i % perLine === perLine - 1 ? '\n' : ''), '')
    .trimEnd();

const out = `/**
 * GENERATED FILE -- do not edit by hand.
 * Regenerate with: node scripts/generate-spectral-data.mjs <data-dir>
 *
 * Sources (Colour & Vision Research Laboratory, cvrl.org):
 *  - CIE 1931 2-deg colour matching functions (ciexyz31.csv)
 *  - Stockman & Sharpe 2-deg cone fundamentals, linear energy (linss2_10e_5.csv)
 */

/** [wavelength nm, u', v'] along the spectral locus, ${LO}-${HI} nm at 5 nm steps. */
export const SPECTRAL_LOCUS_UV: readonly (readonly [number, number, number])[] = [
${fmt(locus, 1)}
];

/** [wavelength nm, L, M, S] cone sensitivity, each normalised to unit peak. */
export const CONE_FUNDAMENTALS: readonly (readonly [number, number, number, number])[] = [
${fmt(fundamentals, 1)}
];
`;

writeFileSync('src/color/spectralData.ts', out);
console.log(`Wrote src/color/spectralData.ts (${locus.length} locus rows, ${fundamentals.length} cone rows)`);
