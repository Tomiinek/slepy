/**
 * Procedural scenes for the simulator.
 *
 * Each scene takes a `paint` function and passes every colour through it, so the
 * same drawing code serves the original, the simulation and the daltonised
 * version. Drawing in SVG rather than raster keeps it sharp at any size and means
 * a scene is a list of shapes with colours attached -- exactly the shape the
 * transform wants.
 *
 * The scenes were chosen because each one is a situation people actually report,
 * not because they look striking. A red-green line chart is the single most
 * common complaint from people who work with data; unripe fruit and cooked meat
 * come up constantly; resistor bands and status LEDs are the ones that cost
 * money. Where a scene has a "right answer" it is stated in the caption, so a
 * visitor who cannot see it is told rather than left guessing.
 */
import type { ReactNode } from 'react';

export type Paint = (hex: string) => string;

export interface Scene {
  readonly id: string;
  readonly name: string;
  /** What to look for, and why this scene is here. */
  readonly caption: string;
  render(paint: Paint): ReactNode;
}

const VIEW = '0 0 400 260';

function svg(children: ReactNode) {
  return (
    <svg viewBox={VIEW} width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      {children}
    </svg>
  );
}

const trafficLight: Scene = {
  id: 'traffic',
  name: 'Traffic light',
  caption:
    'On green. Position, not hue, is what carries this in real life.',
  render: (p) =>
    svg(
      <>
        <rect x={0} y={0} width={400} height={260} fill={p('#2b3138')} />
        <rect x={158} y={20} width={84} height={220} rx={12} fill={p('#15181c')} />
        {[
          { cy: 60, color: '#3a1f22' },
          { cy: 130, color: '#3a331f' },
          { cy: 200, color: '#2bd45f' },
        ].map((lamp, i) => (
          <circle key={i} cx={200} cy={lamp.cy} r={26} fill={p(lamp.color)} />
        ))}
        <circle cx={200} cy={200} r={34} fill={p('#2bd45f')} opacity={0.25} />
        <rect x={192} y={240} width={16} height={20} fill={p('#15181c')} />
      </>,
    ),
};

const fruit: Scene = {
  id: 'fruit',
  name: 'Ripening fruit',
  caption:
    'Unripe to ripe. Ripeness rides almost entirely on the red-green axis.',
  render: (p) =>
    svg(
      <>
        <rect x={0} y={0} width={400} height={260} fill={p('#6f6256')} />
        {['#5f8f3a', '#8d9b34', '#b89330', '#c96c25', '#c22e1d'].map((color, i) => (
          <g key={i}>
            <circle cx={56 + i * 72} cy={150} r={34} fill={p(color)} />
            <path
              d={`M ${56 + i * 72} 116 l -10 -12 l 10 4 l 10 -4 z`}
              fill={p('#3f6b2a')}
            />
          </g>
        ))}
      </>,
    ),
};

const lineChart: Scene = {
  id: 'chart',
  name: 'Red/green line chart',
  caption:
    'Two series separated by colour alone. Fix: direct labels.',
  render: (p) => {
    const seriesA = [0.42, 0.5, 0.46, 0.62, 0.7, 0.66, 0.82];
    const seriesB = [0.7, 0.62, 0.66, 0.5, 0.44, 0.5, 0.38];
    const toPath = (values: number[]) =>
      values
        .map(
          (v, i) =>
            `${i === 0 ? 'M' : 'L'} ${40 + (i * 330) / (values.length - 1)} ${
              210 - v * 160
            }`,
        )
        .join(' ');

    return svg(
      <>
        <rect x={0} y={0} width={400} height={260} fill={p('#f4f1ea')} />
        {[0, 1, 2, 3].map((i) => (
          <line
            key={i}
            x1={40}
            x2={370}
            y1={210 - i * 53}
            y2={210 - i * 53}
            stroke={p('#d6d2c8')}
            strokeWidth={1}
          />
        ))}
        <path d={toPath(seriesA)} fill="none" stroke={p('#d1332e')} strokeWidth={3.5} />
        <path d={toPath(seriesB)} fill="none" stroke={p('#2f9e44')} strokeWidth={3.5} />
        <rect x={266} y={26} width={104} height={44} fill={p('#ffffff')} rx={4} />
        <circle cx={280} cy={40} r={5} fill={p('#d1332e')} />
        <circle cx={280} cy={58} r={5} fill={p('#2f9e44')} />
        <rect x={292} y={36} width={62} height={8} fill={p('#c9c5bc')} />
        <rect x={292} y={54} width={48} height={8} fill={p('#c9c5bc')} />
      </>,
    );
  },
};

const statusLeds: Scene = {
  id: 'leds',
  name: 'Status lights',
  caption:
    'Two healthy, one warning, one fault \u2014 by hue alone.',
  render: (p) =>
    svg(
      <>
        <rect x={0} y={0} width={400} height={260} fill={p('#1a1d21')} />
        {[
          { color: '#28c76f', label: 'ok' },
          { color: '#28c76f', label: 'ok' },
          { color: '#f0a020', label: 'warn' },
          { color: '#e5352b', label: 'fault' },
        ].map((led, i) => (
          <g key={i}>
            <rect
              x={30 + i * 92}
              y={70}
              width={72}
              height={120}
              rx={8}
              fill={p('#2a2f35')}
            />
            <circle cx={66 + i * 92} cy={118} r={16} fill={p(led.color)} />
            <circle cx={66 + i * 92} cy={118} r={26} fill={p(led.color)} opacity={0.22} />
            <rect x={46 + i * 92} y={156} width={40} height={6} rx={3} fill={p('#3c434b')} />
          </g>
        ))}
      </>,
    ),
};

