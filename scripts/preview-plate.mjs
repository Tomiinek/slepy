/**
 * Renders plates to PNG files outside the browser, so plate appearance can be
 * inspected without a running dev server.
 *
 * The plate generator is deliberately free of DOM dependencies, which is what
 * makes this possible: only the digit mask normally needs a canvas, so this
 * script substitutes a small bitmap font. Everything about the packing, the
 * colours and the noise is the real code path.
 *
 * Run: npx vite-node scripts/preview-plate.mjs
 */
import { writeFileSync } from 'node:fs';
import { encodePng } from './png.mjs';
import { generatePlate, plateDotColor, PLATE_GAP } from '../src/stimuli/plate.ts';

/** 5x7 bitmap digits, one string per row, so the preview shows real figures. */
const FONT = {
  0: ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  1: ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  2: ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  3: ['11111', '00010', '00100', '00010', '00001', '10001', '01110'],
  4: ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  5: ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  6: ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  7: ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  8: ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  9: ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
};

function bitmapMask(answer) {
  const glyphs = [...answer].map((d) => FONT[d]).filter(Boolean);
  if (glyphs.length === 0) return () => false;

  const cols = glyphs.length * 5 + (glyphs.length - 1);
  const rows = 7;
  // Fit the text into the middle of the disc with room to spare.
  const scale = 0.52;

  return (x, y) => {
    const u = (x - 0.5) / scale + 0.5;
    const v = (y - 0.5) / scale + 0.5;
    if (u < 0 || u >= 1 || v < 0 || v >= 1) return false;

    const cx = Math.floor(u * cols);
    const cy = Math.floor(v * rows);
    const glyph = Math.floor(cx / 6);
    const inGlyph = cx % 6;
    if (inGlyph === 5 || glyph >= glyphs.length) return false;
    return glyphs[glyph][cy][inGlyph] === '1';
  };
}

function renderPlate(spec, size) {
  const pixels = new Uint8Array(size * size * 4);
  const scale = size / spec.diameter;

  const bg = PLATE_GAP.map((c) => Math.round(c * 255));
  for (let i = 0; i < size * size; i++) {
    pixels[i * 4] = bg[0];
    pixels[i * 4 + 1] = bg[1];
    pixels[i * 4 + 2] = bg[2];
    pixels[i * 4 + 3] = 255;
  }

  for (const dot of spec.dots) {
    const rgb = plateDotColor(spec, dot).map((c) =>
      Math.max(0, Math.min(255, Math.round(c * 255))),
    );
    const cx = dot.x * scale;
    const cy = dot.y * scale;
    const r = dot.r * scale;

    const x0 = Math.max(0, Math.floor(cx - r - 1));
    const x1 = Math.min(size - 1, Math.ceil(cx + r + 1));
    const y0 = Math.max(0, Math.floor(cy - r - 1));
    const y1 = Math.min(size - 1, Math.ceil(cy + r + 1));

    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        // Coverage-based antialiasing over a 2x2 subgrid, otherwise small dots
        // look jagged and the preview misrepresents the real canvas rendering.
        let hits = 0;
        for (const oy of [0.25, 0.75]) {
          for (const ox of [0.25, 0.75]) {
            if (Math.hypot(x + ox - cx, y + oy - cy) <= r) hits++;
          }
        }
        if (hits === 0) continue;

        const alpha = hits / 4;
        const i = (x + y * size) * 4;
        for (let c = 0; c < 3; c++) {
          pixels[i + c] = Math.round(pixels[i + c] * (1 - alpha) + rgb[c] * alpha);
        }
      }
    }
  }

  return pixels;
}

const DIAMETER = 520;
const cases = [
  { name: 'standard-deutan-strong', mode: 'standard', axis: 'deutan', answer: '74', amplitudeFraction: 0.85 },
  { name: 'standard-deutan-faint', mode: 'standard', axis: 'deutan', answer: '26', amplitudeFraction: 0.3 },
  { name: 'standard-protan-strong', mode: 'standard', axis: 'protan', answer: '5', amplitudeFraction: 0.85 },
  { name: 'standard-tritan-strong', mode: 'standard', axis: 'tritan', answer: '83', amplitudeFraction: 0.85 },
  { name: 'control', mode: 'control', axis: 'deutan', answer: '12', amplitudeFraction: 0.9 },
  { name: 'hidden-digit', mode: 'hiddenDigit', axis: 'deutan', answer: '45', amplitudeFraction: 0.9 },
];

for (const testCase of cases) {
  const spec = generatePlate({
    mode: testCase.mode,
    axis: testCase.axis,
    answer: testCase.answer,
    amplitudeFraction: testCase.amplitudeFraction,
    diameter: DIAMETER,
    mask: bitmapMask(testCase.answer),
    seed: 20260827,
    id: testCase.name,
  });

  const pixels = renderPlate(spec, DIAMETER);
  const path = `preview/${testCase.name}.png`;
  writeFileSync(path, encodePng(pixels, DIAMETER, DIAMETER));

  const discArea = Math.PI * (DIAMETER / 2) ** 2;
  const dotArea = spec.dots.reduce((s, d) => s + Math.PI * d.r ** 2, 0);
  console.log(
    `${path}  dots=${spec.dots.length}  coverage=${((dotArea / discArea) * 100).toFixed(1)}%  answer=${spec.answer}`,
  );
}
