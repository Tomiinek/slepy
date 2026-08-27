/**
 * Stage 2b: make the red patch as bright as the grey one.
 *
 * The instruction has to insist on brightness rather than colour, because the
 * two patches will never look the same colour and people naturally try to match
 * what they cannot. Repeats alternate between starting far too dim and far too
 * bright: this task has strong hysteresis, since people stop adjusting as soon as
 * the mismatch stops being obvious, which drags the setting toward wherever they
 * began.
 */
import { useEffect, useState } from 'react';
import {
  MAX_SCALE,
  MIN_SCALE,
  redAtScale,
  REFERENCE_Y,
} from '../../engine/luminanceMatch';
import { hexFromLinear } from '../../color/srgb';

interface Props {
  readonly repeat: number;
  readonly total: number;
  readonly start: number;
  readonly onSubmit: (scale: number) => void;
}

export function LuminanceStage({ repeat, total, start, onSubmit }: Props) {
  // Slider position is logarithmic: the perceptually meaningful quantity is the
  // ratio, so a linear slider would waste most of its travel at the bright end.
  const toPosition = (scale: number) =>
    (Math.log(scale) - Math.log(MIN_SCALE)) / (Math.log(MAX_SCALE) - Math.log(MIN_SCALE));
  const fromPosition = (position: number) =>
    Math.exp(
      Math.log(MIN_SCALE) + position * (Math.log(MAX_SCALE) - Math.log(MIN_SCALE)),
    );

  const [position, setPosition] = useState(() => toPosition(start));

  useEffect(() => setPosition(toPosition(start)), [start]);

  const scale = fromPosition(position);
  const redHex = hexFromLinear(redAtScale(scale));
  const greyHex = hexFromLinear([REFERENCE_Y, REFERENCE_Y, REFERENCE_Y]);

  return (
    <div className="adaptation-field">
      <p className="stimulus-help" aria-live="polite">
        Match {repeat + 1} of {total}. Make the red square as <strong>bright</strong> as the grey
        one. Ignore the fact that they are different colours &mdash; only brightness matters.
      </p>

      {/*
        The two fields share an edge, with no gap and no border between them.
        Brightness differences are far easier to judge across a single boundary
        than between separated patches, which is why every instrument that does
        this uses a bipartite field.

        The dark bezel is not decoration. Both patches are darker than the
        adaptation grey, and judging a dark patch against a lighter surround
        compresses the apparent difference through simultaneous contrast. The
        bezel gives the judgement a local dark surround while the page keeps the
        observer adapted to the neutral grey.
      */}
      <div className="bipartite">
        <div
          className="bipartite__half"
          style={{ background: greyHex }}
          role="img"
          aria-label="Fixed grey reference field, on the left"
        />
        <div
          className="bipartite__half"
          style={{ background: redHex }}
          role="img"
          aria-label="Adjustable red field, on the right"
        />
      </div>
      <div className="bipartite__legend" aria-hidden="true">
        <span>fixed grey</span>
        <span>adjustable red</span>
      </div>

      <div style={{ width: 'min(420px, 90vw)' }}>
        <label htmlFor="lum-slider" className="visually-hidden">
          Red brightness
        </label>
        <input
          id="lum-slider"
          type="range"
          min={0}
          max={1}
          step={0.002}
          value={position}
          onChange={(e) => setPosition(Number(e.target.value))}
          style={{ width: '100%' }}
          aria-valuetext={`${scale.toFixed(2)} times the reference brightness`}
        />
        <div
          className="row row--between faint"
          style={{ color: '#3a3a3a', fontSize: '0.85rem' }}
        >
          <span>Darker</span>
          <span>Brighter</span>
        </div>
      </div>

      <div className="field-controls">
        <button
          type="button"
          className="field-btn field-btn--wide"
          onClick={() => onSubmit(scale)}
        >
          They match
        </button>
      </div>

      <p className="stimulus-help">
        Use the slider or the <kbd>&larr;</kbd> <kbd>&rarr;</kbd> keys once it has focus. Try
        overshooting in both directions and settling in the middle &mdash; it is easier to find the
        point where the red flips from clearly darker to clearly brighter than to spot a match
        directly.
      </p>
    </div>
  );
}
