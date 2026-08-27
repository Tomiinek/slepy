/**
 * Renders the brightness-match field at several slider positions.
 *
 * This exists because the failure it guards against was purely visual: the
 * reference patch was rendered in exactly the surround colour, so the stage
 * looked like a single red square floating on grey. Nothing in the maths was
 * wrong, and no unit test could see it.
 *
 * Run: npx vite-node scripts/preview-brightness.mjs
 */
import { writeFileSync } from 'node:fs';
import { encodePng, fillRect, makeCanvas, rgbFromHex } from './png.mjs';
import {
  MAX_SCALE,
  MIN_SCALE,
  REFERENCE_Y,
  predictedMatchScale,
  redAtScale,
} from '../src/engine/luminanceMatch.ts';
import { ADAPT_Y } from '../src/color/confusion.ts';
import { hexFromLinear } from '../src/color/srgb.ts';

const W = 460;
const H = 300;

const SURROUND = rgbFromHex(hexFromLinear([ADAPT_Y, ADAPT_Y, ADAPT_Y]));
const BEZEL = rgbFromHex('#141414');
const GREY = rgbFromHex(hexFromLinear([REFERENCE_Y, REFERENCE_Y, REFERENCE_Y]));

function render(scale) {
  const pixels = makeCanvas(W, H, SURROUND);

  const bezelW = 352;
  const bezelH = 222;
  const bx = (W - bezelW) / 2;
  const by = (H - bezelH) / 2;
  fillRect(pixels, W, bx, by, bezelW, bezelH, BEZEL);

  const half = 150;
  const patchH = 170;
  const px = bx + 26;
  const py = by + 26;
  fillRect(pixels, W, px, py, half, patchH, GREY);
  fillRect(pixels, W, px + half, py, half, patchH, rgbFromHex(hexFromLinear(redAtScale(scale))));

  return pixels;
}

const cases = [
  ['min', MIN_SCALE],
  ['normal-match', predictedMatchScale(null)],
  ['protanope-match', predictedMatchScale({ axis: 'protan', severity: 1 })],
  ['max', MAX_SCALE],
];

for (const [name, scale] of cases) {
  const path = `preview/brightness-${name}.png`;
  writeFileSync(path, encodePng(render(scale), W, H));
  console.log(
    `${path}  scale=${scale.toFixed(3)}  grey=${hexFromLinear([REFERENCE_Y, REFERENCE_Y, REFERENCE_Y])}  red=${hexFromLinear(redAtScale(scale))}  surround=${hexFromLinear([ADAPT_Y, ADAPT_Y, ADAPT_Y])}`,
  );
}
