/**
 * @vitest-environment happy-dom
 *
 * Layout contracts of the stage screens.
 *
 * Neither of the things these tests guard is visible in the DOM on its own --
 * both are enforced by CSS that keys off structure. happy-dom has no layout
 * engine, so the assertions are on the hooks the CSS needs rather than on
 * measured geometry:
 *
 *  - Every stage puts its instruction in the first paragraph and its hint in the
 *    last, each marked as a fixed-height slot. Those slots are what stop the
 *    stimulus sliding up and down when the wording changes mid-stage.
 *  - The caps live in a single container that sizes them to one row. A wrapped
 *    second row breaks the left-to-right reading of the sequence being tested.
 */
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { ArrangementStage } from '../src/components/screens/ArrangementStage';
import { PlateStage } from '../src/components/screens/PlateStage';
import { ThresholdStage } from '../src/components/screens/ThresholdStage';
import { LuminanceStage } from '../src/components/screens/LuminanceStage';
import { StageIntro } from '../src/components/screens/StageIntro';
import { buildPlateSet } from '../src/stimuli/plateSet';
import { CAP_COUNT } from '../src/stimuli/caps';
import { startingScales } from '../src/engine/luminanceMatch';

beforeAll(() => {
  const context = {
    scale: vi.fn(),
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    fillText: vi.fn(),
    strokeText: vi.fn(),
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
});

const plates = buildPlateSet(4242);
const order = Array.from({ length: CAP_COUNT }, (_, i) => i);

const STAGES: readonly [string, () => React.ReactElement][] = [
  ['plates', () => <PlateStage plan={plates[0]} index={0} total={17} onAnswer={() => {}} />],
  [
    'thresholds',
    () => (
      <ThresholdStage
        trial={{ axis: 'protan', amplitude: 0.02, orientation: 'up', seed: 1, index: 3 }}
        trialCount={3}
        estimatedRemaining={20}
        onAnswer={() => {}}
      />
    ),
  ],
  [
    'brightness',
    () => (
      <LuminanceStage repeat={0} total={3} start={startingScales()[0]} onSubmit={() => {}} />
    ),
  ],
  [
    'arrangement',
    () => <ArrangementStage order={order} onChange={() => {}} onSubmit={() => {}} />,
  ],
  [
    'stage intro',
    () => (
      <StageIntro title="Next up" onContinue={() => {}} adaptSeconds={0}>
        <p>Body</p>
      </StageIntro>
    ),
  ],
];

describe('the help text sits in fixed-height slots', () => {
  it.each(STAGES)('on the %s screen', (_name, renderStage) => {
    cleanup();
    const { container } = render(renderStage());
    const field = container.querySelector('.adaptation-field');
    expect(field).not.toBeNull();

    const helps = [...field!.querySelectorAll('.stimulus-help')];
    expect(helps.length).toBeGreaterThan(0);

    // The last paragraph is the hint under the controls on every screen; the
    // first is the instruction above the stimulus on every screen except the
    // stage intro, which leads with a card instead.
    expect(helps.at(-1)!.classList.contains('stimulus-help--bottom')).toBe(true);
    for (const help of helps) {
      const slotted =
        help.classList.contains('stimulus-help--top') ||
        help.classList.contains('stimulus-help--bottom');
      expect(slotted).toBe(true);
    }
  });
});

describe('the colour caps', () => {
  it('all sit in one container, so CSS can fit them to a single row', () => {
    cleanup();
    const { container } = render(
      <ArrangementStage order={order} onChange={() => {}} onSubmit={() => {}} />,
    );

    const caps = container.querySelectorAll('.caps');
    expect(caps).toHaveLength(1);
    expect(caps[0].querySelectorAll('.cap')).toHaveLength(CAP_COUNT);
  });

  it('keeps the hint in its slot when picking a cap up adds a sentence', () => {
    cleanup();
    const { container } = render(
      <ArrangementStage order={order} onChange={() => {}} onSubmit={() => {}} />,
    );

    const hint = () => container.querySelector('.stimulus-help--bottom')!;
    const before = hint().textContent ?? '';

    fireEvent.keyDown(window, { key: ' ' });

    const after = hint().textContent ?? '';
    expect(after.length).toBeGreaterThan(before.length);
    expect(after).toMatch(/arrow keys will move it/i);
    // Same element, same slot: the extra sentence must not have been appended
    // outside it, which is how it would start pushing the caps around again.
    expect(container.querySelectorAll('.stimulus-help--bottom')).toHaveLength(1);
  });
});
