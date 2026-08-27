import { describe, expect, it } from 'vitest';
import { Staircase } from '../src/engine/staircase';
import { ThresholdBlock, axisLimits } from '../src/engine/thresholdBlock';
import { CVD_AXES } from '../src/color/lms';
import { makeRng } from '../src/util/rng';

/**
 * A simulated observer with a known threshold. Correct responses follow a
 * Weibull psychometric function with a 25% chance floor, which is the standard
 * model for a 4-alternative forced choice task. If the staircase is implemented
 * correctly it should recover `trueThreshold` to within a modest factor.
 */
function observer(trueThreshold: number, rng: { next(): number }) {
  return (amplitude: number): boolean => {
    const slope = 3.5;
    const p = 1 - 0.75 * Math.exp(-Math.pow(amplitude / trueThreshold, slope));
    return rng.next() < p;
  };
}

function runStaircase(trueThreshold: number, seed: number) {
  const rng = makeRng(seed);
  const respond = observer(trueThreshold, rng);
  const s = new Staircase({ start: 0.05, floor: 1e-4, ceiling: 0.09 });
  let guard = 0;
  while (!s.finished && guard++ < 200) s.respond(respond(s.next()));
  return s.result();
}

describe('staircase', () => {
  it('recovers a known threshold across a range of values', () => {
    for (const truth of [0.002, 0.006, 0.015, 0.035]) {
      // Average several seeds: a single staircase run is inherently noisy, so a
      // per-run assertion would be flaky for reasons that are not bugs.
      const estimates = [1, 2, 3, 4, 5, 6, 7, 8].map(
        (seed) => runStaircase(truth, seed * 1000).threshold,
      );
      const geo = Math.exp(
        estimates.reduce((a, v) => a + Math.log(v), 0) / estimates.length,
      );
      expect(geo).toBeGreaterThan(truth / 1.6);
      expect(geo).toBeLessThan(truth * 1.6);
    }
  });

  it('terminates well within the trial budget', () => {
    for (const seed of [1, 7, 13, 99]) {
      const r = runStaircase(0.01, seed);
      expect(r.trials.length).toBeLessThanOrEqual(34);
      expect(r.outcome).toBe('measured');
    }
  });

  it('never presents an amplitude outside the display limits', () => {
    const rng = makeRng(5);
    const respond = observer(0.5, rng);
    const s = new Staircase({ start: 0.05, floor: 0.001, ceiling: 0.06 });
    while (!s.finished) {
      const a = s.next();
      expect(a).toBeGreaterThanOrEqual(0.001);
      expect(a).toBeLessThanOrEqual(0.06);
      s.respond(respond(a));
    }
  });

  it('reports exceeds-display for an observer who cannot see the largest step', () => {
    const s = new Staircase({ start: 0.05, floor: 1e-4, ceiling: 0.06 });
    while (!s.finished) s.respond(false);
    const r = s.result();
    expect(r.outcome).toBe('exceeds-display');
    expect(r.threshold).toBe(0.06);
  });

  it('reports below-display for an observer who always succeeds', () => {
    const s = new Staircase({ start: 0.05, floor: 1e-4, ceiling: 0.06 });
    while (!s.finished) s.respond(true);
    const r = s.result();
    expect(r.outcome).toBe('below-display');
    expect(r.threshold).toBe(1e-4);
  });

  it('discards the coarse-step reversals from the estimate', () => {
    const r = runStaircase(0.01, 42);
    expect(r.reversals.length).toBeGreaterThanOrEqual(8);
    // Precision is the spread of the averaged reversals; the fine steps should
    // keep it well under the coarse step factor of 2.
    expect(r.precision).toBeLessThan(2.5);
  });
});

describe('threshold block', () => {
  it('derives sane display limits for every axis', () => {
    for (const axis of CVD_AXES) {
      const { floor, ceiling } = axisLimits(axis);
      expect(floor).toBeGreaterThan(0);
      expect(floor).toBeLessThan(ceiling / 10);
      expect(ceiling).toBeLessThan(0.35);
    }
  });

  it('interleaves the three axes and keeps their trial counts balanced', () => {
    const block = new ThresholdBlock(1234);
    const rng = makeRng(77);
    const counts: Record<string, number> = { protan: 0, deutan: 0, tritan: 0 };
    const respond = observer(0.008, rng);

    let guard = 0;
    while (!block.finished && guard++ < 400) {
      const trial = block.nextTrial();
      if (!trial) break;
      counts[trial.axis]++;
      block.respond(respond(trial.amplitude));
    }

    for (const axis of CVD_AXES) expect(counts[axis]).toBeGreaterThan(8);
    const values = CVD_AXES.map((a) => counts[a]);
    expect(Math.max(...values) / Math.min(...values)).toBeLessThan(2);
  });

  it('never repeats an axis while another is still running', () => {
    // Once two of the three staircases have finished, the last one necessarily
    // runs alone, so the meaningful guarantee is about the interleaved portion.
    for (const seed of [999, 12, 4567]) {
      const block = new ThresholdBlock(seed);
      const rng = makeRng(3);
      const respond = observer(0.01, rng);
      let previous: string | null = null;

      let guard = 0;
      while (!block.finished && guard++ < 400) {
        const trial = block.nextTrial();
        if (!trial) break;
        if (block.axesStillRunning > 1) {
          expect(trial.axis).not.toBe(previous);
        }
        previous = trial.axis;
        block.respond(respond(trial.amplitude));
      }
    }
  });

  it('scores orientation responses against the presented gap', () => {
    const block = new ThresholdBlock(5);
    const trial = block.nextTrial()!;
    expect(block.respondWithOrientation(trial.orientation)).toBe(true);
    const next = block.nextTrial()!;
    const wrong = next.orientation === 'up' ? 'down' : 'up';
    expect(block.respondWithOrientation(wrong)).toBe(false);
  });

  it('recovers an elevated threshold on one axis only', () => {
    // A deutan-like observer: red-green axes badly elevated, tritan normal.
    const block = new ThresholdBlock(31337);
    const rng = makeRng(11);
    const truth = { protan: 0.03, deutan: 0.045, tritan: 0.006 } as const;

    let guard = 0;
    while (!block.finished && guard++ < 500) {
      const trial = block.nextTrial();
      if (!trial) break;
      block.respond(observer(truth[trial.axis], rng)(trial.amplitude));
    }

    const results = block.results();
    expect(results.tritan.threshold).toBeLessThan(results.deutan.threshold);
    expect(results.tritan.threshold).toBeLessThan(results.protan.threshold);
  });
});
