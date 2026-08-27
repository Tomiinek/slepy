/**
 * The cone panel: three bars, plus the sensitivity-curve graphic.
 *
 * The wording here took more care than the code. It is tempting and wrong to say
 * "your green cones are broken". In anomalous trichromacy -- which is most cases
 * -- the cone is present and working; its photopigment is simply *shifted along
 * the spectrum* toward its neighbour, so the two cones report nearly the same
 * thing and the difference signal between them is small. That is a real,
 * describable mechanism, and people recognise themselves in it. It also explains
 * why the deficiency is partial and stable rather than a defect that might worsen.
 *
 * A discrimination threshold cannot tell a shifted pigment from a missing one, so
 * the bars are labelled as performance on an axis, not as cone health.
 */
import { CONE_LABEL, CVD_AXES, type CvdAxis } from '../../color/lms';
import type { Assessment } from '../../engine/classify';
import { CONE_FUNDAMENTALS } from '../../color/spectralData';
import { spectrumStops } from '../viz/spectrum';

const AXIS_TITLE: Record<CvdAxis, string> = {
  protan: 'L cone \u2014 long wavelengths (red)',
  deutan: 'M cone \u2014 middle wavelengths (green)',
  tritan: 'S cone \u2014 short wavelengths (blue)',
};

/** Approximate peak sensitivity of each normal photopigment, in nm. */
const PEAK_NM: Record<CvdAxis, number> = { protan: 566, deutan: 541, tritan: 441 };

export function ConePanel({ assessment }: { assessment: Assessment }) {
  const affected = assessment.verdict === 'deficiency' ? assessment.axis : null;

  return (
    <section className="stack">
      <h2>Your three cone pathways</h2>
      <p className="muted">
        Discrimination along each cone&rsquo;s confusion direction, as a percentage of typical.
      </p>

      <div className="grid grid--3">
        {CVD_AXES.map((axis) => {
          const metric = assessment.axisMetrics.find((m) => m.axis === axis)!;
          const percent = Math.round(metric.performance * 100);
          const isAffected = axis === affected;

          return (
            <div key={axis} className={`cone-card ${isAffected ? 'cone-card--affected' : ''}`}>
              <div className="cone-card__title">{AXIS_TITLE[axis]}</div>
              <div className="cone-card__value mono">{percent}%</div>
              <div className="cone-bar" aria-hidden="true">
                <div
                  className={`cone-bar__fill ${isAffected ? 'cone-bar__fill--affected' : ''}`}
                  style={{ width: `${Math.max(2, percent)}%` }}
                />
              </div>
              <div className="faint">
                {metric.outcome === 'exceeds-display'
                  ? 'Below what this screen can measure'
                  : metric.outcome === 'below-display'
                    ? 'Better than this screen can measure'
                    : `${metric.elevation.toFixed(1)}\u00d7 the typical threshold`}
              </div>
              <span className="visually-hidden">
                {CONE_LABEL[axis]} discrimination performance {percent} percent of typical.
              </span>
            </div>
          );
        })}
      </div>

      {affected && (
        <>
          <ConeCurves affected={affected} severity={assessment.severity} />
          <div className="callout callout--info">
            <div className="callout__title">
              {assessment.severityLabel === 'complete'
                ? 'What "complete" means here'
                : 'Your cones are not broken \u2014 they overlap'}
            </div>
            {assessment.severityLabel === 'complete' ? (
              <p style={{ marginBottom: 0 }}>
                The {CONE_LABEL[affected]} pigment is absent, or too close to its neighbour to leave
                any usable difference. Colour arrives through two channels instead of three. Fixed
                for life &mdash; not damage, and it will not worsen.
              </p>
            ) : (
              <p style={{ marginBottom: 0 }}>
                Your {CONE_LABEL[affected]} works. Its pigment simply peaks closer to its
                neighbour&rsquo;s, as the chart shows. Colour comes from the <em>difference</em>
                between two cones, so when both report nearly the same thing that difference gets
                small and noisy.
              </p>
            )}
          </div>
        </>
      )}
    </section>
  );
}

/**
 * Normal cone fundamentals with the affected pigment redrawn shifted toward its
 * neighbour. The shift is illustrative of the mechanism, not a measurement:
 * nothing in this test can recover an actual peak wavelength.
 */
