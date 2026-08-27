/**
 * Display sanity check.
 *
 * Two objective checks, because the most common reason an online colour test
 * gives a nonsense answer is the screen rather than the eye.
 *
 * The grey step wedge catches crushed blacks, a badly wrong gamma curve, or a
 * brightness setting so low that the dark end of the range has collapsed. If
 * someone cannot count the steps, their display cannot render the luminance
 * noise the plates depend on.
 *
 * The dithered-versus-solid patch checks gamma directly. A 50% checkerboard of
 * black and white averages to 0.5 in *linear* light, which on a correctly
 * configured sRGB display matches a solid patch of value 188, not 128. If the
 * two look equal the pipeline is behaving; if the solid patch looks obviously
 * lighter or darker, something is applying an extra curve.
 */
import { useEffect, useRef, useState } from 'react';
import { useViewportWidth } from '../../util/useMedia';
import { encodedFromLinearChannel } from '../../color/srgb';

interface Props {
  readonly onContinue: () => void;
  readonly onBack: () => void;
}

const MIN_USEFUL_WIDTH = 560;

export function DisplayCheckScreen({ onContinue, onBack }: Props) {
  const width = useViewportWidth();
  const [confirmed, setConfirmed] = useState(false);
  const [filtersOff, setFiltersOff] = useState(false);

  const tooNarrow = width < MIN_USEFUL_WIDTH;

  return (
    <div className="shell stack">
      <h1>Display check</h1>
      <p className="lede">
        The screen is the most common reason a colour test gets it wrong.
      </p>

      {tooNarrow && (
        <div className="callout callout--warn">
          <div className="callout__title">Your window is quite narrow</div>
          <p>
            At {width}px the stimuli will be smaller than intended, which makes thresholds look
            worse than they are. Use a larger window if you can.
          </p>
        </div>
      )}

      <section className="card stack">
        <h2>1. Grey steps</h2>
        <p className="muted">
          All sixteen steps should look distinct, including the darkest on the left. If the dark end
          is one block, turn your brightness up.
        </p>
        <StepWedge />
      </section>

      <section className="card stack">
        <h2>2. Gamma</h2>
        <p className="muted">
          Squint. The checkerboard and the patch inside it should look about the{' '}
          <strong>same</strong> brightness. If the centre stands out strongly, your display is
          applying an extra curve.
        </p>
        <GammaPatch />
      </section>

      <section className="card stack">
        <h2>3. Confirm</h2>
        <label className="row" style={{ alignItems: 'flex-start', gap: 'var(--space-3)' }}>
          <input
            type="checkbox"
            checked={filtersOff}
            onChange={(e) => setFiltersOff(e.target.checked)}
            style={{ marginTop: 6 }}
          />
          <span>
            Night Shift, True Tone, f.lux, blue-light filters and any display colour profile
            adjustments are switched <strong>off</strong>.
          </span>
        </label>
        <label className="row" style={{ alignItems: 'flex-start', gap: 'var(--space-3)' }}>
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            style={{ marginTop: 6 }}
          />
          <span>
            I can see all sixteen grey steps, and my brightness is turned up.
          </span>
        </label>
      </section>

      <div className="row">
        <button type="button" className="btn btn--ghost" onClick={onBack}>
          Back
        </button>
        <button
          type="button"
          className="btn btn--primary btn--lg"
          disabled={!confirmed || !filtersOff}
          onClick={onContinue}
        >
          Start the test
        </button>
      </div>
      {(!confirmed || !filtersOff) && (
        <p className="faint">
          Both boxes are required: a filtered display looks exactly like a colour deficiency.
        </p>
      )}
    </div>
  );
}

function StepWedge() {
  const steps = 16;
  return (
    <div style={{ display: 'flex', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
      {Array.from({ length: steps }, (_, i) => {
        // Even steps in linear light, which is where the dark end is hardest and
        // therefore most diagnostic.
        const linear = i / (steps - 1);
        const encoded = encodedFromLinearChannel(linear * 0.9 + 0.005);
        const value = Math.round(encoded * 255);
        return (
          <div
            key={i}
            style={{
              flex: 1,
              height: 56,
              background: `rgb(${value},${value},${value})`,
            }}
            aria-hidden="true"
          />
        );
      })}
      <span className="visually-hidden">
        A wedge of sixteen grey steps from black to white.
      </span>
    </div>
  );
}

function GammaPatch() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    // A 1px black/white checkerboard averages to 0.5 in linear light.
    const image = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const on = (x + y) % 2 === 0;
        const v = on ? 255 : 0;
        const i = (x + y * w) * 4;
        image.data[i] = v;
        image.data[i + 1] = v;
        image.data[i + 2] = v;
        image.data[i + 3] = 255;
      }
    }
    ctx.putImageData(image, 0, 0);

    // The solid patch that should match it: 0.5 in linear light, encoded.
    const match = Math.round(encodedFromLinearChannel(0.5) * 255);
    ctx.fillStyle = `rgb(${match},${match},${match})`;
    ctx.fillRect(w / 2 - 40, h / 2 - 26, 80, 52);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={320}
      height={140}
      style={{ width: 320, height: 140, borderRadius: 'var(--radius)', imageRendering: 'pixelated' }}
      role="img"
      aria-label="A fine checkerboard pattern with a solid grey rectangle in the centre."
    />
  );
}
