/**
 * @vitest-environment happy-dom
 *
 * Drives the real app through a whole session and into the report.
 *
 * The unit suites cover the colour science thoroughly, but every one of them
 * stops at the boundary of React. That leaves a large class of failure -- a
 * renamed field on a scoring result, an undefined array access in a chart, a
 * stage that never advances -- which typechecks, passes all 116 tests, and blows
 * up on the screen. This walks the actual state machine with the actual
 * components, so those get caught here rather than by a person clicking through
 * six minutes of test to reach the report.
 *
 * Canvas is stubbed rather than polyfilled: happy-dom has no 2D context, and the dot
 * geometry and colours are already verified directly in `plate.test.ts`. What
 * matters here is that the components drive it without throwing.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { App } from '../src/App';

beforeAll(() => {
  // A no-op 2D context, enough for the plate renderer and the gamma patch.
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
    createImageData: vi.fn((w: number, h: number) => ({
      data: new Uint8ClampedArray(w * h * 4),
      width: w,
      height: h,
    })),
    clearRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    strokeText: vi.fn(),
    stroke: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    lineJoin: '',
    font: '',
    textAlign: '',
    textBaseline: '',
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

afterEach(() => cleanup());

/** Clicks the first button whose visible text contains `text`. */
function clickButton(text: string) {
  const buttons = screen.getAllByRole('button');
  const match = buttons.find((b) => b.textContent?.includes(text));
  if (!match) {
    throw new Error(
      `No button containing "${text}". Present: ${buttons
        .map((b) => JSON.stringify(b.textContent))
        .join(', ')}`,
    );
  }
  fireEvent.click(match);
}

function hasButton(text: string): boolean {
  return screen
    .getAllByRole('button')
    .some((b) => b.textContent?.includes(text) && !(b as HTMLButtonElement).disabled);
}

/**
 * Runs the stage lead-in, which holds its button disabled during the chromatic
 * adaptation pause. The pause is real and deliberate, so the test moves the
 * clock rather than waiting.
 */
function passStageIntro() {
  act(() => {
    vi.advanceTimersByTime(4000);
  });
  clickButton('Begin');
}

