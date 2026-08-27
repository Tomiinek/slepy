/**
 * Severity as an arc gauge.
 *
 * Replaces a paragraph explaining where the result sits between "none" and
 * "complete". Severity is a continuous 0..1 quantity, and an arc communicates
 * that far faster than words while also showing what the number is *out of*.
 *
 * The band ticks are placed at the positions the classifier actually uses, taken
 * from SEVERITY_BANDS and mapped through the same severity function. Spacing
 * them evenly instead would put the marker under "moderate" while the label
 * underneath read "mild", because severity is logarithmic in threshold
 * elevation and the bands are not evenly spaced in it.
 */
import type { Assessment } from '../../engine/classify';
import { SEVERITY_BANDS, severityFromElevation } from '../../engine/normative';

const WIDTH = 320;
const HEIGHT = 236;
const CX = WIDTH / 2;
const CY = 150;
const R = 88;
const STROKE = 18;

/** A 240-degree sweep opening downward, so the ends are the bottom corners. */
const START = 150;
const SWEEP = 240;

/**
 * "slight" is below the elevation at which an axis counts as affected, so it can
 * never be the verdict on a gauge that only renders for a deficiency. Showing it
 * would crowd the low end for no benefit.
 */
const TICK_BANDS = SEVERITY_BANDS.filter((band) => band.label !== 'slight')
  .map((band) => ({ label: band.label, at: severityFromElevation(band.minElevation) }))
  .sort((a, b) => a.at - b.at);

export function SeverityGauge({ assessment }: { assessment: Assessment }) {
  const severity =
    assessment.verdict === 'deficiency' ? Math.max(0.02, assessment.severity) : 0;
  const label = assessment.verdict === 'deficiency' ? assessment.severityLabel : 'none';

  const point = (fraction: number, radius: number) => {
    const angle = ((START + fraction * SWEEP) * Math.PI) / 180;
    return [CX + Math.cos(angle) * radius, CY + Math.sin(angle) * radius];
  };

  const arc = (from: number, to: number, radius: number) => {
    const [x0, y0] = point(from, radius);
    const [x1, y1] = point(to, radius);
    const large = (to - from) * SWEEP > 180 ? 1 : 0;
    return `M ${x0} ${y0} A ${radius} ${radius} 0 ${large} 1 ${x1} ${y1}`;
  };

  const [markerX, markerY] = point(severity, R);

  return (
    <figure className="gauge">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={`Severity: ${label}, ${Math.round(severity * 100)} out of 100.`}
      >
        <path
          d={arc(0, 1, R)}
          fill="none"
          stroke="var(--bg-raised-2)"
          strokeWidth={STROKE}
          strokeLinecap="round"
        />
        <path
          d={arc(0, Math.max(0.004, severity), R)}
          fill="none"
          stroke={severity > 0.66 ? 'var(--danger)' : severity > 0.33 ? 'var(--warn)' : 'var(--ok)'}
          strokeWidth={STROKE}
          strokeLinecap="round"
        />

        {TICK_BANDS.map((band) => {
          const [tx, ty] = point(band.at, R + STROKE / 2 + 4);
          const [lx, ly] = point(band.at, R + STROKE / 2 + 16);
          // Anchor away from the arc so labels never sit on top of it.
          const anchor = band.at < 0.4 ? 'end' : band.at > 0.6 ? 'start' : 'middle';
          return (
            <g key={band.label}>
              <circle cx={tx} cy={ty} r={1.6} fill="var(--text-faint)" />
              <text x={lx} y={ly} className="gauge__band" textAnchor={anchor}>
                {band.label}
              </text>
            </g>
          );
        })}

        <circle
          cx={markerX}
          cy={markerY}
          r={7}
          fill="var(--text)"
          stroke="var(--bg)"
          strokeWidth={3}
        />

        <text x={CX} y={CY - 6} className="gauge__value" textAnchor="middle">
          {Math.round(severity * 100)}
        </text>
        <text x={CX} y={CY + 20} className="gauge__label" textAnchor="middle">
          {label}
        </text>
      </svg>
    </figure>
  );
}
