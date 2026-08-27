/**
 * The intro screen.
 *
 * Kept short on purpose. The stages are shown as thumbnails rather than
 * described, and the setup advice is reduced to the items that actually change a
 * result -- screen tinting above all, since Night Shift alone can shift a
 * borderline result across the boundary.
 */
import { STAGE_THUMBS } from '../viz/StageThumbs';

interface Props {
  readonly onStart: () => void;
}

const STAGES = [
  { art: STAGE_THUMBS.plate, name: 'Hidden numbers', note: 'Read digits in dot fields' },
  { art: STAGE_THUMBS.landolt, name: 'Sensitivity', note: 'Where does the gap point?' },
  { art: STAGE_THUMBS.brightness, name: 'Brightness', note: 'Match red to grey' },
  { art: STAGE_THUMBS.arrange, name: 'Ordering', note: 'Sort colours into a run' },
];

const SETUP = [
  { icon: '\u25d1', text: 'Night Shift / f.lux off' },
  { icon: '\u2600', text: 'Brightness up, no glare' },
  { icon: '\u25a3', text: 'Zoom at 100%' },
  { icon: '\u25c9', text: 'Usual glasses, no tints' },
];

export function IntroScreen({ onStart }: Props) {
  return (
    <div className="shell stack">
      <header>
        <p className="faint mono">Colour vision assessment</p>
        <h1>How do you actually see colour?</h1>
        <p className="lede">
          Four short stages measure how finely you separate colours along each cone axis. Then a
          detailed report: which colours you confuse, why, and what others see instead.
        </p>
      </header>

      <div className="grid grid--3">
        <Fact value="~6 min" label="Four stages" />
        <Fact value="3 axes" label="Red, green, blue pathways" />
        <Fact value="4 tests" label="Plates, rings, patches, caps" />
      </div>

      <div className="thumb-grid">
        {STAGES.map((stage) => (
          <figure key={stage.name} className="thumb">
            {stage.art}
            <figcaption>
              <strong>{stage.name}</strong>
              <span className="faint">{stage.note}</span>
            </figcaption>
          </figure>
        ))}
      </div>

      <div className="setup-row">
        {SETUP.map((item) => (
          <span key={item.text} className="chip chip--setup">
            <span className="chip__glyph" aria-hidden="true">
              {item.icon}
            </span>
            {item.text}
          </span>
        ))}
      </div>

      <div className="row">
        <button type="button" className="btn btn--primary btn--lg" onClick={onStart}>
          Check my display and begin
        </button>
      </div>
    </div>
  );
}

function Fact({ value, label }: { value: string; label: string }) {
  return (
    <div className="card card--inset">
      <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{value}</div>
      <div className="faint">{label}</div>
    </div>
  );
}
