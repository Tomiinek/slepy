/**
 * @vitest-environment happy-dom
 *
 * The shared-link page.
 *
 * This is the highest-stakes screen in the app in one narrow sense: it is read
 * by people who did not take the test and will not read anything twice, and it
 * is sent by someone tired of explaining themselves. Getting the person wrong --
 * addressing the reader as if they were the one with the deficiency, or leaking
 * "your result" into a page about somebody else -- makes it worse than useless.
 *
 * So these tests are mostly about *voice*, plus the round trip of the name
 * through the URL, which is the only personal data the link carries.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { App } from '../src/App';
import { decodeShared, encodeResults, sanitiseName } from '../src/session/share';
import { classify } from '../src/engine/classify';
import { interpretLuminanceMatch } from '../src/engine/luminanceMatch';
import { scoreArrangement } from '../src/engine/arrangement';
import { summarisePlates } from '../src/engine/scoring/plates';
import { buildPlateSet } from '../src/stimuli/plateSet';
import { CVD_AXES, type CvdAxis } from '../src/color/lms';
import type { AxisThresholds } from '../src/engine/thresholdBlock';
import type { SessionResults } from '../src/session/types';

beforeAll(() => {
  const context = {
    scale: vi.fn(),
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn(() => ({ width: 10 })),
    putImageData: vi.fn(),
    getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
    drawImage: vi.fn(),
    clearRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    fillStyle: '',
    font: '',
  };
  HTMLCanvasElement.prototype.getContext = vi.fn(() => context) as never;

  if (!window.matchMedia) {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as never;
  }
});

const NORMAL = 0.0019;
const DEUTAN = { protan: 5.5, deutan: 6.5, tritan: 1.1 };

function makeResults(elevated: Partial<Record<CvdAxis, number>>): SessionResults {
  const seed = 987654;

  const thresholds = {} as AxisThresholds;
  for (const axis of CVD_AXES) {
    const value = NORMAL * (elevated[axis] ?? 1);
    thresholds[axis] = {
      threshold: value,
      outcome: 'measured',
      reversals: [value, value],
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

  const luminance = interpretLuminanceMatch([0.44, 0.46, 0.43, 0.45]);
  const arrangement = scoreArrangement(scoreArrangement([]).order);

  return {
    seed,
    completedAt: '2026-08-27T09:15:00.000Z',
    durationMs: 372_000,
    thresholds,
    plates: plates.responses,
    luminance,
    arrangement,
    assessment: classify({ thresholds, plates, luminance, arrangement }),
  };
}

/** Renders the app as if the visitor had opened a shared link. */
function openSharedLink(elevated: Partial<Record<CvdAxis, number>>, name?: string) {
  cleanup();
  const results = makeResults(elevated);
  window.location.hash = `#r=${encodeResults(results, name)}`;
  const view = render(<App />);
  return { results, view };
}

describe('the name in the link', () => {
  it('round-trips through the URL', () => {
    const results = makeResults(DEUTAN);
    const decoded = decodeShared(`#r=${encodeResults(results, 'Tomas')}`);
    expect(decoded?.name).toBe('Tomas');
  });

  it('is absent when not given, and links without one still decode', () => {
    const results = makeResults(DEUTAN);
    expect(decodeShared(`#r=${encodeResults(results)}`)?.name).toBeNull();
    // An empty or whitespace name must not produce a link that says "  has ...".
    expect(decodeShared(`#r=${encodeResults(results, '   ')}`)?.name).toBeNull();
  });

  it('trims and caps a pasted name rather than breaking the layout', () => {
    expect(sanitiseName('  Tomas   Nekvinda  ')).toBe('Tomas Nekvinda');
    expect(sanitiseName('x'.repeat(200)).length).toBe(24);
  });

  it('leaves the measurements untouched', () => {
    const results = makeResults(DEUTAN);
    const withName = decodeShared(`#r=${encodeResults(results, 'Tomas')}`)!.results;
    const without = decodeShared(`#r=${encodeResults(results)}`)!.results;

    expect(withName.assessment.axis).toBe(without.assessment.axis);
    expect(withName.assessment.severity).toBeCloseTo(without.assessment.severity, 10);
  });
});

describe('the page a recipient sees', () => {
  it('talks about the sharer by name, never to them', () => {
    openSharedLink(DEUTAN, 'Tomas');

    expect(screen.getByRole('heading', { level: 1, name: /Tomas has/ })).toBeTruthy();
    expect(screen.getByText(/Shared colour vision result/)).toBeTruthy();

    // The first-person report must not bleed through.
    expect(screen.queryByText('Your result')).toBeNull();
    expect(document.body.textContent).not.toMatch(/Colours you will confuse/);
    expect(document.body.textContent).not.toMatch(/Explain this to someone else/);
  });

  it('falls back to "they" with no name, and stays grammatical', () => {
    openSharedLink(DEUTAN);

    expect(screen.getByRole('heading', { level: 1, name: /They have/ })).toBeTruthy();
    const text = document.body.textContent ?? '';
    expect(text).not.toMatch(/They has|they has/);
    expect(text).not.toMatch(/undefined|NaN/);
  });

  it('answers the traffic light question without being asked', () => {
    openSharedLink(DEUTAN, 'Tomas');

    // The whole reason the link exists.
    expect(screen.getByText(/traffic lights/i)).toBeTruthy();
    expect(screen.getByText(/black and white/i)).toBeTruthy();
    expect(screen.getByText(/The questions, answered/)).toBeTruthy();
  });

  it('shows the situations painted through the sharer\u2019s vision', () => {
    openSharedLink(DEUTAN, 'Tomas');

    const tiles = document.querySelectorAll('.scene-tile');
    expect(tiles.length).toBeGreaterThan(0);

    // The toggle is voiced for the sharer, not the reader.
    expect(screen.getByRole('button', { name: /Showing Tomas\u2019 vision/ })).toBeTruthy();
  });

  it('hides the reveal mode, which only makes sense for the sharer', () => {
    openSharedLink(DEUTAN, 'Tomas');
    expect(screen.queryByRole('button', { name: /Reveal what you are missing/ })).toBeNull();
  });

  it('lets the reader start their own test, which clears the shared framing', () => {
    openSharedLink(DEUTAN, 'Tomas');

    fireEvent.click(screen.getByRole('button', { name: 'Take the test' }));

    expect(screen.getByText(/How do you actually see colour/)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/Tomas/);
    // A reload must not drop them back into the shared report.
    expect(window.location.hash).toBe('');
  });

  it('handles a shared result with no deficiency', () => {
    openSharedLink({}, 'Tomas');

    expect(screen.getByText(/typical colour vision/i)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/undefined|NaN/);
  });

  it('ignores a corrupted link instead of inventing a result', () => {
    cleanup();
    window.location.hash = '#r=not-valid-base64!!';
    render(<App />);

    // Falls through to the normal intro rather than a plausible-looking report.
    expect(screen.getByText(/How do you actually see colour/)).toBeTruthy();
  });
});
