/**
 * The page someone sees when they open a shared link.
 *
 * Different job from the report you get after taking the test. The reader has no
 * interest in threshold elevations; they clicked a link a friend or colleague
 * sent them, usually after asking a question. So this leads with the answers to
 * the questions people actually ask -- traffic lights first, because it is
 * always first -- and then shows the effect rather than describing it.
 *
 * Nothing here is a second copy of the classifier's output: it reads the same
 * assessment and just addresses a different person, via `Voice`.
 */
import { useMemo } from 'react';
import { analyseConfusions } from '../../analysis/confusables';
import type { Assessment } from '../../engine/classify';
import { CONE_LABEL } from '../../color/lms';
import { initial, otherVoice } from '../../copy/voice';
import { Pictogram } from '../viz/Pictogram';
import { SeverityGauge } from '../viz/SeverityGauge';
import { SceneGrid } from '../viz/SceneGrid';
import { Simulator } from '../results/Simulator';

interface Props {
  readonly assessment: Assessment;
  readonly name: string | null;
  readonly onTakeTest: () => void;
}

interface Myth {
  readonly question: string;
  readonly verdict: 'yes' | 'no' | 'sort of';
  readonly answer: string;
}

function myths(voice: ReturnType<typeof otherVoice>, redGreen: boolean, complete: boolean): Myth[] {
  const subject = voice.subject;
  const sees = voice.sees;

  const common: Myth[] = [
    {
      question: `So ${subject} can\u2019t see traffic lights?`,
      verdict: 'no',
      answer:
        'Signals are built for this: fixed positions, a standard order, and a red pushed toward orange. Position carries it, not hue.',
    },
    {
      question: `Does ${subject} see in black and white?`,
      verdict: 'no',
      answer: `That is a different, vanishingly rare condition. ${initial(subject)} ${sees} plenty of colour \u2014 two channels just overlap.`,
    },
    {
      question: 'Can it be fixed with glasses?',
      verdict: 'no',
      answer:
        'Tinted lenses and phone filters shift colours around to exaggerate what is left. They do not put back the missing signal.',
    },
    {
      question: 'Will it get worse?',
      verdict: 'no',
      answer: 'It is fixed from birth and stable for life. It is not damage or an illness.',
    },
  ];

  if (redGreen) {
    common.splice(2, 0, {
      question: `Can ${subject} see red at all?`,
      verdict: 'sort of',
      answer: complete
        ? `Red is not missing, it is unreadable *against* green and brown. On its own, ${subject} ${sees} it.`
        : `Yes. The trouble is separating red from green, brown and olive \u2014 not red itself.`,
    });
  }

  common.push({
    question: 'Is it worth pointing colours out?',
    verdict: 'yes',
    answer:
      'Saying the colour name is genuinely useful, and far better than a quiz. Guessing games get old fast.',
  });

  return common;
}

