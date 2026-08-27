import { CONE_LABEL, CVD_AXES } from '../../color/lms';
import { summarisePlates } from '../../engine/scoring/plates';
import { matchReferences } from '../../engine/luminanceMatch';
import type { SessionResults } from '../../session/types';

export function NumbersPanel({ results }: { results: SessionResults }) {
  const { assessment, arrangement, luminance } = results;
  const summary = summarisePlates(results.plates);
  const references = matchReferences();

  return (
    <section className="stack">
      <h2>The measurements</h2>
      <p className="muted">
        Smallest colour difference you could detect, as u&prime;v&prime; distance &times;10
        <sup>&minus;4</sup>. Lower is better. <strong>Elevation</strong> &mdash; the ratio against
        your own other axes &mdash; is what drives the result, because a ratio survives an
        uncalibrated screen and an absolute number does not.
      </p>

      <div className="table-wrap">
        <table>
          <caption className="visually-hidden">
            Detection threshold for each cone axis against the typical range
          </caption>
          <thead>
            <tr>
              <th scope="col">Axis</th>
              <th scope="col">Your threshold</th>
              <th scope="col">Typical</th>
              <th scope="col">Elevation</th>
              <th scope="col">Where you sit</th>
            </tr>
          </thead>
          <tbody>
            {CVD_AXES.map((axis) => {
              const metric = assessment.axisMetrics.find((m) => m.axis === axis)!;
              const capped = metric.outcome === 'exceeds-display';
              return (
                <tr key={axis}>
                  <th scope="row">{CONE_LABEL[axis]}</th>
                  <td className="mono">
                    {capped ? '\u2265 ' : ''}
                    {metric.thresholdUnits.toFixed(0)}
                  </td>
                  <td className="mono faint">
                    {metric.normalMedianUnits.toFixed(0)}&ndash;
                    {metric.normalUpperUnits.toFixed(0)}
                  </td>
                  <td className="mono">
                    {capped ? '\u2265 ' : ''}
                    {metric.elevation.toFixed(1)}&times;
                  </td>
                  <td>
                    <ElevationScale elevation={metric.elevation} capped={capped} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="grid grid--3">
        <Stat
          label="Red-green plates read"
          value={`${summary.redGreen.correct} / ${summary.redGreen.total}`}
          note={
            summary.valid
              ? `Controls passed ${summary.controlsPassed}/${summary.controlsTotal}.`
              : 'A control plate was missed \u2014 likely a distraction or display issue.'
          }
        />
        <Stat
          label="Ordering error score"
          value={arrangement.totalErrorScore.toFixed(0)}
          note={
            arrangement.matchedAxis
              ? `Mistakes ran along the ${CONE_LABEL[arrangement.matchedAxis]} axis.`
              : 'No direction in the mistakes \u2014 a normal pattern.'
          }
        />
        <Stat
          label="Red brightness match"
          value={`${luminance.scale.toFixed(2)}\u00d7`}
          chart={
            <MarkerScale
              value={luminance.scale}
              refs={[
                { at: references.normal, label: 'typical' },
                { at: references.protan, label: 'protan' },
              ]}
            />
          }
        />
      </div>

      <details className="card">
        <summary>
          <strong>Every piece of evidence, including what disagreed</strong>
        </summary>
        <p className="muted">
          Four independent stages. Where they conflict, confidence drops rather than the conflict
          being hidden.
        </p>
        <ul className="evidence">
          {assessment.evidence.map((item) => (
            <li key={item.label} className={item.supports ? '' : 'evidence--against'}>
              <span className="evidence__mark" aria-hidden="true">
                {item.supports ? '\u2713' : '\u2717'}
              </span>
              <div>
                <strong>{item.label}</strong>{' '}
                <span className="chip chip--sm">{item.weight}</span>
                <div className="muted">{item.detail}</div>
              </div>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}

function Stat({
  label,
  value,
  note,
  chart,
}: {
  label: string;
  value: string;
  note?: string;
  chart?: React.ReactNode;
}) {
  return (
    <div className="card card--inset stack stack--tight">
      <div className="faint">{label}</div>
      <div className="mono" style={{ fontSize: '1.6rem', fontWeight: 700 }}>
        {value}
      </div>
      {chart}
      {note && <div className="faint">{note}</div>}
    </div>
  );
}

/**
 * Where a value sits relative to named reference points.
 *
 * Two reference settings and the visitor's own, on one axis, replaces a sentence
 * quoting all three numbers -- and shows which reference it is nearer, which is
 * the actual question.
 */
function MarkerScale({
  value,
  refs,
}: {
  value: number;
  refs: readonly { at: number; label: string }[];
}) {
  const lo = Math.min(value, ...refs.map((r) => r.at)) * 0.85;
  const hi = Math.max(value, ...refs.map((r) => r.at)) * 1.15;
  const pos = (v: number) => ((v - lo) / (hi - lo)) * 100;

  return (
    <div className="mscale">
      <div className="mscale__track" />
      {refs.map((ref) => (
        <div key={ref.label} className="mscale__ref" style={{ left: `${pos(ref.at)}%` }}>
          <span className="mscale__reftick" />
          <span className="mscale__reflabel">{ref.label}</span>
        </div>
      ))}
      <div className="mscale__you" style={{ left: `${pos(value)}%` }} title="Your setting">
        <span className="visually-hidden">Your setting</span>
      </div>
    </div>
  );
}

/** Log-scaled position marker, since elevation spans 1x to 10x. */
function ElevationScale({ elevation, capped }: { elevation: number; capped: boolean }) {
  const position = Math.min(1, Math.max(0, Math.log(elevation) / Math.log(12)));

  return (
    <div className="elev">
      <div className="elev__normal" title="Typical range" />
      <div
        className="elev__marker"
        style={{ left: `${position * 100}%` }}
        title={`${capped ? 'at least ' : ''}${elevation.toFixed(1)} times typical`}
      />
    </div>
  );
}