const resistors: Scene = {
  id: 'resistors',
  name: 'Resistor colour bands',
  caption:
    'Brown, red and orange collapse together. One band off is 10\u00d7 wrong.',
  render: (p) =>
    svg(
      <>
        <rect x={0} y={0} width={400} height={260} fill={p('#e8e4da')} />
        {[
          ['#7a4a1e', '#111111', '#d1332e', '#c9a227'],
          ['#2f9e44', '#7a4a1e', '#e07b1a', '#c9a227'],
          ['#d1332e', '#d1332e', '#7a4a1e', '#9aa0a6'],
        ].map((bands, row) => (
          <g key={row}>
            <line
              x1={30}
              x2={370}
              y1={70 + row * 62}
              y2={70 + row * 62}
              stroke={p('#b9b3a6')}
              strokeWidth={4}
            />
            <rect
              x={120}
              y={48 + row * 62}
              width={160}
              height={44}
              rx={20}
              fill={p('#ddcfa8')}
            />
            {bands.map((band, i) => (
              <rect
                key={i}
                x={136 + i * 32}
                y={48 + row * 62}
                width={14}
                height={44}
                fill={p(band)}
              />
            ))}
          </g>
        ))}
      </>,
    ),
};

const whiteboard: Scene = {
  id: 'whiteboard',
  name: 'Red pen on a board',
  caption:
    'Red ink has little luminance contrast \u2014 it can fade to nothing.',
  render: (p) =>
    svg(
      <>
        <rect x={0} y={0} width={400} height={260} fill={p('#2d5c3f')} />
        <rect x={16} y={16} width={368} height={228} fill={p('#2a6b45')} />
        {[0, 1, 2].map((row) => (
          <rect
            key={row}
            x={40}
            y={60 + row * 40}
            width={row === 1 ? 220 : 290}
            height={9}
            rx={4}
            fill={p('#f2f0e8')}
          />
        ))}
        <rect x={40} y={180} width={180} height={9} rx={4} fill={p('#e02c22')} />
        <rect x={236} y={180} width={100} height={9} rx={4} fill={p('#e02c22')} />
        <path
          d="M 300 60 l 40 40 M 340 60 l -40 40"
          stroke={p('#e02c22')}
          strokeWidth={7}
          fill="none"
        />
      </>,
    ),
};

const terrain: Scene = {
  id: 'terrain',
  name: 'Terrain map',
  caption:
    'Elevation on a green-brown-red ramp. Height collapses; only lightness survives.',
  render: (p) => {
    const bands = [
      '#2e6f3e',
      '#4f8c3a',
      '#7ba03a',
      '#a8a13c',
      '#c08b3e',
      '#b2653a',
      '#a04434',
      '#8d2f2b',
    ];
    return svg(
      <>
        <rect x={0} y={0} width={400} height={260} fill={p('#9fc3d9')} />
        {bands.map((band, i) => {
          const inset = i * 14;
          return (
            <ellipse
              key={i}
              cx={200}
              cy={140}
              rx={190 - inset * 1.1}
              ry={118 - inset * 0.72}
              fill={p(band)}
            />
          );
        })}
        <path
          d="M 30 210 q 90 -30 170 -10 q 80 20 170 -20"
          stroke={p('#3b6ea8')}
          strokeWidth={5}
          fill="none"
        />
      </>,
    );
  },
};

const colormaps: Scene = {
  id: 'colormaps',
  name: 'Jet versus viridis',
  caption:
    'Jet (top) breaks. Viridis (bottom) rises in lightness, so it survives.',
  render: (p) => {
    // Sampled from the published colormaps, coarsely.
    const jet = [
      '#00007f', '#0000ff', '#007fff', '#00ffff', '#7fff7f',
      '#ffff00', '#ff7f00', '#ff0000', '#7f0000',
    ];
    const viridis = [
      '#440154', '#472d7b', '#3b528b', '#2c728e', '#21918c',
      '#28ae80', '#5ec962', '#addc30', '#fde725',
    ];

    const ramp = (colors: string[], y: number) =>
      colors.map((color, i) => (
        <rect
          key={i}
          x={30 + (i * 340) / colors.length}
          y={y}
          width={340 / colors.length + 0.6}
          height={64}
          fill={p(color)}
        />
      ));

    return svg(
      <>
        <rect x={0} y={0} width={400} height={260} fill={p('#f4f1ea')} />
        {ramp(jet, 40)}
        {ramp(viridis, 150)}
        <rect x={30} y={112} width={340} height={2} fill={p('#d6d2c8')} />
      </>,
    );
  },
};

export const SCENES: readonly Scene[] = [
  trafficLight,
  lineChart,
  fruit,
  statusLeds,
  resistors,
  whiteboard,
  terrain,
  colormaps,
];
