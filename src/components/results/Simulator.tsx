/**
 * The two-way simulator.
 *
 * Two directions, because the report has two very different audiences.
 *
 * "Simulate" answers the question a normal-vision visitor has: what does this
 * look like to them? "Reveal" answers the question the CVD visitor has, which is
 * more interesting and much less often served: *where* is the information I am
 * missing? Daltonisation cannot give back a hue that the eye has no receptor
 * pair to encode, but it can take the lost red-green difference and re-express it
 * as something the observer does have -- lightness and blue-yellow. The result
 * does not look "correct" and is not meant to; it looks like a false-colour image
 * that makes a hidden distinction visible.
 *
 * Both directions honour the *measured* severity by default, with a manual
 * override, because a moderate anomalous trichromat looking at a full dichromat
 * simulation would rightly say it looks nothing like their experience.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SCENES, type Paint } from '../../scenes';
import { simulateImageData, simulateSrgb, type Vision } from '../../color/cvd';
import { daltonizeImageData, daltonizeSrgb } from '../../color/daltonize';
import { hexFromSrgb, srgbFromHex } from '../../color/srgb';
import type { Assessment } from '../../engine/classify';
import { CONE_LABEL } from '../../color/lms';

type Direction = 'simulate' | 'reveal';

interface Props {
  readonly assessment: Assessment;
}

export function Simulator({ assessment }: Props) {
  const measured = assessment.vision;
  const [sceneId, setSceneId] = useState(SCENES[0].id);
  const [direction, setDirection] = useState<Direction>('simulate');
  const [severity, setSeverity] = useState(measured?.severity ?? 1);
  const [split, setSplit] = useState(50);

  const scene = SCENES.find((s) => s.id === sceneId) ?? SCENES[0];

  // With no deficiency measured there is nothing to reveal, so the simulator
  // demonstrates the common deficiency instead -- useful for anyone who designs.
  const axis = measured?.axis ?? 'deutan';
  const vision: Vision = { axis, severity };

  const paint = useMemo<Paint>(() => {
    const cache = new Map<string, string>();
    return (hex: string) => {
      const key = hex;
      const hit = cache.get(key);
      if (hit) return hit;

      const srgb = srgbFromHex(hex);
      const out =
        direction === 'simulate'
          ? hexFromSrgb(simulateSrgb(srgb, vision))
          : hexFromSrgb(daltonizeSrgb(srgb, { axis, severity }));
      cache.set(key, out);
      return out;
    };
  }, [direction, axis, severity, vision]);

  const identity = useCallback<Paint>((hex) => hex, []);

  return (
    <section className="stack">
      <h2>See it both ways</h2>
      <p className="muted">
        {measured
          ? 'Drag the divider. Drawn from your measured result, at your severity.'
          : 'Nothing found for you, so this shows the most common form \u2014 deuteranomaly.'}
      </p>

      <div className="sim-controls">
        <div className="seg" role="group" aria-label="Simulation direction">
          <button
            type="button"
            className={`seg__btn ${direction === 'simulate' ? 'seg__btn--on' : ''}`}
            onClick={() => setDirection('simulate')}
            aria-pressed={direction === 'simulate'}
          >
            Normal &rarr; your vision
          </button>
          <button
            type="button"
            className={`seg__btn ${direction === 'reveal' ? 'seg__btn--on' : ''}`}
            onClick={() => setDirection('reveal')}
            aria-pressed={direction === 'reveal'}
          >
            Reveal what you are missing
          </button>
        </div>

        <label className="sim-field">
          <span className="faint">Scene</span>
          <select value={sceneId} onChange={(e) => setSceneId(e.target.value)}>
            {SCENES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        <label className="sim-field">
          <span className="faint">
            Severity {Math.round(severity * 100)}%
            {measured && Math.abs(severity - measured.severity) < 0.01 ? ' (yours)' : ''}
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.02}
            value={severity}
            onChange={(e) => setSeverity(Number(e.target.value))}
            aria-label="Deficiency severity used for the simulation"
          />
        </label>
      </div>

      <SplitView
        split={split}
        onSplitChange={setSplit}
        leftLabel={direction === 'simulate' ? 'Typical vision' : 'As you see it now'}
        rightLabel={direction === 'simulate' ? 'Your vision' : 'Contrast remapped'}
        left={scene.render(direction === 'simulate' ? identity : paintSimulated(vision))}
        right={scene.render(direction === 'simulate' ? paint : paintRevealed(vision, axis, severity))}
      />

      <p className="faint">{scene.caption}</p>

      {direction === 'reveal' && (
        <div className="callout callout--info">
          <div className="callout__title">What &ldquo;reveal&rdquo; is doing</div>
          <p style={{ marginBottom: 0 }}>
            The {CONE_LABEL[axis]} difference you cannot detect, re-expressed as lightness and
            blue-yellow, which you can. The colours are deliberately wrong &mdash; the point is that
            two things that looked identical no longer do. Same idea as the OS colour filters.
          </p>
        </div>
      )}

      <ImageUpload vision={vision} direction={direction} axis={axis} severity={severity} />
    </section>
  );
}

/** Scene painted as the observer currently sees it. */
function paintSimulated(vision: Vision): Paint {
  const cache = new Map<string, string>();
  return (hex) => {
    const hit = cache.get(hex);
    if (hit) return hit;
    const out = hexFromSrgb(simulateSrgb(srgbFromHex(hex), vision));
    cache.set(hex, out);
    return out;
  };
}

