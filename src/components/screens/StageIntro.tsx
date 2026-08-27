/**
 * The pause between stages, which does real work rather than just explaining.
 *
 * Chromatic adaptation takes a few seconds to settle, and it settles to whatever
 * has been filling the visual field. Coming straight from the dark app chrome
 * into a chromatic stimulus would mean the first few trials of each stage are
 * measured in a different adaptation state from the rest -- and since the
 * classifier's main signal is the *ratio* between axes, a drift like that maps
 * directly onto a wrong answer. So this screen shows the same mid-grey field the
 * stage will use, and holds it for a few seconds before the button becomes live.
 */
import { useEffect, useState } from 'react';

interface Props {
  readonly title: string;
  readonly children: React.ReactNode;
  readonly onContinue: () => void;
  readonly adaptSeconds?: number;
  readonly buttonLabel?: string;
}

export function StageIntro({
  title,
  children,
  onContinue,
  adaptSeconds = 3,
  buttonLabel = 'Begin',
}: Props) {
  const [remaining, setRemaining] = useState(adaptSeconds);

  useEffect(() => {
    setRemaining(adaptSeconds);
    if (adaptSeconds <= 0) return;

    const started = Date.now();
    const timer = window.setInterval(() => {
      const left = adaptSeconds - (Date.now() - started) / 1000;
      setRemaining(left > 0 ? left : 0);
      if (left <= 0) window.clearInterval(timer);
    }, 100);

    return () => window.clearInterval(timer);
  }, [adaptSeconds]);

  const ready = remaining <= 0;

  return (
    <div className="adaptation-field">
      <div
        style={{
          maxWidth: '52ch',
          background: 'rgb(255 255 255 / 0.22)',
          borderRadius: 'var(--radius-lg)',
          padding: 'var(--space-5)',
          color: '#181818',
        }}
      >
        <h2 style={{ marginTop: 0 }}>{title}</h2>
        <div className="stage-intro__body">{children}</div>
      </div>

      <div className="field-controls">
        <button
          type="button"
          className="field-btn field-btn--wide"
          onClick={onContinue}
          disabled={!ready}
        >
          {ready ? buttonLabel : `Adjusting to the grey\u2026 ${Math.ceil(remaining)}`}
        </button>
      </div>

      <p className="stimulus-help" aria-live="polite">
        {ready
          ? 'Take your time. Accuracy matters more than speed.'
          : 'Letting your eyes settle on the grey every stage is measured against.'}
      </p>
    </div>
  );
}
