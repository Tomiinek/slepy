/**
 * Stage 2: four-alternative forced choice on the gap in a Landolt C.
 *
 * Forced choice really is forced -- there is no "not sure" here, and that is
 * deliberate. With four options, guessing scores 25%, and the staircase is built
 * around that known floor. Letting people abstain would remove the floor and make
 * the threshold estimate depend on their willingness to guess rather than on what
 * they can see.
 */
import { useEffect, useMemo } from 'react';
import { generateLandolt, type Orientation } from '../../stimuli/landolt';
import type { ThresholdTrialRequest } from '../../engine/thresholdBlock';
import { PlateCanvas } from '../PlateCanvas';
import { useStimulusSize } from '../../util/useMedia';

interface Props {
  readonly trial: ThresholdTrialRequest;
  readonly trialCount: number;
  readonly estimatedRemaining: number;
  readonly onAnswer: (orientation: Orientation) => void;
}

const ARROWS: { orientation: Orientation; key: string; glyph: string; label: string }[] = [
  { orientation: 'up', key: 'ArrowUp', glyph: '\u25b2', label: 'Gap at the top' },
  { orientation: 'right', key: 'ArrowRight', glyph: '\u25b6', label: 'Gap on the right' },
  { orientation: 'down', key: 'ArrowDown', glyph: '\u25bc', label: 'Gap at the bottom' },
  { orientation: 'left', key: 'ArrowLeft', glyph: '\u25c0', label: 'Gap on the left' },
];

export function ThresholdStage({ trial, trialCount, estimatedRemaining, onAnswer }: Props) {
  const size = useStimulusSize();

  const spec = useMemo(
    () =>
      generateLandolt({
        axis: trial.axis,
        amplitude: trial.amplitude,
        orientation: trial.orientation,
        diameter: 520,
        seed: trial.seed,
        id: `threshold-${trial.index}`,
      }),
    [trial],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const match = ARROWS.find((a) => a.key === e.key);
      if (match) {
        onAnswer(match.orientation);
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onAnswer]);

  return (
    <div className="adaptation-field">
      <p className="stimulus-help stimulus-help--top" aria-live="polite">
        Which side is the gap in the ring on? Trial {trialCount + 1}, roughly{' '}
        {estimatedRemaining} to go.
      </p>

      <PlateCanvas
        spec={spec}
        size={size}
        label="A ring made of coloured dots with a gap in one side, on a background of grey dots."
      />

      <div className="field-controls" role="group" aria-label="Gap direction">
        {ARROWS.map((arrow) => (
          <button
            key={arrow.orientation}
            type="button"
            className="field-btn"
            style={{ fontSize: '1.3rem', minWidth: 68 }}
            onClick={() => onAnswer(arrow.orientation)}
            aria-label={arrow.label}
          >
            {arrow.glyph}
          </button>
        ))}
      </div>

      <p className="stimulus-help stimulus-help--bottom">
        Use the <kbd>&larr;</kbd> <kbd>&uarr;</kbd> <kbd>&rarr;</kbd> <kbd>&darr;</kbd> keys. Many
        of these are meant to be right at the edge of what you can see &mdash; when you genuinely
        cannot tell, pick one anyway. The test accounts for guessing.
      </p>
    </div>
  );
}
