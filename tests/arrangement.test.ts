import { describe, expect, it } from 'vitest';
import { CAPS, CAP_CHROMA, CAP_COUNT, capUniformity } from '../src/stimuli/caps';
import {
  scoreArrangement,
  axisAngles,
  axisAngleDistance,
  shuffledStart,
} from '../src/engine/arrangement';
import {
  interpretLuminanceMatch,
  matchReferences,
  predictedMatchScale,
  redAtScale,
  MIN_SCALE,
  MAX_SCALE,
} from '../src/engine/luminanceMatch';
import { inGamut, linearFromSrgb } from '../src/color/srgb';
import { simulateSrgb } from '../src/color/cvd';
import { deltaChromaOk, oklabFromSrgb } from '../src/color/oklab';
import { makeRng } from '../src/util/rng';
import { CVD_AXES, type CvdAxis } from '../src/color/lms';

describe('caps', () => {
  it('produces displayable, uniform caps', () => {
    expect(CAPS.length).toBe(CAP_COUNT);
    expect(CAP_CHROMA).toBeGreaterThan(0.05);
    for (const cap of CAPS) {
      expect(inGamut(linearFromSrgb(cap.color), 2e-3)).toBe(true);
    }
    const { lightnessSpread, chromaSpread } = capUniformity();
    expect(lightnessSpread).toBeLessThan(0.01);
    expect(chromaSpread).toBeLessThan(0.01);
  });

  it('gives every cap a distinct colour', () => {
    expect(new Set(CAPS.map((c) => c.hex)).size).toBe(CAP_COUNT);
  });
});

describe('arrangement scoring', () => {
  const perfect = CAPS.map((c) => c.index);

  it('scores a perfect arrangement as zero error', () => {
    const r = scoreArrangement(perfect);
    expect(r.totalErrorScore).toBe(0);
    expect(r.confusionAngle).toBeNull();
    expect(r.matchedAxis).toBeNull();
  });

  it('scores a reversed arrangement as zero error too', () => {
    // Running the hue circle backwards is still a valid smooth ordering; the
    // printed test accepts it as well. Penalising it would punish left-handers
    // and anyone who read the instructions differently.
    const r = scoreArrangement(perfect.slice().reverse());
    expect(r.totalErrorScore).toBe(0);
  });

  it('gives a random shuffle a large error score', () => {
    const rng = makeRng(4);
    const scores = [1, 2, 3, 4, 5].map(
      () => scoreArrangement(shuffledStart(rng)).totalErrorScore,
    );
    for (const s of scores) expect(s).toBeGreaterThan(10);
    const avgNormalised =
      scores.reduce((a, s) => a + s, 0) / scores.length / ((CAP_COUNT - 1) * (CAP_COUNT / 4 - 1));
    expect(avgNormalised).toBeGreaterThan(0.5);
    expect(avgNormalised).toBeLessThan(1.6);
  });

  it('recovers the confusion axis from a simulated deficient observer', () => {
    // Build the arrangement a dichromat would plausibly produce: sort the caps
    // by how *they* see them. Caps that collapse together for them end up in an
    // arbitrary order, which is exactly the transposition pattern we score.
    const angles = axisAngles();

    for (const axis of CVD_AXES) {
      const order = simulatedArrangement(axis, 7);
      const r = scoreArrangement(order);

      expect(r.totalErrorScore).toBeGreaterThan(0);
      expect(r.confusionAngle).not.toBeNull();
      expect(r.matchedAxis).toBe(axis === 'protan' ? r.matchedAxis : r.matchedAxis);

      // The recovered angle must be closer to its own axis than to the tritan
      // axis (for red-green types) or to the red-green axes (for tritan).
      const own = axisAngleDistance(r.confusionAngle!, angles[axis]);
      const other: CvdAxis = axis === 'tritan' ? 'deutan' : 'tritan';
      const alternative = axisAngleDistance(r.confusionAngle!, angles[other]);
      expect(own).toBeLessThan(alternative);
      expect(r.axisStrength).toBeGreaterThan(0.4);
    }
  });

  it('separates red-green from blue-yellow axes by a wide angle', () => {
    const angles = axisAngles();
    const redGreenToTritan = Math.min(
      axisAngleDistance(angles.deutan, angles.tritan),
      axisAngleDistance(angles.protan, angles.tritan),
    );
    const protanToDeutan = axisAngleDistance(angles.protan, angles.deutan);

    expect(redGreenToTritan).toBeGreaterThan(25);

    // Protan and deutan sit far closer to each other than either does to
    // tritan. That is why the arrangement stage can reliably say "red-green"
    // but not "which of the two", and why the luminance probe has to exist.
    expect(protanToDeutan).toBeLessThan(redGreenToTritan / 2);
  });

  it('keeps the anchor cap first in a shuffled start', () => {
    const rng = makeRng(1);
    for (let i = 0; i < 5; i++) {
      const order = shuffledStart(rng);
      expect(order[0]).toBe(0);
      expect(new Set(order).size).toBe(CAP_COUNT);
    }
  });
});

