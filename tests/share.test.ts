/**
 * Share-link round trip.
 *
 * A broken link fails silently and embarrassingly: the recipient sees a plausible
 * report built from mangled numbers, with nothing to indicate anything went
 * wrong. So the encoder is checked against the decoder on the quantities the
 * report actually displays, and every malformed input is checked to fail closed
 * rather than produce a result.
 */
import { describe, expect, it } from 'vitest';
import { decodeResults, encodeResults } from '../src/session/share';
import { classify } from '../src/engine/classify';
import { interpretLuminanceMatch } from '../src/engine/luminanceMatch';
import { scoreArrangement } from '../src/engine/arrangement';
import { summarisePlates } from '../src/engine/scoring/plates';
import { buildPlateSet } from '../src/stimuli/plateSet';
import { CVD_AXES } from '../src/color/lms';
import type { AxisThresholds } from '../src/engine/thresholdBlock';
import type { SessionResults } from '../src/session/types';

function makeResults(overrides?: {
  thresholds?: Partial<Record<'protan' | 'deutan' | 'tritan', number>>;
  luminance?: number[];
}): SessionResults {
  const seed = 987654;

  const thresholds = {} as AxisThresholds;
  for (const axis of CVD_AXES) {
    const value = overrides?.thresholds?.[axis] ?? 0.0021;
    thresholds[axis] = {
      threshold: value,
      outcome: 'measured',
      reversals: [value * 1.05, value * 0.95, value, value * 1.02],
      trials: [],
      precision: 1.1,
    };
  }

  const plan = buildPlateSet(seed);
  const plates = summarisePlates(
    plan.map((p, i) => ({
      plan: p,
      // A repeatable mixed pattern, so the flag string is not all ones.
      response: i % 4 === 3 ? null : p.answer,
      correct: i % 4 !== 3,
      elapsedMs: 2200,
    })),
  );

  const luminance = interpretLuminanceMatch(overrides?.luminance ?? [1.1, 1.16, 1.05, 1.12]);
  const arrangement = scoreArrangement(scoreArrangement([]).order);

  return {
    seed,
    completedAt: '2026-08-27T09:15:00.000Z',
    thresholds,
    plates: plates.responses,
    luminance,
    arrangement,
    assessment: classify({ thresholds, plates, luminance, arrangement }),
    durationMs: 372_000,
  };
}

describe('share links', () => {
  it('round-trips the measurements a report displays', () => {
    const original = makeResults();
    const restored = decodeResults(`#r=${encodeResults(original)}`);

    expect(restored).not.toBeNull();
    if (!restored) return;

    expect(restored.seed).toBe(original.seed);
    expect(restored.completedAt).toBe(original.completedAt);

    for (const axis of CVD_AXES) {
      expect(restored.thresholds[axis].threshold).toBeCloseTo(
        original.thresholds[axis].threshold,
        6,
      );
      expect(restored.thresholds[axis].outcome).toBe(original.thresholds[axis].outcome);
    }

    // The verdict is re-derived rather than carried, so this also asserts the
    // classifier reaches the same conclusion from the compacted inputs.
    expect(restored.assessment.verdict).toBe(original.assessment.verdict);
    expect(restored.assessment.axis).toBe(original.assessment.axis);
    expect(restored.assessment.severityLabel).toBe(original.assessment.severityLabel);
    expect(restored.assessment.name).toBe(original.assessment.name);
    expect(restored.luminance.scale).toBeCloseTo(original.luminance.scale, 3);
    expect(restored.plates.length).toBe(original.plates.length);
  });

  it('preserves a deficiency verdict, not just a normal one', () => {
    // A strongly elevated deutan axis, which must survive the round trip as the
    // same diagnosis rather than degrading into "inconclusive".
    const original = makeResults({
      thresholds: { protan: 0.011, deutan: 0.016, tritan: 0.0022 },
      luminance: [1.05, 1.02, 1.08, 1.04],
    });
    expect(original.assessment.verdict).toBe('deficiency');

    const restored = decodeResults(`#r=${encodeResults(original)}`);
    expect(restored?.assessment.verdict).toBe('deficiency');
    expect(restored?.assessment.axis).toBe(original.assessment.axis);
    expect(restored?.assessment.name).toBe(original.assessment.name);
  });

  it('works with or without the hash prefix', () => {
    const encoded = encodeResults(makeResults());
    expect(decodeResults(encoded)).not.toBeNull();
    expect(decodeResults(`#r=${encoded}`)).not.toBeNull();
    expect(decodeResults(`r=${encoded}`)).not.toBeNull();
  });

  it('produces a link short enough to survive being pasted around', () => {
    // Mail clients and chat apps break long URLs across lines. Staying well under
    // 2000 characters is what keeps the link clickable.
    expect(encodeResults(makeResults()).length).toBeLessThan(600);
  });

  it('fails closed on anything malformed', () => {
    for (const bad of [
      '',
      '#r=',
      '#r=not-base64!!',
      '#r=' + btoa('{"v":99}'),
      '#r=' + btoa('{"v":1}'),
      '#r=' + btoa('nonsense'),
      '#other=abc',
    ]) {
      expect(decodeResults(bad)).toBeNull();
    }
  });
});
