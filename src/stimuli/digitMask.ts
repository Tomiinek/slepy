/**
 * Rasterises the plate figure (a numeral) to a bitmap mask.
 *
 * Kept apart from `plate.ts` because it needs a canvas, whereas the plate
 * generator itself is pure and unit-testable. Anything that draws goes here.
 */
import type { FigureMask } from './plate';

const MASK_RES = 256;

/**
 * Build a mask from text. Uses a heavy weight and a slight outward spread so the
 * strokes are thick enough for dots to resolve into a legible digit -- thin
 * strokes read as noise once quantised into circles.
 */
export function digitMask(text: string, res = MASK_RES): FigureMask {
  const canvas = document.createElement('canvas');
  canvas.width = res;
  canvas.height = res;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return () => false;

  ctx.clearRect(0, 0, res, res);
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Scale down for longer strings so a 2-digit figure still fits the disc.
  const size = res * (text.length > 1 ? 0.5 : 0.62);
  ctx.font = `900 ${size}px ${'ui-sans-serif, system-ui, -apple-system, Helvetica, Arial, sans-serif'}`;
  ctx.lineWidth = res * 0.018;
  ctx.lineJoin = 'round';
  ctx.fillText(text, res / 2, res / 2 + res * 0.01);
  ctx.strokeText(text, res / 2, res / 2 + res * 0.01);

  const alpha = ctx.getImageData(0, 0, res, res).data;

  return (nx: number, ny: number) => {
    const x = Math.min(res - 1, Math.max(0, Math.round(nx * res)));
    const y = Math.min(res - 1, Math.max(0, Math.round(ny * res)));
    return alpha[(x + y * res) * 4 + 3] > 128;
  };
}

/**
 * Fallback figure for observers who would rather not read numerals: a wide
 * winding path across the plate, of the kind used in the children's editions of
 * the printed tests.
 */
export function pathMask(seed: number): FigureMask {
  const wobble = ((seed % 7) - 3) * 0.05;
  return (x, y) => {
    const target = 0.5 + Math.sin(x * Math.PI * 1.6 + wobble * 4) * (0.16 + wobble * 0.2);
    return Math.abs(y - target) < 0.055 && x > 0.1 && x < 0.9;
  };
}
