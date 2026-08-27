/**
 * X-linked inheritance as a diagram instead of three paragraphs.
 *
 * This is the question people actually have, and the answer is a small set of
 * hard numbers -- 0%, 50%, 100% -- which is exactly the kind of thing prose is
 * bad at and a diagram is good at. The numbers differ depending on the affected
 * person's sex, so that is a toggle rather than two blocks of text explaining
 * both cases.
 *
 * On a shared link the same figures answer a different question -- "what happens
 * if we have children" -- asked by the co-parent rather than by the affected
 * person. The children are the same children either way, so only the wording
 * changes, via `Voice`. The one row that is not about children (an affected
 * woman's father is always affected too) is relabelled rather than dropped,
 * because it is often how a family works out where it came from.
 *
 * Red-green deficiency is X-linked recessive; the percentages below follow
 * directly from that and are not approximations. They do assume the other parent
 * is neither affected nor a carrier, which the closing note states.
 */
import { useState } from 'react';
import { SELF, initial, type Voice } from '../../copy/voice';

type Sex = 'male' | 'female';

interface Outcome {
  /** Label in the self voice, i.e. addressed to the affected person. */
  readonly label: string;
  /** Label when addressing a co-parent about the same children. */
  readonly sharedLabel: string;
  readonly affected: number;
  readonly carrier: number;
  readonly note: string;
}

const OUTCOMES: Record<Sex, readonly Outcome[]> = {
  male: [
    {
      label: 'Your sons',
      sharedLabel: 'Sons',
      affected: 0,
      carrier: 0,
      note: 'cannot inherit it',
    },
    {
      label: 'Your daughters',
      sharedLabel: 'Daughters',
      affected: 0,
      carrier: 100,
      note: 'all carriers',
    },
    {
      label: "Daughters' sons",
      sharedLabel: "Daughters' sons",
      affected: 50,
      carrier: 0,
      note: 'one in two',
    },
  ],
  female: [
    {
      label: 'Your sons',
      sharedLabel: 'Sons',
      affected: 100,
      carrier: 0,
      note: 'all affected',
    },
    {
      label: 'Your daughters',
      sharedLabel: 'Daughters',
      affected: 0,
      carrier: 100,
      note: 'at least carriers',
    },
    {
      label: 'Your father',
      sharedLabel: 'Her father',
      affected: 100,
      carrier: 0,
      note: 'also affected',
    },
  ],
};

interface Props {
  readonly voice?: Voice;
}

export function InheritanceDiagram({ voice = SELF }: Props) {
  const [sex, setSex] = useState<Sex>('male');
  const subject = initial(voice.subject);

  return (
    <div className="stack stack--tight">
      <div className="row row--between">
        <h3>{voice.self ? 'Who else in the family' : 'If you have children together'}</h3>
        <div
          className="seg seg--small"
          role="group"
          aria-label={
            voice.self
              ? 'Your sex, for inheritance figures'
              : `Whether ${voice.subject} is male or female, for inheritance figures`
          }
        >
          {(['male', 'female'] as const).map((option) => (
            <button
              key={option}
              type="button"
              className={`seg__btn ${sex === option ? 'seg__btn--on' : ''}`}
              onClick={() => setSex(option)}
              aria-pressed={sex === option}
            >
              {voice.self
                ? option === 'male'
                  ? 'I am male'
                  : 'I am female'
                : `${subject} ${voice.is} ${option === 'male' ? 'male' : 'female'}`}
            </button>
          ))}
        </div>
      </div>

      <div className="inherit">
        {OUTCOMES[sex].map((outcome) => {
          const value = outcome.affected || outcome.carrier;
          const isCarrier = outcome.affected === 0 && outcome.carrier > 0;
          const label = voice.self ? outcome.label : outcome.sharedLabel;
          return (
            <div key={label} className="inherit__cell">
              <div
                className="inherit__dial"
                style={
                  {
                    // Conic gradient reads as a filled proportion without needing
                    // an axis. Handed to CSS as a variable because the ring is
                    // drawn on a pseudo-element -- see `.inherit__dial::before`.
                    '--dial': `conic-gradient(${
                      isCarrier ? 'var(--warn)' : value === 0 ? 'var(--ok)' : 'var(--danger)'
                    } ${value * 3.6}deg, var(--bg-raised-2) 0)`,
                  } as React.CSSProperties
                }
              >
                <span>{value}%</span>
              </div>
              <div className="inherit__label">{label}</div>
              <div className="inherit__note faint">{isCarrier ? 'carriers' : outcome.note}</div>
            </div>
          );
        })}
      </div>

      <p className="faint" style={{ marginBottom: 0 }}>
        Carriers see normally.{' '}
        {voice.self
          ? 'It travels down the mother\u2019s side, so a maternal grandfather or a brother is the most likely match.'
          : 'These figures assume you are neither affected nor a carrier yourself \u2014 if you are, daughters can be affected too.'}
      </p>
    </div>
  );
}
