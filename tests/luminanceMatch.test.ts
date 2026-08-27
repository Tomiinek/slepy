/**
 * The brightness-match probe, and specifically whether the task is *possible*.
 *
 * Two bugs here got past the whole suite once, because both were about
 * presentation and reachability rather than maths, and the maths was right:
 *
 *   1. The reference patch luminance equalled the adaptation field's, so it
 *      rendered in exactly the surround colour and was invisible. Observers saw
 *      a red square with nothing to match against.
 *   2. Scale is a multiple of the red primary, so 1.0 is the brightest red the
 *      display can make -- but the range allowed up to 6.0. Everything above 1.0
 *      clipped to the same #ff0000, and a protanope's match sat at 1.83, off the
 *      end of the reachable range. The one group the probe exists to identify was
 *      the one group that could not complete it.
 *
 * So these tests assert reachability and visibility, not just correctness.
 */
import { describe, expect, it } from 'vitest';
import {
  MAX_SCALE,
  MIN_SCALE,
  REFERENCE_Y,
  RED_PRIMARY,
  interpretLuminanceMatch,
  matchReferences,
  predictedMatchScale,
  redAtScale,
  startingScales,
} from '../src/engine/luminanceMatch';
import { ADAPT_Y } from '../src/color/confusion';
import { hexFromLinear, relativeLuminance } from '../src/color/srgb';
import { simulateLinear, type Vision } from '../src/color/cvd';

const OBSERVERS: [string, Vision][] = [
  ['normal', null],
  ['protanope', { axis: 'protan', severity: 1 }],
  ['protanomaly', { axis: 'protan', severity: 0.5 }],
  ['deuteranope', { axis: 'deutan', severity: 1 }],
  ['deuteranomaly', { axis: 'deutan', severity: 0.5 }],
  ['tritanope', { axis: 'tritan', severity: 1 }],
];

describe('brightness match is a task the observer can actually perform', () => {
  it.each(OBSERVERS)('%s can reach their match inside the slider range', (_name, vision) => {
    const scale = predictedMatchScale(vision);

    // Strictly inside, with margin: a match sitting at the very edge means the
    // observer is pinned against the ceiling and cannot bracket it from both
    // sides, which is how the task is meant to be done.
    expect(scale).toBeGreaterThan(MIN_SCALE * 1.5);
    expect(scale).toBeLessThan(MAX_SCALE * 0.92);
  });

  it('never asks for a red brighter than the display can produce', () => {
    // Scale multiplies the red primary, which is already the display maximum.
    expect(MAX_SCALE).toBeLessThanOrEqual(1);
  });

  it('changes the rendered red across the whole slider range', () => {
    // The clipping bug showed up exactly here: distinct scales, identical pixels.
    const seen = new Set<string>();
    const steps = 24;
    for (let i = 0; i <= steps; i++) {
      const scale = MIN_SCALE + ((MAX_SCALE - MIN_SCALE) * i) / steps;
      seen.add(hexFromLinear(redAtScale(scale)));
    }
    expect(seen.size).toBe(steps + 1);
  });

  it('shows the reference patch as distinct from the surround it sits on', () => {
    const referenceHex = hexFromLinear([REFERENCE_Y, REFERENCE_Y, REFERENCE_Y]);
    const surroundHex = hexFromLinear([ADAPT_Y, ADAPT_Y, ADAPT_Y]);
    expect(referenceHex).not.toBe(surroundHex);

    // And not merely different by a bit or two, which would still read as one
    // continuous surface.
    const reference = parseInt(referenceHex.slice(1, 3), 16);
    const surround = parseInt(surroundHex.slice(1, 3), 16);
    expect(Math.abs(reference - surround)).toBeGreaterThan(24);
  });

  it('starts the repeats on both sides of every plausible match', () => {
    const starts = startingScales();
    const matches = OBSERVERS.map(([, v]) => predictedMatchScale(v));
    const lowest = Math.min(...matches);
    const highest = Math.max(...matches);

    // Approaching from both directions is what cancels the hysteresis in this
    // task, so at least one start must sit below the lowest plausible match and
    // one above the highest.
    expect(Math.min(...starts)).toBeLessThan(lowest);
    expect(Math.max(...starts)).toBeGreaterThan(highest);
    for (const start of starts) {
      expect(start).toBeGreaterThanOrEqual(MIN_SCALE);
      expect(start).toBeLessThanOrEqual(MAX_SCALE);
    }
  });
});

describe('brightness match discriminates protan from deutan', () => {
  it('separates a protanope from a normal observer by a wide margin', () => {
    const { normal, protan, deutan } = matchReferences();

    // The whole point: protans need the red much brighter.
    expect(protan / normal).toBeGreaterThan(1.6);

    // Deutans, by contrast, sit close to normal -- which is what makes this a
    // protan/deutan discriminator rather than a general deficiency detector.
    expect(deutan / normal).toBeLessThan(1.15);
  });

  it('scores a protanope near 1 and a normal observer near 0', () => {
    const protanope = interpretLuminanceMatch([
      predictedMatchScale({ axis: 'protan', severity: 1 }),
    ]);
    expect(protanope.protanIndex).toBeGreaterThan(0.9);

    const normal = interpretLuminanceMatch([predictedMatchScale(null)]);
    expect(normal.protanIndex).toBeLessThan(0.1);

    const deuteranope = interpretLuminanceMatch([
      predictedMatchScale({ axis: 'deutan', severity: 1 }),
    ]);
    expect(deuteranope.protanIndex).toBeLessThan(0.1);
  });

  it('reads the index from ratios, so it survives a reference change', () => {
    // protanIndex is built from log ratios of scales, and every scale is
    // proportional to REFERENCE_Y. Scaling the reference must therefore leave the
    // index untouched -- this is what let the reference luminance be corrected
    // without recalibrating the classifier.
    const vision: Vision = { axis: 'protan', severity: 0.6 };
    const perUnit = relativeLuminance(simulateLinear(RED_PRIMARY, vision));

    const atReference = (reference: number) => {
      const setting = reference / perUnit;
      const normal = reference / relativeLuminance(simulateLinear(RED_PRIMARY, null));
      const protanope =
        reference / relativeLuminance(simulateLinear(RED_PRIMARY, { axis: 'protan', severity: 1 }));
      return (
        (Math.log(setting) - Math.log(normal)) / (Math.log(protanope) - Math.log(normal))
      );
    };

    expect(atReference(0.08)).toBeCloseTo(atReference(0.2), 10);
  });

  it('reports inconsistent repeats as low consistency', () => {
    const steady = interpretLuminanceMatch([0.4, 0.41, 0.39, 0.4]);
    const erratic = interpretLuminanceMatch([0.15, 0.7, 0.3, 0.9]);
    expect(steady.consistency).toBeLessThan(1.1);
    expect(erratic.consistency).toBeGreaterThan(3);
  });
});
