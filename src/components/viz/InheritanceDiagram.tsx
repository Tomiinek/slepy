/**
 * X-linked inheritance as a diagram instead of three paragraphs.
 *
 * This is the question people actually have, and the answer is a small set of
 * hard numbers -- 0%, 50%, 100% -- which is exactly the kind of thing prose is
 * bad at and a diagram is good at. The numbers differ depending on the visitor's
 * sex, so that is a toggle rather than two blocks of text explaining both cases.
 *
 * Red-green deficiency is X-linked recessive; the percentages below follow
 * directly from that and are not approximations.
 */
import { useState } from 'react';

type Sex = 'male' | 'female';

interface Outcome {
  readonly label: string;
  readonly affected: number;
  readonly carrier: number;
  readonly note: string;
}

const OUTCOMES: Record<Sex, readonly Outcome[]> = {
  male: [
    { label: 'Your sons', affected: 0, carrier: 0, note: 'cannot inherit it from you' },
    { label: 'Your daughters', affected: 0, carrier: 100, note: 'all carriers' },
    { label: "Daughters' sons", affected: 50, carrier: 0, note: 'one in two' },
  ],
  female: [
    { label: 'Your sons', affected: 100, carrier: 0, note: 'all affected' },
    { label: 'Your daughters', affected: 0, carrier: 100, note: 'at least carriers' },
    { label: 'Your father', affected: 100, carrier: 0, note: 'also affected' },
  ],
};

export function InheritanceDiagram() {
  const [sex, setSex] = useState<Sex>('male');

  return (
    <div className="stack stack--tight">
      <div className="row row--between">
        <h3>Who else in the family</h3>
        <div className="seg seg--small" role="group" aria-label="Your sex, for inheritance figures">
          {(['male', 'female'] as const).map((option) => (
            <button
              key={option}
              type="button"
              className={`seg__btn ${sex === option ? 'seg__btn--on' : ''}`}
              onClick={() => setSex(option)}
              aria-pressed={sex === option}
            >
              {option === 'male' ? 'I am male' : 'I am female'}
            </button>
          ))}
        </div>
      </div>

      <div className="inherit">
        {OUTCOMES[sex].map((outcome) => {
          const value = outcome.affected || outcome.carrier;
          const isCarrier = outcome.affected === 0 && outcome.carrier > 0;
          return (
            <div key={outcome.label} className="inherit__cell">
              <div
                className="inherit__dial"
                style={{
                  // Conic gradient reads as a filled proportion without needing a
                  // second element or an axis.
                  background: `conic-gradient(${
                    isCarrier ? 'var(--warn)' : value === 0 ? 'var(--ok)' : 'var(--danger)'
                  } ${value * 3.6}deg, var(--bg-raised-2) 0)`,
                }}
              >
                <span>{value}%</span>
              </div>
              <div className="inherit__label">{outcome.label}</div>
              <div className="inherit__note faint">
                {isCarrier ? 'carriers' : outcome.note}
              </div>
            </div>
          );
        })}
      </div>

      <p className="faint" style={{ marginBottom: 0 }}>
        Carriers usually see normally. It travels down the mother&rsquo;s side, so a maternal
        grandfather or a brother is the most likely match.
      </p>
    </div>
  );
}
