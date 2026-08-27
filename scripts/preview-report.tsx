/**
 * Rasterises the report's charts to PNGs for visual review.
 *
 * Server-renders the real components, wraps each SVG in the dark theme's colours
 * (the components use CSS custom properties, which a standalone SVG has no
 * stylesheet to resolve), and writes a PNG. This is how the charts get *looked
 * at* rather than merely asserted about -- geometry bugs like labels running off
 * the edge or an arc sweeping the wrong way pass every unit test and are obvious
 * in a picture.
 *
 * Requires the optional rasteriser:  npm install --no-save @resvg/resvg-js
 * Run with:  npx vite-node scripts/preview-report.tsx
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';

// Loaded dynamically and deliberately kept out of package.json: it is a native
// binary needed only for local visual review, and making it a real dependency
// would slow every CI install for something CI never runs.
const { Resvg } = await import('@resvg/resvg-js').catch(() => {
  console.error(
    'This script needs the rasteriser:\n  npm install --no-save @resvg/resvg-js\n',
  );
  process.exit(1);
});

import { SeverityGauge } from '../src/components/viz/SeverityGauge';
import { Pictogram } from '../src/components/viz/Pictogram';
import { STAGE_THUMBS } from '../src/components/viz/StageThumbs';
import { spectrumStops } from '../src/components/viz/spectrum';
import { classify } from '../src/engine/classify';
import { interpretLuminanceMatch } from '../src/engine/luminanceMatch';
import { scoreArrangement } from '../src/engine/arrangement';
import { summarisePlates } from '../src/engine/scoring/plates';
import { buildPlateSet } from '../src/stimuli/plateSet';
import { CVD_AXES, type CvdAxis } from '../src/color/lms';
import type { AxisThresholds } from '../src/engine/thresholdBlock';

const OUT = 'preview';

/** The token values the components reference, since there is no stylesheet here. */
const TOKENS: Record<string, string> = {
  '--bg': '#0b0d10',
  '--bg-raised': '#14181d',
  '--bg-raised-2': '#1c2126',
  '--bg-inset': '#090b0e',
  '--border': '#262d35',
  '--border-strong': '#3a444f',
  '--text': '#e8ecf1',
  '--text-dim': '#a6b0bd',
  '--text-faint': '#6d7987',
  '--accent': '#6ea8fe',
  '--warn': '#f0b849',
  '--danger': '#f2777a',
  '--ok': '#63c8a0',
  '--font': 'Helvetica, Arial, sans-serif',
  '--font-mono': 'Menlo, monospace',
};

/** Inlines var(--x) references and the classes the components rely on. */
function resolve(svg: string): string {
  let out = svg;
  for (const [name, value] of Object.entries(TOKENS)) {
    out = out.replaceAll(`var(${name})`, value);
  }

  const css = `
    .gauge__value { font: 700 40px Helvetica, Arial, sans-serif; fill: ${TOKENS['--text']}; }
    .gauge__label { font: 500 14px Helvetica, Arial, sans-serif; fill: ${TOKENS['--text-dim']}; }
    .gauge__band  { font: 500 9px  Helvetica, Arial, sans-serif; fill: ${TOKENS['--text-faint']}; }
    .chart__tick  { font: 500 10px Helvetica, Arial, sans-serif; fill: ${TOKENS['--text-faint']}; }
  `;
  return out.replace('>', `><style>${css}</style>`);
}

function png(name: string, svg: string, width: number) {
  const root = svg.match(/<svg[\s\S]*<\/svg>/)?.[0];
  if (!root) throw new Error(`no <svg> found for ${name}`);

  const markup = resolve(
    root.includes('xmlns')
      ? root
      : root.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"'),
  );
  const resvg = new Resvg(markup, {
    fitTo: { mode: 'width', value: width },
    background: TOKENS['--bg-raised'],
    font: { loadSystemFonts: true },
  });
  const file = `${OUT}/${name}.png`;
  writeFileSync(file, resvg.render().asPng());
  console.log(`wrote ${file}`);
}

function assessmentFor(elevated: Partial<Record<CvdAxis, number>>) {
  const seed = 987654;
  const thresholds = {} as AxisThresholds;
  for (const axis of CVD_AXES) {
    const value = 0.0019 * (elevated[axis] ?? 1);
    thresholds[axis] = {
      threshold: value,
      outcome: 'measured',
      reversals: [value],
      trials: [],
      precision: 1.1,
    };
  }

  const plan = buildPlateSet(seed);
  const plates = summarisePlates(
    plan.map((p, i) => {
      const miss = p.mode !== 'control' && i % 3 !== 0;
      return { plan: p, response: miss ? null : p.answer, correct: !miss, elapsedMs: 2400 };
    }),
  );

  return classify({
    thresholds,
    plates,
    luminance: interpretLuminanceMatch([0.44, 0.46, 0.43, 0.45]),
    arrangement: scoreArrangement(scoreArrangement([]).order),
  });
}

mkdirSync(OUT, { recursive: true });

// Gauge at three severities, to check the arc, marker and band labels.
for (const [name, elevated] of [
  ['gauge-mild', { protan: 4, deutan: 4.6, tritan: 1.1 }],
  ['gauge-moderate', { protan: 7, deutan: 8.5, tritan: 1.1 }],
  ['gauge-strong', { protan: 20, deutan: 26, tritan: 1.1 }],
] as const) {
  const assessment = assessmentFor(elevated);
  console.log(`${name}: ${assessment.headline}`);
  png(name, renderToStaticMarkup(<SeverityGauge assessment={assessment} />), 420);
}

// Pictogram for the two red-green types, whose rates differ sixfold.
for (const axis of ['deutan', 'protan'] as const) {
  png(`picto-${axis}`, renderToStaticMarkup(<Pictogram axis={axis} />), 620);
}

// The four intro thumbnails.
for (const [name, node] of Object.entries(STAGE_THUMBS)) {
  png(`thumb-${name}`, renderToStaticMarkup(node), 320);
}

// The spectrum strip on its own, large, to confirm it is a real spectrum.
const stops = spectrumStops(390, 700);
png(
  'spectrum',
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 620 60">
     <defs><linearGradient id="s" x1="0" x2="1">
       ${stops.map((s) => `<stop offset="${s.offset}" stop-color="${s.color}"/>`).join('')}
     </linearGradient></defs>
     <rect x="10" y="10" width="600" height="40" rx="4" fill="url(#s)"/>
   </svg>`,
  620,
);
