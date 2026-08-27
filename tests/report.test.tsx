/**
 * @vitest-environment happy-dom
 *
 * Renders the finished report for a known synthetic observer and checks the
 * visual elements are actually there.
 *
 * The session smoke test proves the report renders without throwing, but it
 * cannot tell whether a chart drew anything: an SVG with no path elements, a
 * gradient with no stops, or a scene grid with no tiles all render perfectly
 * happily as empty boxes. Since the report leans on pictures instead of prose,
 * an empty chart now loses information rather than just looking plain -- so each
 * one is checked for its contents, not just its presence.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ResultsScreen } from '../src/components/screens/ResultsScreen';
import { spectrumStops } from '../src/components/viz/spectrum';
import { classify } from '../src/engine/classify';
import { interpretLuminanceMatch } from '../src/engine/luminanceMatch';
import { scoreArrangement } from '../src/engine/arrangement';
import { summarisePlates } from '../src/engine/scoring/plates';
import { buildPlateSet } from '../src/stimuli/plateSet';
import { CVD_AXES, type CvdAxis } from '../src/color/lms';
import { srgbFromHex } from '../src/color/srgb';
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

function makeResults(elevated: Partial<Record<CvdAxis, number>>): SessionResults {
  const seed = 987654;

  const thresholds = {} as AxisThresholds;
  for (const axis of CVD_AXES) {
    const value = NORMAL * (elevated[axis] ?? 1);
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

function renderReport(elevated: Partial<Record<CvdAxis, number>>) {
  cleanup();
  const results = makeResults(elevated);
  const view = render(<ResultsScreen results={results} onRestart={() => {}} />);
  return { results, view };
}

const DEUTAN = { protan: 5.5, deutan: 6.5, tritan: 1.1 };

describe('the report renders its charts with content', () => {
  it('classifies the fixture as a deuteranomaly, so the deficient branches run', () => {
    const { results } = renderReport(DEUTAN);
    expect(results.assessment.verdict).toBe('deficiency');
    expect(results.assessment.axis).toBe('deutan');
  });

  it('draws the severity gauge with an arc and a readable value', () => {
    renderReport(DEUTAN);

    const gauge = screen.getByRole('img', { name: /Severity:/ });
    // Track, fill and the five band ticks: an empty gauge would have none.
    expect(gauge.querySelectorAll('path').length).toBeGreaterThanOrEqual(2);
    expect(gauge.querySelectorAll('circle').length).toBeGreaterThanOrEqual(6);
    expect(gauge.textContent).toMatch(/none/);
    expect(gauge.textContent).toMatch(/complete/);
  });

  it('draws one pictogram figure per hundred people', () => {
    renderReport(DEUTAN);

    const picto = screen.getByRole('img', { name: /Prevalence:/ });
    expect(picto.querySelectorAll('g').length).toBe(100);
    // Each figure is a head plus a shoulders path.
    expect(picto.querySelectorAll('path').length).toBe(100);
  });

  it('gives the cone chart a spectrum axis with real spectral colours', () => {
    const stops = spectrumStops(390, 700);
    expect(stops.length).toBeGreaterThan(30);

    // Blue must dominate at the short-wavelength end and red at the long end,
    // otherwise the strip is not a spectrum and the axis is meaningless.
    const shortEnd = srgbFromHex(stops[0].color);
    const longEnd = srgbFromHex(stops[stops.length - 1].color);
    expect(shortEnd[2]).toBeGreaterThan(shortEnd[0]);
    expect(longEnd[0]).toBeGreaterThan(longEnd[2]);

    renderReport(DEUTAN);
    const chart = screen.getByRole('img', { name: /Cone sensitivity curves/ });
    expect(chart.querySelectorAll('linearGradient stop').length).toBe(stops.length);
    expect(chart.querySelector('rect[fill="url(#cone-spectrum)"]')).toBeTruthy();
  });

  it('shows six scene tiles and repaints them when toggled', () => {
    renderReport(DEUTAN);

    const tiles = document.querySelectorAll('.scene-tile');
    expect(tiles.length).toBe(6);
    for (const tile of tiles) {
      // Each tile must actually contain drawn shapes.
      expect(tile.querySelectorAll('svg *').length).toBeGreaterThan(3);
    }

    const toggle = screen.getByRole('button', { name: /Showing your vision/ });
    const before = document.querySelector('.scene-tile__art')!.innerHTML;
    fireEvent.click(toggle);
    const after = document.querySelector('.scene-tile__art')!.innerHTML;

    expect(after).not.toBe(before);
    expect(screen.getByRole('button', { name: /Showing typical vision/ })).toBeTruthy();
  });

  it('shows inheritance dials that change with the sex toggle', () => {
    renderReport(DEUTAN);

    const dials = document.querySelectorAll('.inherit__dial');
    expect(dials.length).toBe(3);
    // Male: sons 0%, daughters 100% carriers, grandsons 50%.
    expect([...dials].map((d) => d.textContent)).toEqual(['0%', '100%', '50%']);

    fireEvent.click(screen.getByRole('button', { name: 'I am female' }));
    expect([...document.querySelectorAll('.inherit__dial')].map((d) => d.textContent)).toEqual([
      '100%',
      '100%',
      '100%',
    ]);
  });

  it('places the brightness marker between its labelled references', () => {
    renderReport(DEUTAN);

    const scale = document.querySelector('.mscale')!;
    const labels = [...scale.querySelectorAll('.mscale__reflabel')].map((n) => n.textContent);
    expect(labels).toEqual(['typical', 'protan']);

    const marker = scale.querySelector<HTMLElement>('.mscale__you')!;
    const percent = Number.parseFloat(marker.style.left);
    expect(percent).toBeGreaterThan(0);
    expect(percent).toBeLessThan(100);
  });

  it('draws the chromaticity diagram with a locus and confusion lines', () => {
    renderReport(DEUTAN);

    const diagram = screen.getByRole('img', { name: /Chromaticity diagram/ });
    expect(diagram.querySelectorAll('line').length).toBeGreaterThanOrEqual(5);
    expect(diagram.querySelectorAll('rect').length).toBeGreaterThan(100);
  });

  it('reports a percentage of collapsed pairs as a figure', () => {
    renderReport(DEUTAN);

    const bignum = document.querySelector('.bignum')!;
    expect(Number.parseInt(bignum.textContent!, 10)).toBeGreaterThan(0);
  });

  it('carries no disclaimer and ends on the save section', () => {
    renderReport(DEUTAN);

    const text = document.body.textContent ?? '';
    for (const phrase of [
      /not a (medical )?diagnosis/i,
      /screening/i,
      /optometrist/i,
      /leaves your device/i,
      /no server/i,
      /analytics/i,
    ]) {
      expect(text).not.toMatch(phrase);
    }

    expect(screen.getByText(/Save or share it/)).toBeTruthy();
  });

  it('renders the normal-vision branch without charts that need an axis', () => {
    const { results } = renderReport({});
    expect(results.assessment.verdict).not.toBe('deficiency');

    // No gauge or pictogram, and no crash from a null axis.
    expect(screen.queryByRole('img', { name: /Severity:/ })).toBeNull();
    expect(document.body.textContent).not.toMatch(/NaN|undefined|Infinity/);
  });
});
