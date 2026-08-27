/**
 * Export: JSON, a PNG card, and a shareable link.
 *
 * The PNG is drawn to a canvas by hand rather than screenshotting the DOM. That
 * avoids pulling in a rasteriser, and more importantly it lets the card be
 * designed for its actual purpose -- something readable when pasted into a chat
 * or shown to an optometrist -- instead of a cropped web page. It deliberately
 * carries the disclaimer, because a results image will travel far from this page
 * and needs to stay honest on its own.
 */
import { useCallback, useRef, useState } from 'react';
import type { SessionResults } from '../../session/types';
import { shareUrl } from '../../session/share';
import { CONE_LABEL, CVD_AXES } from '../../color/lms';

export function ExportPanel({ results }: { results: SessionResults }) {
  const [copied, setCopied] = useState(false);
  const cardRef = useRef<HTMLCanvasElement>(null);

  const downloadJson = useCallback(() => {
    const payload = {
      generatedBy: 'Colour vision test',
      completedAt: results.completedAt,
      seed: results.seed,
      durationMs: results.durationMs,
      assessment: {
        verdict: results.assessment.verdict,
        name: results.assessment.name,
        axis: results.assessment.axis,
        severity: results.assessment.severity,
        severityLabel: results.assessment.severityLabel,
        confidence: results.assessment.confidence,
        confidenceScore: results.assessment.confidenceScore,
        caveats: results.assessment.caveats,
        evidence: results.assessment.evidence,
      },
      axisMetrics: results.assessment.axisMetrics,
      luminanceMatch: {
        scale: results.luminance.scale,
        settings: results.luminance.settings,
        protanIndex: results.luminance.protanIndex,
      },
      arrangement: {
        totalErrorScore: results.arrangement.totalErrorScore,
        confusionAngle: results.arrangement.confusionAngle,
        matchedAxis: results.arrangement.matchedAxis,
        order: results.arrangement.order,
      },
      plates: results.plates.map((r) => ({
        id: r.plan.id,
        mode: r.plan.mode,
        axis: r.plan.axis,
        amplitudeFraction: r.plan.amplitudeFraction,
        correct: r.correct,
        elapsedMs: r.elapsedMs,
      })),
    };

    download(
      new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }),
      `colour-vision-${results.completedAt.slice(0, 10)}.json`,
    );
  }, [results]);

  const downloadPng = useCallback(() => {
    const canvas = cardRef.current ?? document.createElement('canvas');
    drawCard(canvas, results);
    canvas.toBlob((blob) => {
      if (blob) download(blob, `colour-vision-${results.completedAt.slice(0, 10)}.png`);
    }, 'image/png');
  }, [results]);

  const copyLink = useCallback(async () => {
    const url = shareUrl(results);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard access can be refused; showing the URL is a fine fallback.
      window.prompt('Copy this link', url);
    }
  }, [results]);

  return (
    <section className="stack">
      <h2>Save or share it</h2>
      <p className="muted">
        Keep a copy, or send the link to someone &mdash; it carries your measurements in the address
        itself.
      </p>

      <div className="row">
        <button type="button" className="btn" onClick={downloadPng}>
          Download image
        </button>
        <button type="button" className="btn" onClick={downloadJson}>
          Download data (JSON)
        </button>
        <button type="button" className="btn" onClick={copyLink}>
          {copied ? 'Link copied' : 'Copy shareable link'}
        </button>
      </div>
      <p className="faint" aria-live="polite">
        {copied ? 'Link copied to your clipboard.' : '\u00a0'}
      </p>

      <canvas ref={cardRef} width={CARD_W} height={CARD_H} style={{ display: 'none' }} />
    </section>
  );
}

const CARD_W = 1000;
const CARD_H = 560;

/** Draws the shareable results card. */
function drawCard(canvas: HTMLCanvasElement, results: SessionResults) {
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const { assessment } = results;
  const font = (size: number, weight = 400) =>
    `${weight} ${size}px ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;

  ctx.fillStyle = '#0b0d10';
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  ctx.fillStyle = '#6d7987';
  ctx.font = font(19);
  ctx.fillText('Colour vision assessment', 56, 68);

  ctx.fillStyle = '#e8ecf1';
  ctx.font = font(46, 700);
  wrapText(ctx, assessment.headline, 56, 128, CARD_W - 112, 54);

  ctx.fillStyle = '#a6b0bd';
  ctx.font = font(20);
  const summaryEnd = wrapText(
    ctx,
    assessment.plainSummary,
    56,
    212,
    CARD_W - 112,
    30,
    3,
  );

  // Per-axis bars: the actual measurement, and the part worth showing an optician.
  let y = Math.max(300, summaryEnd + 28);
  ctx.font = font(17);
  for (const axis of CVD_AXES) {
    const metric = assessment.axisMetrics.find((m) => m.axis === axis)!;
    const affected = assessment.axis === axis && assessment.verdict === 'deficiency';

    ctx.fillStyle = '#a6b0bd';
    ctx.fillText(CONE_LABEL[axis], 56, y + 14);

    const barX = 220;
    const barW = 520;
    ctx.fillStyle = '#1c2126';
    roundRect(ctx, barX, y, barW, 16, 8);
    ctx.fill();

    const fraction = Math.max(0.015, Math.min(1, metric.performance));
    ctx.fillStyle = affected ? '#f0b849' : '#63c8a0';
    roundRect(ctx, barX, y, barW * fraction, 16, 8);
    ctx.fill();

    ctx.fillStyle = '#e8ecf1';
    ctx.font = font(17, 600);
    const label =
      metric.outcome === 'exceeds-display'
        ? 'below measurable'
        : `${Math.round(metric.performance * 100)}%`;
    ctx.fillText(label, barX + barW + 16, y + 14);
    ctx.font = font(17);

    y += 40;
  }

  ctx.fillStyle = '#6d7987';
  ctx.font = font(16);
  ctx.fillText(
    `${assessment.confidence} confidence \u00b7 ${new Date(results.completedAt).toLocaleDateString()}`,
    56,
    y + 22,
  );

  ctx.font = font(15);
  wrapText(ctx, 'Measured on an uncalibrated display, so treat it as a good estimate.', 56, CARD_H - 54, CARD_W - 112, 22);
}

/** Wraps text, returning the y of the last drawn line. */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines = 6,
): number {
  const words = text.split(' ');
  let line = '';
  let lineY = y;
  let lines = 0;

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && line) {
      ctx.fillText(line, x, lineY);
      lines++;
      if (lines >= maxLines) return lineY;
      lineY += lineHeight;
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) ctx.fillText(line, x, lineY);
  return lineY;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
