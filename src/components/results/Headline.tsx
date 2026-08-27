/**
 * The result hero.
 *
 * Three facts carry this section: what it is, how severe, and how common. Only
 * the first needs words -- severity is an arc gauge and prevalence is a
 * pictogram, both of which land faster than the sentences they replace and are
 * harder to misread than "roughly 6 in 100".
 */
import type { Assessment } from '../../engine/classify';
import { Pictogram } from '../viz/Pictogram';
import { SeverityGauge } from '../viz/SeverityGauge';

const CONFIDENCE_NOTE: Record<Assessment['confidence'], string> = {
  high: 'All four stages agreed.',
  moderate: 'Mostly consistent; a retest could shift the detail.',
  low: 'Mixed evidence, or close to a boundary.',
};

export function Headline({ assessment }: { assessment: Assessment }) {
  const deficiency = assessment.verdict === 'deficiency' && assessment.axis;

  return (
    <section className="stack">
      <p className="faint mono">Your result</p>
      <h1 style={{ marginBottom: 'var(--space-2)' }}>{assessment.headline}</h1>

      <div className="row" style={{ gap: 'var(--space-4)' }}>
        <ConfidenceChip assessment={assessment} />
        <span className="faint">{CONFIDENCE_NOTE[assessment.confidence]}</span>
        {deficiency && (
          <span className="faint">
            {assessment.severityLabel === 'complete'
              ? 'Two working colour channels, not three'
              : 'Three channels, one pair poorly separated'}
          </span>
        )}
      </div>

      <p className="lede">{assessment.plainSummary}</p>

      {deficiency && assessment.axis && (
        <div className="hero-viz">
          <div className="card hero-viz__item">
            <SeverityGauge assessment={assessment} />
            <p className="faint hero-viz__cap">Severity</p>
          </div>
          <div className="card hero-viz__item">
            <Pictogram axis={assessment.axis} />
            <p className="faint hero-viz__cap">How common</p>
          </div>
        </div>
      )}

      {assessment.caveats.length > 0 && (
        <div className="callout">
          <div className="callout__title">About this run</div>
          <ul style={{ marginBottom: 0 }}>
            {assessment.caveats.map((caveat) => (
              <li key={caveat}>{caveat}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function ConfidenceChip({ assessment }: { assessment: Assessment }) {
  const colors: Record<Assessment['confidence'], string> = {
    high: 'var(--ok)',
    moderate: 'var(--warn)',
    low: 'var(--danger)',
  };

  return (
    <span
      className="chip"
      style={{ borderColor: colors[assessment.confidence] }}
      title={`Confidence score ${(assessment.confidenceScore * 100).toFixed(0)} out of 100`}
    >
      <span
        className="chip__dot"
        style={{ background: colors[assessment.confidence] }}
        aria-hidden="true"
      />
      {assessment.confidence} confidence
    </span>
  );
}
