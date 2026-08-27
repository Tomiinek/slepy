/**
 * Prevalence as an isotype (pictogram) chart.
 *
 * "Around 6 in 100 men and 1 in 250 women" is a sentence people read and
 * immediately forget. The same fact as filled figures out of a hundred is
 * understood at a glance and remembered, which is the entire reason isotype
 * charts exist.
 *
 * Counts are rounded to whole figures because that is the only thing a pictogram
 * can honestly show; the exact rate is given in the caption for anyone who wants
 * it.
 */
import type { CvdAxis } from '../../color/lms';

interface Rate {
  readonly perHundredMen: number;
  readonly menLabel: string;
  readonly womenLabel: string;
}

const RATES: Record<CvdAxis, Rate> = {
  protan: { perHundredMen: 1, menLabel: '1 in 100 men', womenLabel: '1 in 2,000 women' },
  deutan: { perHundredMen: 6, menLabel: '6 in 100 men', womenLabel: '1 in 250 women' },
  tritan: { perHundredMen: 1, menLabel: '1 in 10,000 people', womenLabel: 'men and women alike' },
};

export function Pictogram({ axis }: { axis: CvdAxis }) {
  const rate = RATES[axis];
  const total = 100;
  const filled = rate.perHundredMen;

  const cols = 20;
  const cell = 15;
  const width = cols * cell;
  const rows = total / cols;

  return (
    <figure className="picto">
      <svg
        viewBox={`0 0 ${width} ${rows * cell}`}
        role="img"
        aria-label={`Prevalence: ${rate.menLabel}, and ${rate.womenLabel}.`}
      >
        {Array.from({ length: total }, (_, i) => {
          const x = (i % cols) * cell;
          const y = Math.floor(i / cols) * cell;
          const on = i < filled;
          return (
            <g key={i} transform={`translate(${x + cell / 2} ${y + cell / 2})`}>
              {/* A minimal person glyph: head plus shoulders. */}
              <circle
                cx={0}
                cy={-3.4}
                r={2.3}
                fill={on ? 'var(--warn)' : 'var(--border-strong)'}
              />
              <path
                d="M -3.4 5 q 0 -5 3.4 -5 q 3.4 0 3.4 5 z"
                fill={on ? 'var(--warn)' : 'var(--border-strong)'}
              />
            </g>
          );
        })}
      </svg>
      <figcaption className="faint">
        <strong>{rate.menLabel}</strong> &middot; {rate.womenLabel}
      </figcaption>
    </figure>
  );
}