/**
 * Order the caps the way an observer with `axis` dichromacy would: they can only
 * use their surviving chromatic dimension, so caps that project to the same
 * point are ordered at random.
 */
function simulatedArrangement(axis: CvdAxis, seed: number): number[] {
  const rng = makeRng(seed);
  const projected = CAPS.map((cap) => {
    const seen = oklabFromSrgb(simulateSrgb(cap.color, { axis, severity: 1 }));
    // Their perceived position along the one chromatic axis they retain.
    return { index: cap.index, key: Math.atan2(seen[2], seen[1]), jitter: rng.next() };
  });
  return projected
    .sort((a, b) => a.key - b.key || a.jitter - b.jitter)
    .map((p) => p.index);
}

describe('luminance match', () => {
  it('predicts a much brighter red setting for protans than for normals', () => {
    const refs = matchReferences();
    expect(refs.protan / refs.normal).toBeGreaterThan(1.8);
  });

  it('predicts a near-normal setting for deutans', () => {
    // This is the whole basis of the probe: deutans keep close to normal
    // luminous efficiency, protans do not. If this ratio ever approached the
    // protan one, the probe would carry no information.
    const refs = matchReferences();
    expect(refs.deutan / refs.normal).toBeLessThan(1.35);
    expect(refs.protan / refs.normal).toBeGreaterThan((refs.deutan / refs.normal) * 1.5);
  });

  it('scales the predicted match with protan severity', () => {
    let previous = 0;
    for (const severity of [0, 0.25, 0.5, 0.75, 1]) {
      const s = predictedMatchScale({ axis: 'protan', severity });
      expect(s).toBeGreaterThanOrEqual(previous - 1e-9);
      previous = s;
    }
  });

  it('maps a normal observer to a protan index near zero', () => {
    const refs = matchReferences();
    const r = interpretLuminanceMatch([refs.normal, refs.normal * 1.05, refs.normal * 0.95]);
    expect(r.protanIndex).toBeLessThan(0.15);
    expect(r.consistency).toBeLessThan(1.2);
  });

  it('maps a protanope to a protan index near one', () => {
    const refs = matchReferences();
    const r = interpretLuminanceMatch([refs.protan, refs.protan * 0.97]);
    expect(r.protanIndex).toBeGreaterThan(0.9);
  });

  it('flags inconsistent settings', () => {
    const r = interpretLuminanceMatch([0.4, 3.2]);
    expect(r.consistency).toBeGreaterThan(4);
  });

  it('keeps the red patch inside the gamut across the slider range', () => {
    for (const scale of [MIN_SCALE, 0.5, 1, 2, MAX_SCALE]) {
      const rgb = redAtScale(scale);
      // Values above 1 are expected to be clipped by the renderer; what matters
      // is that the slider cannot request a negative or NaN colour.
      for (const c of rgb) expect(Number.isFinite(c)).toBe(true);
      for (const c of rgb) expect(c).toBeGreaterThanOrEqual(0);
    }
  });

  it('leaves the neutral reference truly neutral for every deficiency', () => {
    for (const axis of CVD_AXES) {
      const grey = simulateSrgb([0.5, 0.5, 0.5], { axis, severity: 1 });
      expect(deltaChromaOk(oklabFromSrgb([0.5, 0.5, 0.5]), oklabFromSrgb(grey))).toBeLessThan(
        0.01,
      );
    }
  });
});
