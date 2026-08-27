import { describe, expect, it } from 'vitest';
import { runAssessment, runRepeated, type ObserverSpec } from './observers';
import { CVD_AXES } from '../src/color/lms';

const SEEDS = [11, 202, 3033, 40404, 55, 666, 7777, 88] as const;

const NORMAL: ObserverSpec = { name: 'normal trichromat', vision: null };

const observers = {
  normal: NORMAL,
  protanope: { name: 'protanope', vision: { axis: 'protan', severity: 1 } },
  deuteranope: { name: 'deuteranope', vision: { axis: 'deutan', severity: 1 } },
  tritanope: { name: 'tritanope', vision: { axis: 'tritan', severity: 1 } },
  deuteranomalMild: { name: 'mild deuteranomal', vision: { axis: 'deutan', severity: 0.4 } },
  deuteranomalStrong: { name: 'strong deuteranomal', vision: { axis: 'deutan', severity: 0.8 } },
  protanomal: { name: 'protanomal', vision: { axis: 'protan', severity: 0.7 } },
} satisfies Record<string, ObserverSpec>;

describe('classifier against synthetic observers', () => {
  it('calls a normal trichromat normal', () => {
    const r = runRepeated(NORMAL, SEEDS);
    expect(r.verdict).toBe('normal');
    expect(r.axis).toBeNull();
    expect(r.meanSeverity).toBeLessThan(0.05);
  });

  it('identifies a deuteranope as a complete deutan deficiency', () => {
    const r = runRepeated(observers.deuteranope, SEEDS);
    expect(r.verdict).toBe('deficiency');
    expect(r.axis).toBe('deutan');
    expect(r.meanSeverity).toBeGreaterThan(0.75);
  });

  it('identifies a protanope as a complete protan deficiency', () => {
    const r = runRepeated(observers.protanope, SEEDS);
    expect(r.verdict).toBe('deficiency');
    expect(r.axis).toBe('protan');
    expect(r.meanSeverity).toBeGreaterThan(0.75);
  });

  it('identifies a tritanope', () => {
    const r = runRepeated(observers.tritanope, SEEDS);
    expect(r.verdict).toBe('deficiency');
    expect(r.axis).toBe('tritan');
  });

  it('separates protan from deutan reliably', () => {
    // The hard discrimination, and the reason the luminance probe exists.
    for (const [spec, expected] of [
      [observers.protanope, 'protan'],
      [observers.deuteranope, 'deutan'],
      [observers.protanomal, 'protan'],
      [observers.deuteranomalStrong, 'deutan'],
    ] as const) {
      const r = runRepeated(spec, SEEDS);
      expect(r.axis, `${spec.name} should be ${expected}`).toBe(expected);
      expect(r.axisAgreement, `${spec.name} axis agreement`).toBeGreaterThan(0.7);
    }
  });

  it('grades severity monotonically', () => {
    const severities = [0.3, 0.5, 0.7, 0.9, 1].map(
      (severity) =>
        runRepeated({ name: `deutan ${severity}`, vision: { axis: 'deutan', severity } }, SEEDS)
          .meanSeverity,
    );
    for (let i = 1; i < severities.length; i++) {
      expect(severities[i]).toBeGreaterThanOrEqual(severities[i - 1] - 0.06);
    }
    // And the extremes must actually be far apart, not merely ordered.
    expect(severities[severities.length - 1]).toBeGreaterThan(severities[0] + 0.2);
  });

  it('detects a mild anomalous trichromat that a pass/fail screen would miss', () => {
    const r = runRepeated(observers.deuteranomalMild, SEEDS);
    expect(r.verdict).toBe('deficiency');
    expect(r.axis).toBe('deutan');
    expect(r.meanSeverity).toBeGreaterThan(0.05);
    expect(r.meanSeverity).toBeLessThan(0.8);
  });

  it('does not claim a blue-yellow deficiency in red-green observers', () => {
    for (const spec of [observers.protanope, observers.deuteranope, observers.deuteranomalStrong]) {
      expect(runRepeated(spec, SEEDS).axis).not.toBe('tritan');
    }
  });

  it('does not claim a red-green deficiency in a tritanope', () => {
    expect(runRepeated(observers.tritanope, SEEDS).axis).toBe('tritan');
  });
});

describe('assessment reporting', () => {
  it('produces a usable report for every observer type', () => {
    for (const spec of Object.values(observers)) {
      const { assessment } = runAssessment(spec, 4242);

      expect(assessment.headline.length).toBeGreaterThan(3);
      expect(assessment.plainSummary.length).toBeGreaterThan(30);
      expect(assessment.evidence.length).toBeGreaterThan(0);
      expect(assessment.axisMetrics.length).toBe(3);
      expect(['low', 'moderate', 'high']).toContain(assessment.confidence);

      for (const m of assessment.axisMetrics) {
        expect(Number.isFinite(m.thresholdUnits)).toBe(true);
        expect(m.thresholdUnits).toBeGreaterThan(0);
        expect(m.performance).toBeGreaterThanOrEqual(0);
        expect(m.performance).toBeLessThanOrEqual(1);
      }
      for (const axis of CVD_AXES) {
        expect(assessment.conePerformance[axis]).toBeGreaterThanOrEqual(0);
        expect(assessment.conePerformance[axis]).toBeLessThanOrEqual(1);
      }
    }
  });

  it('reports lower cone performance on the affected axis', () => {
    const { assessment } = runAssessment(observers.deuteranope, 1234);
    expect(assessment.conePerformance.deutan).toBeLessThan(
      assessment.conePerformance.tritan,
    );
  });

  it('names the deficiency in plain language', () => {
    const { assessment } = runAssessment(observers.deuteranope, 777);
    expect(assessment.name).toMatch(/deuteran/);
    expect(assessment.headline.toLowerCase()).toContain('green-weak');
  });

  it('is confident about clear-cut cases', () => {
    for (const spec of [NORMAL, observers.deuteranope, observers.protanope]) {
      const scores = SEEDS.map((s) => runAssessment(spec, s).assessment.confidenceScore);
      const mean = scores.reduce((a, v) => a + v, 0) / scores.length;
      expect(mean, spec.name).toBeGreaterThan(0.55);
    }
  });

  it('rejects a run where the control plates were missed', () => {
    // An observer who cannot see even a large luminance step -- i.e. a broken
    // display or someone clicking at random.
    const blind: ObserverSpec = {
      name: 'display failure',
      vision: null,
      criterion: 100,
      lapseRate: 0,
    };
    const { assessment } = runAssessment(blind, 5);
    expect(assessment.verdict).toBe('invalid');
    expect(assessment.confidence).toBe('low');
    expect(assessment.caveats.join(' ')).toMatch(/Night Shift|brightness|zoom/i);
  });

  it('keeps the vision model consistent with the verdict', () => {
    const normal = runAssessment(NORMAL, 9).assessment;
    expect(normal.vision).toBeNull();

    const deutan = runAssessment(observers.deuteranope, 9).assessment;
    expect(deutan.vision).not.toBeNull();
    expect(deutan.vision!.axis).toBe('deutan');
    expect(deutan.vision!.severity).toBeGreaterThan(0);
  });

  it('finishes in a realistic number of trials', () => {
    const { plateTrials, thresholdTrials } = runAssessment(observers.deuteranomalMild, 3);
    expect(plateTrials).toBe(17);
    // Roughly 20 trials per axis is the design budget; well under 120 total
    // keeps the stage inside its time allowance.
    expect(thresholdTrials).toBeGreaterThan(30);
    expect(thresholdTrials).toBeLessThan(110);
  });
});
