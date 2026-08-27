/**
 * "What this means" -- the practical section.
 *
 * Deliberately visual: the situations are shown rather than listed, and the
 * inheritance figures are a diagram rather than a paragraph, because both are
 * things prose describes slowly and a picture states immediately.
 *
 * The OS filter paths stay as a table. They are lookup facts, not explanation,
 * and a table is already the tersest form for that.
 */
import type { Assessment } from '../../engine/classify';
import { InheritanceDiagram } from '../viz/InheritanceDiagram';
import { SceneGrid } from '../viz/SceneGrid';

const FILTER_PATHS: readonly (readonly [string, string])[] = [
  ['macOS / iOS', 'Accessibility \u2192 Display \u2192 Colour Filters'],
  ['Windows', 'Accessibility \u2192 Colour filters'],
  ['Android', 'Accessibility \u2192 Colour correction'],
];

export function Implications({ assessment }: { assessment: Assessment }) {
  const axis = assessment.verdict === 'deficiency' ? assessment.axis : null;
  const redGreen = axis === 'protan' || axis === 'deutan';
  const vision = assessment.vision ?? { axis: 'deutan' as const, severity: 1 };

  return (
    <section className="stack">
      <h2>What this means day to day</h2>

      {axis ? (
        <>
          <SceneGrid vision={vision} redGreen={redGreen} />

          <div className="grid grid--2">
            <div className="card stack stack--tight">
              <h3>Turn on a colour filter</h3>
              <table className="kv">
                <tbody>
                  {FILTER_PATHS.map(([os, path]) => (
                    <tr key={os}>
                      <th scope="row">{os}</th>
                      <td>{path}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="faint" style={{ marginBottom: 0 }}>
                Filters boost the contrast you can use. They do not restore the missing signal.
              </p>
            </div>

            <div className="card stack stack--tight">
              {redGreen ? (
                <InheritanceDiagram />
              ) : (
                <>
                  <h3>Who else in the family</h3>
                  <p style={{ marginBottom: 0 }}>
                    Inherited blue-yellow deficiency is autosomal, so it affects men and women
                    equally. It is also rare enough that an <strong>acquired</strong> cause is more
                    likely &mdash; the main reason to get this one checked properly.
                  </p>
                </>
              )}
            </div>
          </div>

          {redGreen && (
            <div className="callout callout--ok">
              <div className="callout__title">Driving is very probably fine</div>
              <p style={{ marginBottom: 0 }}>
                Signals are redundant by design: fixed position, standard order, an orange-biased
                red. Distant single signals and brake lights on a red-lit road are the harder cases.
              </p>
            </div>
          )}
        </>
      ) : (
        <div className="card stack stack--tight">
          <h3>Your colour discrimination looks typical</h3>
          <p style={{ marginBottom: 0 }}>
            No axis was elevated. On an uncalibrated screen this cannot rule out a very mild
            anomaly. If you design or build anything, the simulator above is still worth a minute
            &mdash; about 1 in 12 men sees your colour coding that way.
          </p>
        </div>
      )}

      <div className="card stack stack--tight">
        <h3>Want the definitive version?</h3>
        <p style={{ marginBottom: 0 }}>
          The gold standard is an <strong>anomaloscope</strong>, which matches red and green light
          directly and is the only instrument that really pins down type and degree. Worth asking
          about if your colour vision has <strong>changed</strong> rather than always been this way.
        </p>
      </div>
    </section>
  );
}
