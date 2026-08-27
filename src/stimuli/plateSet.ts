/**
 * The plate sequence for a session.
 *
 * Amplitudes descend so each axis is probed at several difficulties: a mild
 * anomalous trichromat reads the loud plates and loses the faint ones, which is
 * what turns a pass/fail screen into a graded measurement. Order is shuffled
 * within the body of the test so the difficulty ramp is not obvious and cannot
 * be gamed by guessing "it gets harder, so I'll say nothing later on".
 */
import type { CvdAxis } from '../color/lms';
import type { PlateMode } from './plate';
import { makeRng } from '../util/rng';

export interface PlatePlan {
  readonly id: string;
  readonly mode: PlateMode;
  readonly axis: CvdAxis;
  readonly answer: string;
  readonly amplitudeFraction: number;
  readonly seed: number;
}

/**
 * Digits that stay legible when rendered as a dot mosaic. 1 and 7 are dropped
 * because their thin diagonal strokes break up, and 8/9 and 3/5 are never used
 * as the sole difference within a session's answer set.
 */
const SINGLE_DIGITS = ['2', '4', '5', '6', '8', '9'] as const;
const TENS = ['2', '4', '5', '6', '8'] as const;

function makeAnswers(count: number, seed: number): string[] {
  const rng = makeRng(seed);
  const used = new Set<string>();
  const out: string[] = [];
  while (out.length < count) {
    const twoDigit = out.length % 3 !== 0;
    const answer = twoDigit
      ? `${rng.pick(TENS)}${rng.pick(SINGLE_DIGITS)}`
      : rng.pick(SINGLE_DIGITS);
    if (used.has(answer)) continue;
    used.add(answer);
    out.push(answer);
  }
  return out;
}

/** Amplitude ladder, as a fraction of the gamut-limited maximum. */
const RED_GREEN_LADDER = [0.9, 0.62, 0.42, 0.28, 0.18] as const;
/**
 * The tritan ladder starts lower and stops higher. Blue-yellow discrimination is
 * intrinsically coarser than red-green even in normal observers, and blue
 * primaries are where consumer displays deviate most, so we neither expect nor
 * demand the same precision here.
 */
const TRITAN_LADDER = [0.9, 0.6, 0.4] as const;

export function buildPlateSet(sessionSeed: number): PlatePlan[] {
  const rng = makeRng(sessionSeed ^ 0x5eed);

  const body: Omit<PlatePlan, 'answer' | 'seed' | 'id'>[] = [];

  for (const axis of ['protan', 'deutan'] as const) {
    for (const amplitudeFraction of RED_GREEN_LADDER) {
      body.push({ mode: 'standard', axis, amplitudeFraction });
    }
  }
  for (const amplitudeFraction of TRITAN_LADDER) {
    body.push({ mode: 'standard', axis: 'tritan', amplitudeFraction });
  }
  body.push({ mode: 'hiddenDigit', axis: 'deutan', amplitudeFraction: 0 });
  body.push({ mode: 'hiddenDigit', axis: 'protan', amplitudeFraction: 0 });

  const shuffled = rng.shuffle(body);

  // A control plate opens the stage (so a broken display or a misunderstood task
  // is caught before any real data is collected) and another closes it (to catch
  // attention drifting away mid-stage).
  const plan: Omit<PlatePlan, 'answer' | 'seed' | 'id'>[] = [
    { mode: 'control', axis: 'deutan', amplitudeFraction: 0.9 },
    ...shuffled,
    { mode: 'control', axis: 'protan', amplitudeFraction: 0.9 },
  ];

  const answers = makeAnswers(plan.length, sessionSeed ^ 0xa11);

  return plan.map((p, i) => ({
    ...p,
    id: `plate-${i}`,
    answer: answers[i],
    seed: (sessionSeed + i * 7919) >>> 0,
  }));
}

export const PLATE_COUNT = buildPlateSet(1).length;
