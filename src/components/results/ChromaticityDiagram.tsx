/**
 * The CIE 1976 u'v' chromaticity diagram, with the observer's own confusion lines
 * and measured threshold contour drawn on it.
 *
 * u'v' rather than the more familiar xy horseshoe: xy is badly non-uniform, and
 * the whole point of the overlay is that distance should mean something. In u'v'
 * a threshold ellipse of a given size means roughly the same discriminability
 * wherever it sits, so the contour can be read directly.
 *
 * Confusion lines converge on the copunctal point -- the chromaticity where the
 * missing cone's contribution vanishes. Colours along one line differ only in the
 * signal the observer lacks, so they are all the same colour to them. Seeing the
 * lines fan across the region where their confused colours live is what makes the
 * earlier sections feel mechanical rather than arbitrary.
 */
import { useMemo } from 'react';
import { SPECTRAL_LOCUS_UV } from '../../color/spectralData';
import { CONE_LABEL, type CvdAxis } from '../../color/lms';
import {
  confusionLineUv,
  copunctalUv,
  NEUTRAL_UV,
  uvToDisplayHex,
} from '../../color/confusion';
import type { Assessment } from '../../engine/classify';

const VIEW = { minU: -0.02, maxU: 0.65, minV: -0.02, maxV: 0.62 };
const SIZE = 460;

const STROKE: Record<CvdAxis, string> = {
  protan: '#f2777a',
  deutan: '#63c8a0',
  tritan: '#6ea8fe',
};

export function ChromaticityDiagram({ assessment }: { assessment: Assessment }) {
  const axis = assessment.verdict === 'deficiency' ? assessment.axis : null;

  const x = (u: number) => ((u - VIEW.minU) / (VIEW.maxU - VIEW.minU)) * SIZE;
  const y = (v: number) => (1 - (v - VIEW.minV) / (VIEW.maxV - VIEW.minV)) * SIZE;

  const locusPath = useMemo(() => {
    const points = SPECTRAL_LOCUS_UV.map(
      ([, u, v]) => `${x(u).toFixed(1)},${y(v).toFixed(1)}`,
    );
    return `M ${points.join(' L ')} Z`;
  }, []);

  const lines = useMemo(() => {
    if (!axis) return [];
    // A fan of lines through the copunctal point, spanning the visible region.
    return [0.15, 0.28, 0.4, 0.52, 0.64].map((t) => confusionLineUv(axis, t));
  }, [axis]);

  const threshold = axis
    ? assessment.axisMetrics.find((m) => m.axis === axis)!.threshold
    : null;

  return (
    <section className="stack">
      <h2>Where this lives on the colour map</h2>
      <p className="muted">
        Every colour a human can see, with the pure spectrum along the curved edge. Distances are
        roughly perceptually even, so the overlay can be read literally.
      </p>

      <figure className="chart chart--diagram">
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          role="img"
          aria-label={
            axis
              ? `Chromaticity diagram showing your ${CONE_LABEL[axis]} confusion lines fanning out from the copunctal point. Colours along each line are indistinguishable to you.`
              : 'Chromaticity diagram of the range of human colour vision, with no confusion lines because no deficiency was found.'
          }
          style={{ width: '100%', height: 'auto', maxWidth: SIZE }}
        >
          <defs>
            <clipPath id="locus-clip">
              <path d={locusPath} />
            </clipPath>
          </defs>

          <ChromaticityFill x={x} y={y} />

          <path d={locusPath} fill="none" stroke="var(--text-dim)" strokeWidth={1.5} />

          {[460, 480, 500, 520, 540, 560, 580, 600, 620].map((nm) => {
            const entry = SPECTRAL_LOCUS_UV.find(([w]) => w === nm);
            if (!entry) return null;
            const [, u, v] = entry;
            return (
              <g key={nm}>
                <circle cx={x(u)} cy={y(v)} r={2} fill="var(--text-dim)" />
                <text
                  x={x(u) + (u > 0.25 ? 7 : -7)}
                  y={y(v) + (v > 0.45 ? -5 : 11)}
                  className="chart__tick"
                  textAnchor={u > 0.25 ? 'start' : 'end'}
                >
                  {nm}
                </text>
              </g>
            );
          })}

          {axis &&
            lines.map((line, i) => (
              <line
                key={i}
                x1={x(line.from[0])}
                y1={y(line.from[1])}
                x2={x(line.to[0])}
                y2={y(line.to[1])}
                stroke={STROKE[axis]}
                strokeWidth={1.4}
                opacity={0.85}
                clipPath="url(#locus-clip)"
              />
            ))}

          {axis && <CopunctalMarker axis={axis} x={x} y={y} />}

          {threshold !== null && (
            <ThresholdContour axis={axis!} threshold={threshold} x={x} y={y} />
          )}

          <circle cx={x(NEUTRAL_UV[0])} cy={y(NEUTRAL_UV[1])} r={4} fill="#fff" />
          <text x={x(NEUTRAL_UV[0]) + 8} y={y(NEUTRAL_UV[1]) + 4} className="chart__tick">
            white
          </text>
        </svg>

        <figcaption className="faint">
          {axis ? (
            <>
              <span style={{ color: STROKE[axis] }}>Coloured lines</span>: colours on the same line
              look identical to you, however far apart they sit here. The ellipse around white is
              your measured threshold &mdash; smaller differences are invisible to you.
            </>
          ) : (
            <>
              No deficiency, so no confusion lines. A typical threshold ellipse would be too small
              to see at this scale.
            </>
          )}
        </figcaption>
      </figure>
    </section>
  );
}