/**
 * Daltonised, then simulated. Showing the daltonised image raw would be
 * misleading: a normal observer sees the recovered contrast easily, so the CVD
 * observer would be looking at a picture of someone else's improvement. Passing
 * it through their own vision shows what *they* would actually gain.
 */
function paintRevealed(vision: Vision, axis: 'protan' | 'deutan' | 'tritan', severity: number): Paint {
  const cache = new Map<string, string>();
  return (hex) => {
    const hit = cache.get(hex);
    if (hit) return hit;
    const corrected = daltonizeSrgb(srgbFromHex(hex), { axis, severity });
    const out = hexFromSrgb(simulateSrgb(corrected, vision));
    cache.set(hex, out);
    return out;
  };
}

interface SplitProps {
  readonly split: number;
  readonly onSplitChange: (value: number) => void;
  readonly left: React.ReactNode;
  readonly right: React.ReactNode;
  readonly leftLabel: string;
  readonly rightLabel: string;
}

/**
 * Side-by-side comparison behind a draggable divider.
 *
 * The divider is a real range input rather than a mouse-driven handle. It looks
 * almost the same and it means the comparison works with a keyboard, with a
 * screen reader, and on a touch screen without any extra code.
 */
function SplitView({
  split,
  onSplitChange,
  left,
  right,
  leftLabel,
  rightLabel,
}: SplitProps) {
  return (
    <div className="split">
      <div className="split__stage">
        <div className="split__layer">{left}</div>
        <div
          className="split__layer split__layer--top"
          style={{ clipPath: `inset(0 0 0 ${split}%)` }}
          aria-hidden="true"
        >
          {right}
        </div>
        <div className="split__seam" style={{ left: `${split}%` }} aria-hidden="true" />

        <span className="split__tag split__tag--left">{leftLabel}</span>
        <span className="split__tag split__tag--right">{rightLabel}</span>
      </div>

      <label className="split__control">
        <span className="visually-hidden">
          Comparison divider: 0 shows only {rightLabel}, 100 shows only {leftLabel}
        </span>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={split}
          onChange={(e) => onSplitChange(Number(e.target.value))}
        />
      </label>

      {/* The clipped layer is hidden from assistive tech, so describe it. */}
      <p className="visually-hidden">
        A comparison of the same scene. Left side: {leftLabel}. Right side: {rightLabel}.
      </p>
    </div>
  );
}

/**
 * Local image upload.
 *
 * Deliberately never leaves the device -- the file is read into a canvas and the
 * pixels are transformed in place. Worth saying plainly on screen, because
 * "upload a photo" reasonably makes people assume a server is involved, and
 * people try this with photographs of their families.
 */
function ImageUpload({
  vision,
  direction,
  axis,
  severity,
}: {
  vision: Vision;
  direction: Direction;
  axis: 'protan' | 'deutan' | 'tritan';
  severity: number;
}) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const originalRef = useRef<HTMLCanvasElement>(null);
  const transformedRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!image) return;
    const original = originalRef.current;
    const transformed = transformedRef.current;
    if (!original || !transformed) return;

    const maxWidth = 460;
    const scale = Math.min(1, maxWidth / image.naturalWidth);
    const w = Math.max(1, Math.round(image.naturalWidth * scale));
    const h = Math.max(1, Math.round(image.naturalHeight * scale));

    for (const canvas of [original, transformed]) {
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.drawImage(image, 0, 0, w, h);
    }

    const ctx = transformed.getContext('2d');
    if (!ctx) return;
    const data = ctx.getImageData(0, 0, w, h);
    if (direction === 'simulate') {
      simulateImageData(data.data, vision);
    } else {
      daltonizeImageData(data.data, { axis, severity });
      simulateImageData(data.data, vision);
    }
    ctx.putImageData(data, 0, 0);
  }, [image, direction, vision, axis, severity]);

  return (
    <details className="card">
      <summary>
        <strong>Try it on one of your own photos</strong>
      </summary>
      <p className="muted">Pick any photo and see it through your own eyes.</p>

      <input
        type="file"
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setError(null);

          const url = URL.createObjectURL(file);
          const img = new Image();
          img.onload = () => {
            setImage(img);
            URL.revokeObjectURL(url);
          };
          img.onerror = () => {
            setError('That file could not be read as an image.');
            URL.revokeObjectURL(url);
          };
          img.src = url;
        }}
      />

      {error && <p className="faint">{error}</p>}

      <div className="grid grid--2" style={{ marginTop: 'var(--space-4)' }}>
        <figure className="chart" style={{ margin: 0 }}>
          <canvas ref={originalRef} style={{ width: '100%', height: 'auto' }} />
          <figcaption className="faint">Original</figcaption>
        </figure>
        <figure className="chart" style={{ margin: 0 }}>
          <canvas ref={transformedRef} style={{ width: '100%', height: 'auto' }} />
          <figcaption className="faint">
            {direction === 'simulate' ? 'Simulated' : 'Contrast remapped, then simulated'}
          </figcaption>
        </figure>
      </div>
    </details>
  );
}
