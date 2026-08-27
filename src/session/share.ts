/**
 * URL-hash encoding of a result, so a report can be linked or bookmarked without
 * a server storing anything.
 *
 * Only the measured quantities go in, never the raw trial history: the link has
 * to fit comfortably in a URL, and a threshold per axis plus the four summary
 * numbers is enough to reproduce every part of the report. The classifier is then
 * re-run on decode rather than the verdict being carried in the link, which means
 * a shared link always reflects the current classifier rather than freezing
 * whatever it said on the day.
 *
 * Encoding is base64url over compact JSON with short keys. A version tag comes
 * first so a future format change can be detected instead of mis-parsed -- an
 * older link hitting a newer decoder should fail cleanly and say so.
 */
import { CVD_AXES, type CvdAxis } from '../color/lms';
import type { AxisThresholds } from '../engine/thresholdBlock';
import type { StaircaseResult } from '../engine/staircase';
import { classify } from '../engine/classify';
import { interpretLuminanceMatch } from '../engine/luminanceMatch';
import { scoreArrangement } from '../engine/arrangement';
import { summarisePlates, type PlateSummary } from '../engine/scoring/plates';
import { buildPlateSet } from '../stimuli/plateSet';
import type { SessionResults } from './types';

const VERSION = 1;

interface Payload {
  /** Format version. */
  readonly v: number;
  /** Session seed, so the exact stimuli can be regenerated. */
  readonly s: number;
  /** Per-axis [threshold, outcome code, reversal count]. */
  readonly t: Record<string, [number, number, number]>;
  /** Luminance match settings. */
  readonly l: readonly number[];
  /** Final cap order. */
  readonly c: readonly number[];
  /** Plate answers, as correct/incorrect flags against the generated set. */
  readonly p: string;
  /** Completion timestamp, seconds since epoch. */
  readonly d: number;
  /**
   * Optional first name, so a shared page can say who it is about. Additive and
   * optional, so links made before it existed still decode.
   */
  readonly n?: string;
}

/** Keeps a pasted name from bloating the URL or injecting layout-breaking text. */
const NAME_LIMIT = 24;

export function sanitiseName(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, NAME_LIMIT);
}

/**
 * Outcomes travel as an index, which keeps links short. Append only -- inserting
 * or reordering would silently change the meaning of every existing link, so a
 * change here needs a VERSION bump.
 */
const OUTCOME_CODES: readonly StaircaseResult['outcome'][] = [
  'measured',
  'exceeds-display',
  'below-display',
  'inconclusive',
];

export function encodeResults(results: SessionResults, name?: string): string {
  const thresholds: Record<string, [number, number, number]> = {};
  for (const axis of CVD_AXES) {
    const r = results.thresholds[axis];
    thresholds[axis[0]] = [
      Math.round(r.threshold * 1e6) / 1e6,
      Math.max(0, OUTCOME_CODES.indexOf(r.outcome)),
      r.reversals.length,
    ];
  }

  const clean = name ? sanitiseName(name) : '';

  const payload: Payload = {
    v: VERSION,
    s: results.seed,
    t: thresholds,
    l: results.luminance.settings.map((s) => Math.round(s * 1000) / 1000),
    c: results.arrangement.order,
    p: results.plates.map((r) => (r.correct ? '1' : '0')).join(''),
    d: Math.floor(new Date(results.completedAt).getTime() / 1000),
    ...(clean ? { n: clean } : {}),
  };

  return base64UrlEncode(JSON.stringify(payload));
}

export interface DecodedResults {
  readonly results: SessionResults;
  /** Whoever the results belong to, if they chose to say. */
  readonly name: string | null;
}

/**
 * Rebuilds a report from a shared link. Returns null for anything unparseable,
 * which the caller shows as a plain message -- a corrupted link should not look
 * like a real result.
 */
export function decodeShared(hash: string): DecodedResults | null {
  const results = decodeResults(hash);
  if (!results) return null;

  let name: string | null = null;
  try {
    const payload = JSON.parse(base64UrlDecode(hash.replace(/^#?r=/, ''))) as Payload;
    name = payload.n ? sanitiseName(payload.n) : null;
  } catch {
    name = null;
  }

  return { results, name: name || null };
}

export function decodeResults(hash: string): SessionResults | null {
  try {
    const json = base64UrlDecode(hash.replace(/^#?r=/, ''));
    const payload = JSON.parse(json) as Payload;
    if (payload.v !== VERSION) return null;

    const thresholds = {} as AxisThresholds;
    for (const axis of CVD_AXES) {
      const entry = payload.t[axis[0]];
      if (!entry) return null;
      thresholds[axis as CvdAxis] = {
        threshold: entry[0],
        outcome: OUTCOME_CODES[entry[1]] ?? 'inconclusive',
        // Individual reversal amplitudes are not carried; downstream only the
        // count matters, as a reliability signal. Filling them with the
        // threshold keeps the precision figure honest at 1.0 rather than
        // inventing a spread.
        reversals: new Array<number>(entry[2]).fill(entry[0]),
        trials: [],
        precision: 1,
      } satisfies StaircaseResult;
    }

    const luminance = interpretLuminanceMatch(payload.l);
    const arrangement = scoreArrangement(payload.c);
    const plates = decodePlates(payload.p, payload.s);

    return {
      seed: payload.s,
      completedAt: new Date(payload.d * 1000).toISOString(),
      thresholds,
      plates: plates.responses,
      luminance,
      arrangement,
      assessment: classify({ thresholds, plates, luminance, arrangement }),
      durationMs: 0,
    };
  } catch {
    return null;
  }
}

/**
 * Regenerates the plate plan from the seed and replays the correct/incorrect
 * flags against it, which is why the link only needs one bit per plate.
 */
function decodePlates(flags: string, seed: number): PlateSummary {
  const plan = buildPlateSet(seed);

  return summarisePlates(
    plan.slice(0, flags.length).map((p, i) => ({
      plan: p,
      response: flags[i] === '1' ? p.answer : null,
      correct: flags[i] === '1',
      elapsedMs: 0,
    })),
  );
}

function base64UrlEncode(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(text: string): string {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

/** The full shareable URL for a result. */
export function shareUrl(results: SessionResults, name?: string): string {
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}#r=${encodeResults(results, name)}`;
}