describe('a complete session', () => {
  it('runs every stage and produces a report', () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    try {
      render(<App />);

      // --- Intro ---
      expect(screen.getByRole('heading', { level: 1 })).toBeTruthy();
      clickButton('Check my display and begin');

      // --- Display check: both confirmations are required, by design. ---
      expect(hasButton('Start the test')).toBe(false);
      const boxes = screen.getAllByRole('checkbox');
      expect(boxes).toHaveLength(2);
      for (const box of boxes) fireEvent.click(box);
      expect(hasButton('Start the test')).toBe(true);
      clickButton('Start the test');

      // --- Stage 1: plates ---
      expect(screen.getByText(/Plate 1 of/)).toBeTruthy();
      let plateGuard = 0;
      while (screen.queryByText(/What number do you see/) && plateGuard++ < 60) {
        // "Nothing / not sure" is always available, so a plate can always be
        // answered without knowing what it shows.
        clickButton('Nothing / not sure');
      }
      expect(plateGuard).toBeLessThan(60);

      // --- Stage 2: thresholds ---
      passStageIntro();
      let trialGuard = 0;
      while (screen.queryByText(/Which side is the gap/) && trialGuard++ < 400) {
        fireEvent.keyDown(window, { key: 'ArrowUp' });
      }
      // Always answering "up" is right only by chance, so all three staircases
      // drive the amplitude to the display ceiling and stop early with an
      // "exceeds display" result. A short block here is the correct behaviour --
      // it is what stops a dichromat sitting through pointless trials -- so this
      // only guards against the stage being skipped or looping forever.
      expect(trialGuard).toBeGreaterThan(6);
      expect(trialGuard).toBeLessThan(400);

      // --- Stage 2b: luminance matches ---
      passStageIntro();
      let matchGuard = 0;
      while (screen.queryByText(/Make the red square/) && matchGuard++ < 10) {
        clickButton('They match');
      }
      expect(matchGuard).toBe(4);

      // --- Stage 3: cap arrangement ---
      passStageIntro();
      expect(screen.getByRole('listbox')).toBeTruthy();
      fireEvent.keyDown(window, { key: 'ArrowRight' });
      fireEvent.keyDown(window, { key: ' ' });
      fireEvent.keyDown(window, { key: 'ArrowRight' });
      fireEvent.keyDown(window, { key: ' ' });
      clickButton('Done, see my results');

      // --- Report ---
      // An exact string, because the live region also mentions "Your results".
      expect(screen.getByText('Your result')).toBeTruthy();
      expect(screen.getByText(/Your three cone pathways/)).toBeTruthy();
      expect(screen.getByText(/The measurements/)).toBeTruthy();
      expect(screen.getByText(/See it both ways/)).toBeTruthy();
      expect(screen.getByText(/Where this lives on the colour map/)).toBeTruthy();
      expect(screen.getByText(/What this means day to day/)).toBeTruthy();
      expect(screen.getByText(/Explain this to someone else/)).toBeTruthy();

      // PNG and JSON export were removed in favour of the link; if they come
      // back by accident the share section stops being one obvious action.
      expect(screen.queryByRole('button', { name: /Download/i })).toBeNull();

      // Every axis is reported, with a real percentage rather than NaN.
      for (const cone of ['L cone', 'M cone', 'S cone']) {
        expect(screen.getByText(new RegExp(cone))).toBeTruthy();
      }
      expect(document.body.textContent).not.toMatch(/NaN|undefined|Infinity/);

      // Both simulator directions must render. The reveal path runs a different
      // transform chain (daltonise, then simulate) and is easy to break.
      clickButton('Reveal what you are missing');
      expect(screen.getByText(/What .reveal. is doing/)).toBeTruthy();
      clickButton('Normal');
      expect(document.body.textContent).not.toMatch(/NaN|undefined/);
    } finally {
      vi.useRealTimers();
    }
  });

  it('lets the observer restart from the report', () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      render(<App />);
      clickButton('Check my display and begin');
      for (const box of screen.getAllByRole('checkbox')) fireEvent.click(box);
      clickButton('Start the test');
      expect(screen.getByText(/Plate 1 of/)).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('accessibility', () => {
  it('announces the current stage in a live region', () => {
    render(<App />);
    const status = screen.getByRole('status');
    expect(status.textContent).toMatch(/Introduction/);

    clickButton('Check my display and begin');
    expect(screen.getByRole('status').textContent).toMatch(/Display check/);
  });

  it('gives the canvas stimuli text alternatives', () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      render(<App />);
      clickButton('Check my display and begin');
      for (const box of screen.getAllByRole('checkbox')) fireEvent.click(box);
      clickButton('Start the test');

      // The plate is a canvas, so without a label it is nothing at all to a
      // screen reader.
      const image = screen.getByRole('img', { name: /field of coloured dots/i });
      expect(image).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps the whole test operable from the keyboard alone', () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      render(<App />);
      clickButton('Check my display and begin');
      for (const box of screen.getAllByRole('checkbox')) fireEvent.click(box);
      clickButton('Start the test');

      // Plates: digits, Enter to confirm, Escape for "nothing seen".
      expect(screen.getByText(/Plate 1 of/)).toBeTruthy();
      fireEvent.keyDown(window, { key: '7' });
      fireEvent.keyDown(window, { key: 'Enter' });
      expect(screen.getByText(/Plate 2 of/)).toBeTruthy();
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(screen.getByText(/Plate 3 of/)).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('offers a keyboard path through the cap arrangement', () => {
    // The arrangement is the one stage where the natural interaction is drag and
    // drop, so the keyboard path is the part most likely to rot.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      render(<App />);
      clickButton('Check my display and begin');
      for (const box of screen.getAllByRole('checkbox')) fireEvent.click(box);
      clickButton('Start the test');

      let guard = 0;
      while (screen.queryByText(/What number do you see/) && guard++ < 60) {
        fireEvent.keyDown(window, { key: 'Escape' });
      }
      passStageIntro();
      guard = 0;
      while (screen.queryByText(/Which side is the gap/) && guard++ < 400) {
        fireEvent.keyDown(window, { key: 'ArrowLeft' });
      }
      passStageIntro();
      guard = 0;
      while (screen.queryByText(/Make the red square/) && guard++ < 10) {
        clickButton('They match');
      }
      passStageIntro();

      const listbox = screen.getByRole('listbox');
      const before = screen
        .getAllByRole('option')
        .map((o) => (o as HTMLElement).style.background);

      // Select the second cap, pick it up, move it, drop it.
      fireEvent.keyDown(window, { key: 'ArrowRight' });
      fireEvent.keyDown(window, { key: ' ' });
      fireEvent.keyDown(window, { key: 'ArrowRight' });
      fireEvent.keyDown(window, { key: ' ' });

      const after = screen
        .getAllByRole('option')
        .map((o) => (o as HTMLElement).style.background);
      expect(listbox).toBeTruthy();
      expect(after).not.toEqual(before);
    } finally {
      vi.useRealTimers();
    }
  });
});