function ConeCurves({ affected, severity }: { affected: CvdAxis; severity: number }) {
  const width = 640;
  const height = 212;
  const padding = { left: 44, right: 12, top: 12, bottom: 46 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  const LO = 390;
  const HI = 700;
  const x = (nm: number) => padding.left + ((nm - LO) / (HI - LO)) * plotW;
  const y = (v: number) => padding.top + (1 - v) * plotH;

  const coneColumn: Record<CvdAxis, 1 | 2 | 3> = { protan: 1, deutan: 2, tritan: 3 };
  const strokes: Record<CvdAxis, string> = {
    protan: '#f2777a',
    deutan: '#63c8a0',
    tritan: '#6ea8fe',
  };

  // Where the anomalous pigment moves to. Protan pigments shift down toward the M
  // peak, deutan pigments up toward L; the gap between 541 and 566 nm is why
  // anomalous trichromats retain some, but poor, red-green discrimination.
  const neighbour: Record<CvdAxis, CvdAxis> = {
    protan: 'deutan',
    deutan: 'protan',
    tritan: 'deutan',
  };
  const shiftNm = (PEAK_NM[neighbour[affected]] - PEAK_NM[affected]) * severity * 0.75;

  const path = (axis: CvdAxis, offsetNm = 0) => {
    const column = coneColumn[axis];
    const points = CONE_FUNDAMENTALS.map(([nm, ...values]) => {
      const value = values[column - 1];
      return `${x(nm + offsetNm).toFixed(1)},${y(value).toFixed(1)}`;
    });
    return `M ${points.join(' L ')}`;
  };

  return (
    <figure className="chart">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Cone sensitivity curves. The ${CONE_LABEL[affected]} curve is drawn both in its typical position and shifted ${Math.abs(Math.round(shiftNm))} nanometres toward its neighbour, which narrows the gap between the two curves.`}
        style={{ width: '100%', height: 'auto' }}
      >
        <defs>
          <linearGradient id="cone-spectrum" x1="0" x2="1" y1="0" y2="0">
            {spectrumStops(LO, HI).map((stop) => (
              <stop key={stop.offset} offset={stop.offset} stopColor={stop.color} />
            ))}
          </linearGradient>
        </defs>

        {[400, 450, 500, 550, 600, 650, 700].map((nm) => (
          <g key={nm}>
            <line
              x1={x(nm)}
              x2={x(nm)}
              y1={padding.top}
              y2={padding.top + plotH}
              stroke="var(--border)"
              strokeWidth={1}
            />
            <text x={x(nm)} y={height - 8} textAnchor="middle" className="chart__tick">
              {nm}
            </text>
          </g>
        ))}

        {/* Spectrum strip as the axis: makes "566 nm" self-explanatory. */}
        <rect
          x={padding.left}
          y={padding.top + plotH + 6}
          width={plotW}
          height={9}
          rx={2}
          fill="url(#cone-spectrum)"
        />

        {/* Peak markers tie each curve to a place on the spectrum. */}
        {CVD_AXES.map((axis) => (
          <line
            key={`peak-${axis}`}
            x1={x(PEAK_NM[axis])}
            x2={x(PEAK_NM[axis])}
            y1={padding.top + plotH + 4}
            y2={padding.top + plotH + 17}
            stroke={strokes[axis]}
            strokeWidth={2}
          />
        ))}

        <text
          x={12}
          y={padding.top + plotH / 2}
          className="chart__tick"
          transform={`rotate(-90 12 ${padding.top + plotH / 2})`}
          textAnchor="middle"
        >
          sensitivity
        </text>

        {CVD_AXES.map((axis) => (
          <path
            key={axis}
            d={path(axis)}
            fill="none"
            stroke={strokes[axis]}
            strokeWidth={axis === affected ? 1.2 : 2}
            strokeDasharray={axis === affected ? '3 3' : undefined}
            opacity={axis === affected ? 0.55 : 0.9}
          />
        ))}

        {severity > 0.05 && (
          <path
            d={path(affected, shiftNm)}
            fill="none"
            stroke={strokes[affected]}
            strokeWidth={2.6}
          />
        )}

        <text x={padding.left + 6} y={padding.top + 14} className="chart__tick">
          wavelength (nm) &rarr;
        </text>
      </svg>

      <figcaption className="faint">
        Dashed: typical {CONE_LABEL[affected]} peak. Bold: shifted ~{Math.abs(Math.round(shiftNm))}{' '}
        nm toward its neighbour. Illustrative &mdash; this test cannot measure a peak wavelength.
      </figcaption>
    </figure>
  );
}
