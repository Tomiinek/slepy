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
import { analyseConfusions, describeFamily } from '../../analysis/confusables';
import type { Assessment } from '../../engine/classify';
import { CONE_LABEL } from '../../color/lms';
import { initial, otherVoice } from '../../copy/voice';
import { InheritanceDiagram } from '../viz/InheritanceDiagram';
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

  /**
   * Confusable pairs that no family already covers.
   *
   * Families only form where a whole group collapses together, which needs a
   * fairly strong deficiency. Milder results produce no families at all while
   * still losing dozens of individual pairs -- and this page exists to answer
   * "what will he mix up", so showing nothing there would be the one failure
   * that matters. Pairs fill that in, and are capped because a strong result
   * generates hundreds of them and the reader would stop reading long before.
   */
  const loosePairs = useMemo(() => {
    if (!analysis) return [];
    const familyOf = new Map<string, number>();
    analysis.families.forEach((family, i) => {
      for (const member of family.members) familyOf.set(member.name, i);
    });
    return analysis.pairs
      .filter((pair) => {
        const a = familyOf.get(pair.a.name);
        return a === undefined || a !== familyOf.get(pair.b.name);
      })
      // Pairs that brightness no longer rescues come first. They are the ones
      // worth a reader's attention, and at mild severities the default order
      // fills the list with pairs where one colour is plainly lighter -- true,
      // but it reads as overclaiming to someone checking the list against
      // their own eyes.
      .sort(
        (x, y) =>
          Number(x.brightnessStillSeparates) - Number(y.brightnessStillSeparates) ||
          y.lost - x.lost,
      )
      .slice(0, 12);
  }, [analysis]);

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

      {analysis && (analysis.families.length > 0 || analysis.pairs.length > 0) && (
        <>
          <hr />
          <section className="stack">
            <h2>Colours that look the same to {voice.object}</h2>
            <p className="muted">
              Every colour below is shown in true colour, as you see it. Grouped together, they
              arrive as one colour for {voice.object}.
            </p>

            {analysis.families.length > 0 && (
              <div className="stack">
                {analysis.families.map((family, i) => (
                  <div key={i} className="family">
                    <div className="family__head">
                      <strong>{describeFamily(family)}</strong>
                      <div className="faint">
                        {family.members.length} colours &mdash;{' '}
                        {family.indistinguishable
                          ? `one colour to ${voice.object}`
                          : `one colour to ${voice.object}, with only a brightness difference left`}
                      </div>
                    </div>
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
            )}

            {loosePairs.length > 0 && (
              <div className="stack">
                <h3 style={{ margin: 0 }}>
                  {analysis.families.length > 0 ? 'And these two at a time' : 'Two at a time'}
                </h3>
                <p className="muted" style={{ marginBottom: 0 }}>
                  The hue difference is gone in every pair below. In most, one is still clearly
                  lighter, which is the cue {voice.subject} lean{voice.s} on without thinking about
                  it &mdash; the marked ones do not even have that.
                </p>
                <div className="pair-grid">
                  {loosePairs.map((pair) => (
                    <div key={`${pair.a.name}-${pair.b.name}`} className="pair">
                      <span className="pair__chips" aria-hidden="true">
                        <span className="pair__chip" style={{ background: pair.a.hex }} />
                        <span className="pair__chip" style={{ background: pair.b.hex }} />
                      </span>
                      <span className="pair__names">
                        {pair.a.name} <span className="faint">&amp;</span> {pair.b.name}
                        {!pair.brightnessStillSeparates && (
                          <strong className="pair__flag"> &mdash; same brightness too</strong>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="faint">
              Out of {analysis.colors.length} everyday colours,{' '}
              {Math.round(analysis.collapseRate * 100)}% of the pairs that look clearly different to
              you lose that difference for {voice.object}.
            </p>
          </section>
        </>
      )}

      <hr />

      <section className="stack">
        <h2>Where it came from, and where it goes</h2>
        <p className="muted">
          {initial(voice.subject)} {voice.was} born with this and it will not change. The one part
          that is worth knowing in advance is what happens in the next generation.
        </p>
        {redGreen ? (
          <div className="card stack stack--tight">
            <InheritanceDiagram voice={voice} />
          </div>
        ) : (
          <div className="card stack stack--tight">
            <h3>If you have children together</h3>
            <p style={{ marginBottom: 0 }}>
              This is the blue-yellow axis, which is not carried on the X chromosome, so it does not
              skip down the male line the way the common red-green kind does. It is also rare enough
              that it is worth {voice.possessive} while having it checked properly.
            </p>
          </div>
        )}
      </section>

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
