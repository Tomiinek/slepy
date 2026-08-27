/**
 * Miniature previews of the four stages, for the intro screen.
 *
 * A person deciding whether to spend six minutes on a test wants to know what
 * they will be asked to do. Four sentences describing dot fields and gapped
 * rings take longer to read than the pictures take to understand, and the
 * pictures also set the expectation that the stimuli are subtle.
 *
 * These are hand-drawn approximations rather than calls into the real stimulus
 * generators: the generators are sized and seeded for measurement, and shrinking
 * their output to thumbnail size would misrepresent it.
 */
const VIEW = '0 0 120 120';

function frame(children: React.ReactNode) {
  return (
    <svg viewBox={VIEW} className="thumb__svg" aria-hidden="true">
      {children}
    </svg>
  );
}

/** Deterministic pseudo-random so the thumbnails never re-shuffle on render. */
function hashed(i: number, salt: number): number {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Strokes of a bold "5", as rectangles in the 120-unit box.
 *
 * A thin numeral disappears at thumbnail size once it is broken into dots, so
 * the strokes are deliberately fat: the point of the picture is that a digit is
 * hiding in there, which fails completely if it cannot be read.
 */
const FIVE: readonly (readonly [number, number, number, number])[] = [
  [40, 28, 80, 42],
  [40, 42, 54, 58],
  [40, 56, 78, 70],
  [64, 70, 78, 86],
  [40, 84, 78, 98],
];

function inFive(x: number, y: number): boolean {
  return FIVE.some(([x0, y0, x1, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1);
}

const plate = frame(
  <>
    <circle cx={60} cy={60} r={56} fill="#2a2a28" />
    {(() => {
      // A jittered triangular lattice: even coverage, so the numeral survives.
      const spacing = 8.2;
      const rowStep = spacing * 0.866;
      const dots: React.ReactNode[] = [];
      let i = 0;

      for (let row = 0; row * rowStep < 120; row++) {
        const y0 = row * rowStep + 3;
        const offset = row % 2 === 0 ? 0 : spacing / 2;
        for (let col = 0; col * spacing + offset < 120; col++) {
          const x0 = col * spacing + offset + 3;
          const cx = x0 + (hashed(i, 1) - 0.5) * 2.4;
          const cy = y0 + (hashed(i, 2) - 0.5) * 2.4;
          i++;

          const dx = cx - 60;
          const dy = cy - 60;
          if (dx * dx + dy * dy > 53 * 53) continue;

          const shade = 0.82 + hashed(i, 3) * 0.36;
          const base = inFive(cx, cy) ? [186, 142, 72] : [118, 150, 100];
          const fill = `rgb(${base.map((c) => Math.round(c * shade)).join(',')})`;
          dots.push(
            <circle key={i} cx={cx} cy={cy} r={2.7 + hashed(i, 4) * 1.3} fill={fill} />,
          );
        }
      }

      return dots;
    })()}
  </>,
);

const landolt = frame(
  <>
    <circle cx={60} cy={60} r={56} fill="#2a2a28" />
    {/* Gapped ring, drawn as dots, in a colour close to the background. */}
    {Array.from({ length: 44 }, (_, i) => {
      const angle = (i / 44) * Math.PI * 2;
      const deg = (angle * 180) / Math.PI;
      if (deg > 55 && deg < 125) return null;
      return (
        <circle
          key={i}
          cx={60 + Math.cos(angle) * 34}
          cy={60 + Math.sin(angle) * 34}
          r={4}
          fill="#8f9a72"
        />
      );
    })}
  </>,
);

const brightness = frame(
  <>
    <rect x={8} y={26} width={104} height={68} rx={6} fill="#141414" />
    <rect x={18} y={36} width={42} height={48} fill="#515151" />
    <rect x={60} y={36} width={42} height={48} fill="#8c1f14" />
    <rect x={18} y={98} width={84} height={5} rx={2.5} fill="#3a3a3a" />
    <circle cx={72} cy={100.5} r={7} fill="#e6e6e6" />
  </>,
);

const CAPS = ['#3f7fb5', '#3f95a8', '#43a58a', '#6faa5f', '#a8a44f', '#c08b4a', '#bd6a5c'];

const arrange = frame(
  <>
    <circle cx={60} cy={16} r={9} fill="#2f5fa0" stroke="#e6e6e6" strokeWidth={2} />
    {CAPS.map((fill, i) => (
      <circle key={i} cx={18 + (i % 4) * 28} cy={50 + Math.floor(i / 4) * 30} r={11} fill={fill} />
    ))}
  </>,
);

export const STAGE_THUMBS = { plate, landolt, brightness, arrange } as const;