/**
 * A coarse raster of the diagram interior. Every point inside the horseshoe is a
 * real chromaticity but most are outside sRGB, so they are desaturated toward
 * white until they fit -- shown honestly as approximate rather than pretending a
 * screen can display the spectral edge.
 */
function ChromaticityFill({
  x,
  y,
}: {
  x: (u: number) => number;
  y: (v: number) => number;
}) {
  const cells = useMemo(() => {
    const out: { u: number; v: number; hex: string }[] = [];
    const step = 0.0075;
    for (let u = VIEW.minU; u < VIEW.maxU; u += step) {
      for (let v = VIEW.minV; v < VIEW.maxV; v += step) {
        const hex = chromaticityHex(u + step / 2, v + step / 2);
        if (hex) out.push({ u, v, hex });
      }
    }
    return out;
  }, []);

  const w = Math.abs(x(0.0075) - x(0)) + 0.6;

  return (
    <g clipPath="url(#locus-clip)" opacity={0.72}>
      {cells.map((cell, i) => (
        <rect
          key={i}
          x={x(cell.u)}
          y={y(cell.v) - w}
          width={w}
          height={w}
          fill={cell.hex}
          shapeRendering="crispEdges"
        />
      ))}
    </g>
  );
}

function CopunctalMarker({
  axis,
  x,
  y,
}: {
  axis: CvdAxis;
  x: (u: number) => number;
  y: (v: number) => number;
}) {
  const point = copunctalUv(axis);
  const px = x(point[0]);
  const py = y(point[1]);
  const inside = px > 4 && px < SIZE - 4 && py > 4 && py < SIZE - 4;
  if (!inside) return null;

  return (
    <g>
      <circle cx={px} cy={py} r={5} fill="none" stroke={STROKE[axis]} strokeWidth={2} />
      <circle cx={px} cy={py} r={1.5} fill={STROKE[axis]} />
    </g>
  );
}

/**
 * The measured threshold, drawn as an ellipse elongated along the confusion
 * direction. That elongation is the geometric statement of the whole result: the
 * observer needs a much larger step along one direction than any other.
 */
function ThresholdContour({
  axis,
  threshold,
  x,
  y,
}: {
  axis: CvdAxis;
  threshold: number;
  x: (u: number) => number;
  y: (v: number) => number;
}) {
  const line = confusionLineUv(axis, 0.5);
  const du = line.to[0] - line.from[0];
  const dv = line.to[1] - line.from[1];
  const angle = (Math.atan2(-dv, du) * 180) / Math.PI;

  // The minor radius is a normal-observer threshold; the major radius is what was
  // actually measured along the confusion direction.
  const minor = 0.004;
  const scaleX = Math.abs(x(threshold) - x(0));
  const scaleMinor = Math.abs(x(minor) - x(0));

  return (
    <g transform={`translate(${x(NEUTRAL_UV[0])} ${y(NEUTRAL_UV[1])}) rotate(${angle})`}>
      <ellipse
        cx={0}
        cy={0}
        rx={Math.max(3, scaleX)}
        ry={Math.max(2, scaleMinor)}
        fill="rgb(255 255 255 / 0.28)"
        stroke="#fff"
        strokeWidth={1.4}
      />
    </g>
  );
}

/** sRGB hex for a chromaticity at fixed luminance, or null if outside the locus. */
function chromaticityHex(u: number, v: number): string | null {
  if (v <= 0.0001) return null;
  return uvToDisplayHex(u, v);
}