export function SharedReportScreen({ assessment, name, onTakeTest }: Props) {
  const voice = useMemo(() => otherVoice(name), [name]);
  const axis = assessment.verdict === 'deficiency' ? assessment.axis : null;
  const redGreen = axis === 'protan' || axis === 'deutan';
  const complete = assessment.severityLabel === 'complete';

  const analysis = useMemo(
    () => (assessment.vision ? analyseConfusions(assessment.vision) : null),
    [assessment.vision],
  );

  if (!axis || !assessment.vision) {
    return (
      <div className="shell stack">
        <p className="faint mono">Shared colour vision result</p>
        <h1>{initial(voice.subject)} came out with typical colour vision</h1>
        <p className="lede">
          No cone axis was unusual, so everyday colour coding should work for {voice.object} the same
          way it does for you.
        </p>
        <TakeItYourself onTakeTest={onTakeTest} />
      </div>
    );
  }

  return (
    <div className="shell stack stack--loose">
      <header className="stack">
        <p className="faint mono">Shared colour vision result</p>
        <h1 style={{ marginBottom: 'var(--space-2)' }}>
          {initial(voice.subject)} {voice.has} {assessment.name || assessment.headline.toLowerCase()}
        </h1>
        <p className="lede">
          {complete
            ? `${initial(voice.subject)} ${voice.sees} colour through two channels instead of three.`
            : `${initial(voice.subject)} ${voice.has} all three cone types, but the ${CONE_LABEL[axis]} pair report almost the same thing.`}{' '}
          Either way, a specific set of colours arrives looking identical &mdash; and it is a
          narrower set than most people assume.
        </p>

        <div className="hero-viz">
          <div className="card hero-viz__item">
            <SeverityGauge assessment={assessment} />
            <p className="faint hero-viz__cap">How strong</p>
          </div>
          <div className="card hero-viz__item">
            <Pictogram axis={axis} />
            <p className="faint hero-viz__cap">How common</p>
          </div>
        </div>
      </header>

      <section className="stack">
        <h2>The questions, answered</h2>
        <div className="myths">
          {myths(voice, redGreen, complete).map((myth) => (
            <div key={myth.question} className={`myth myth--${myth.verdict.replace(' ', '-')}`}>
              <div className="myth__verdict">{myth.verdict}</div>
              <div>
                <strong>{myth.question}</strong>
                <p className="muted" style={{ marginBottom: 0 }}>
                  {myth.answer}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <hr />

      <section className="stack">
        <h2>What {voice.subject} actually {voice.sees}</h2>
        <p className="muted">
          Every picture below is put through {voice.possessive} measured vision. Flip the toggle to
          compare.
        </p>
        <SceneGrid
          vision={assessment.vision}
          redGreen={redGreen}
          voice={voice}
          heading="Everyday situations"
        />
      </section>

      <hr />

      <Simulator assessment={assessment} voice={voice} />

      {analysis && analysis.families.length > 0 && (
        <>
          <hr />
          <section className="stack">
            <h2>Colours that look the same to {voice.object}</h2>
            <p className="muted">
              Roughly {Math.round(analysis.collapseRate * 100)}% of colour pairs lose their
              difference. Each row below arrives as effectively one colour.
            </p>
            <div className="stack">
              {analysis.families.slice(0, 4).map((family, i) => (
                <div key={i} className="family">
                  <div className="swatches">
                    {family.members.map((member) => (
                      <figure key={member.name} className="swatch">
                        <div className="swatch__chip" style={{ background: member.hex }} />
                        <figcaption>{member.name}</figcaption>
                      </figure>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="faint">
              Shown in true colour, as you see them. To {voice.object} the swatches in each row are
              near-identical.
            </p>
          </section>
        </>
      )}

      <hr />

      <section className="stack">
        <h2>Three things that genuinely help</h2>
        <div className="grid grid--3">
          <Tip title="Say the colour">
            Naming it in passing costs nothing. Asking {voice.object} to guess is the annoying
            version.
          </Tip>
          <Tip title="Never colour alone">
            In charts, diagrams and status lights, add a label, a shape or a position. Red-versus-green
            on its own carries no information for {voice.object}.
          </Tip>
          <Tip title="Skip the red pen">
            Red on dark, and red-green diverging scales, are the worst offenders. Viridis and direct
            labels fix most of it.
          </Tip>
        </div>
      </section>

      <TakeItYourself onTakeTest={onTakeTest} />
    </div>
  );
}

function Tip({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card card--inset stack stack--tight">
      <strong>{title}</strong>
      <p className="muted" style={{ marginBottom: 0 }}>
        {children}
      </p>
    </div>
  );
}

function TakeItYourself({ onTakeTest }: { onTakeTest: () => void }) {
  return (
    <div className="callout callout--info">
      <div className="callout__title">Curious about your own eyes?</div>
      <p>The test takes about six minutes and gives you a report like this one.</p>
      <button type="button" className="btn btn--primary" onClick={onTakeTest}>
        Take the test
      </button>
    </div>
  );
}
