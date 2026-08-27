/**
 * Draws a generated plate (or Landolt C) to a canvas.
 *
 * The luminance noise is animated, cycling slowly through phases. Static noise
 * lets an observer study one dot against its neighbour indefinitely and slowly
 * extract a cue that should not be available; drifting it means any residual
 * brightness signal is uncorrelated with the figure over time. Recolouring 1400
 * dots per frame is wasteful, so it runs at a few frames per second, which is
 * ample for decorrelation and cheap enough to stay smooth.
 *
 * Anyone who has asked for reduced motion gets a single static frame instead.
 * The trade-off is real but the alternative -- a field of shimmering dots -- is
 * genuinely unpleasant for people with vestibular sensitivity, and the plate
 * still works because the figure is carried by chromaticity, not by the noise.
 */
import { useEffect, useRef } from 'react';
import { PLATE_GAP, plateDotColor, type PlateSpec } from '../stimuli/plate';
import { hexFromSrgb } from '../color/srgb';
import { usePrefersReducedMotion } from '../util/useMedia';

interface Props {
  readonly spec: PlateSpec;
  readonly size: number;
  readonly label: string;
  /** Frames per second for the noise animation. */
  readonly noiseHz?: number;
}

export function PlateCanvas({ spec, size, label, noiseHz = 4 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = size * dpr;
    canvas.height = size * dpr;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    const scale = size / spec.diameter;
    const backgroundHex = hexFromSrgb(PLATE_GAP);

    const draw = (phase: number) => {
      ctx.fillStyle = backgroundHex;
      ctx.fillRect(0, 0, size, size);

      for (const dot of spec.dots) {
        ctx.fillStyle = hexFromSrgb(plateDotColor(spec, dot, phase));
        ctx.beginPath();
        ctx.arc(dot.x * scale, dot.y * scale, dot.r * scale, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    if (reducedMotion) {
      draw(0);
      return;
    }

    let frame = 0;
    let timer: number | undefined;
    const tick = () => {
      draw((frame++ * Math.PI * 2) / 7);
      timer = window.setTimeout(tick, 1000 / noiseHz);
    };
    tick();

    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [spec, size, noiseHz, reducedMotion]);

  return (
    <canvas
      ref={canvasRef}
      className="stimulus-canvas"
      style={{ width: size, height: size }}
      role="img"
      aria-label={label}
    />
  );
}
