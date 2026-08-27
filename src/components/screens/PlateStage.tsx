/**
 * Stage 1: read the figure hidden in the dots.
 *
 * The "nothing / not sure" button is not a courtesy. Without an explicit way to
 * say "I see no number", people guess, and a guess that happens to be right is
 * indistinguishable from actually seeing the figure. Offering the honest option
 * is what keeps the plate scores interpretable.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { generatePlate } from '../../stimuli/plate';
import { digitMask } from '../../stimuli/digitMask';
import type { PlatePlan } from '../../stimuli/plateSet';
import { PlateCanvas } from '../PlateCanvas';
import { useViewportWidth } from '../../util/useMedia';

interface Props {
  readonly plan: PlatePlan;
  readonly index: number;
  readonly total: number;
  readonly onAnswer: (response: string | null) => void;
}

export function PlateStage({ plan, index, total, onAnswer }: Props) {
  const [entry, setEntry] = useState('');
  const viewport = useViewportWidth();
  const size = Math.max(280, Math.min(520, viewport - 80));

  // Mirrored in a ref so the key handler can read the current entry without
  // being re-bound on every keystroke, and without reading it from inside a
  // state updater -- updaters must stay pure, and calling the parent's
  // `onAnswer` from one triggers a setState during render.
  const entryRef = useRef('');
  const commit = (next: string) => {
    entryRef.current = next;
    setEntry(next);
  };

  const spec = useMemo(
    () =>
      generatePlate({
        mode: plan.mode,
        axis: plan.axis,
        answer: plan.answer,
        amplitudeFraction: plan.amplitudeFraction,
        diameter: 520,
        mask: digitMask(plan.answer),
        seed: plan.seed,
        id: plan.id,
      }),
    [plan],
  );

  useEffect(() => {
    entryRef.current = '';
    setEntry('');
  }, [plan.id]);

  // Digits and Enter/Escape work without touching the mouse.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const current = entryRef.current;

      if (e.key >= '0' && e.key <= '9') {
        // Answers are at most two digits, so a third keystroke starts over
        // rather than being silently dropped.
        commit(current.length >= 2 ? e.key : current + e.key);
        e.preventDefault();
      } else if (e.key === 'Backspace') {
        commit(current.slice(0, -1));
        e.preventDefault();
      } else if (e.key === 'Enter') {
        if (current.length > 0) onAnswer(current);
        e.preventDefault();
      } else if (e.key === 'Escape') {
        onAnswer(null);
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onAnswer]);

  return (
    <div className="adaptation-field">
      <p className="stimulus-help" aria-live="polite">
        Plate {index + 1} of {total}. What number do you see?
      </p>

      <PlateCanvas
        spec={spec}
        size={size}
        label={`A circular field of coloured dots which may contain a number. Plate ${index + 1} of ${total}.`}
      />

      <div className="field-controls" role="group" aria-label="Number entry">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].map((digit) => (
          <button
            key={digit}
            type="button"
            className="field-btn"
            onClick={() => commit(entry.length >= 2 ? digit : entry + digit)}
          >
            {digit}
          </button>
        ))}
      </div>

      <div className="field-controls">
        <div
          className="mono"
          aria-live="polite"
          style={{
            minWidth: 96,
            textAlign: 'center',
            fontSize: '1.4rem',
            background: '#6b6b6b',
            color: '#f4f4f4',
            borderRadius: 'var(--radius)',
            padding: '8px 12px',
          }}
        >
          {entry || '\u2013\u2013'}
        </div>
        <button
          type="button"
          className="field-btn"
          onClick={() => commit(entry.slice(0, -1))}
          disabled={entry.length === 0}
        >
          Delete
        </button>
        <button
          type="button"
          className="field-btn field-btn--wide"
          onClick={() => onAnswer(entry)}
          disabled={entry.length === 0}
        >
          Confirm
        </button>
        <button
          type="button"
          className="field-btn field-btn--wide"
          onClick={() => onAnswer(null)}
        >
          Nothing / not sure
        </button>
      </div>

      <p className="stimulus-help">
        Answer with the number keys and <kbd>Enter</kbd>, or press <kbd>Esc</kbd> if you cannot see
        a number. Guessing does not help you here &mdash; saying you see nothing is genuinely more
        useful than a lucky guess.
      </p>
    </div>
  );
}
