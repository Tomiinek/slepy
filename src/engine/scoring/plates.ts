/**
 * Summarising the plate stage.
 *
 * Plates are a coarser instrument than the staircases, but they contribute two
 * things the staircases cannot. The control plates verify the display and that
 * the observer understood the task at all -- without them, "saw nothing" and
 * "screen is broken" are indistinguishable. And the amplitude at which someone
 * stops reading the figure gives an independent severity estimate that does not
 * depend on the staircase converging.
 */
import type { CvdAxis } from '../../color/lms';
import type { PlatePlan } from '../../stimuli/plateSet';

export interface PlateResponse {
  readonly plan: PlatePlan;
  /** What the observer entered, or null for "nothing / not sure". */
  readonly response: string | null;
  readonly correct: boolean;
  readonly elapsedMs: number;
}

export interface PlateAxisSummary {
  readonly correct: number;
  readonly total: number;
  /**
   * Smallest amplitude fraction the observer still read correctly, or null if
   * they read none. This is the plate stage's severity estimate.
   */
  readonly faintestSeen: number | null;
  /** Largest amplitude fraction they failed, or null if they failed none. */
  readonly loudestMissed: number | null;
}

export interface PlateSummary {
  readonly controlsPassed: number;
  readonly controlsTotal: number;
  /** True when every control plate was read correctly. */
  readonly valid: boolean;
  readonly byAxis: Record<CvdAxis, PlateAxisSummary>;
  readonly redGreen: PlateAxisSummary;
  readonly hiddenDigitCorrect: number;
  readonly hiddenDigitTotal: number;
  readonly responses: readonly PlateResponse[];
  readonly medianResponseMs: number;
}

const EMPTY: PlateAxisSummary = {
  correct: 0,
  total: 0,
  faintestSeen: null,
  loudestMissed: null,
};

export function summarisePlates(responses: readonly PlateResponse[]): PlateSummary {
  const controls = responses.filter((r) => r.plan.mode === 'control');
  const hidden = responses.filter((r) => r.plan.mode === 'hiddenDigit');
  const standard = responses.filter((r) => r.plan.mode === 'standard');

  const byAxis = {
    protan: summariseGroup(standard.filter((r) => r.plan.axis === 'protan')),
    deutan: summariseGroup(standard.filter((r) => r.plan.axis === 'deutan')),
    tritan: summariseGroup(standard.filter((r) => r.plan.axis === 'tritan')),
  } satisfies Record<CvdAxis, PlateAxisSummary>;

  const times = responses.map((r) => r.elapsedMs).sort((a, b) => a - b);

  return {
    controlsPassed: controls.filter((r) => r.correct).length,
    controlsTotal: controls.length,
    valid: controls.length > 0 && controls.every((r) => r.correct),
    byAxis,
    redGreen: summariseGroup(
      standard.filter((r) => r.plan.axis === 'protan' || r.plan.axis === 'deutan'),
    ),
    hiddenDigitCorrect: hidden.filter((r) => r.correct).length,
    hiddenDigitTotal: hidden.length,
    responses,
    medianResponseMs: times.length ? times[Math.floor(times.length / 2)] : 0,
  };
}

function summariseGroup(group: readonly PlateResponse[]): PlateAxisSummary {
  if (group.length === 0) return EMPTY;

  const seen = group.filter((r) => r.correct).map((r) => r.plan.amplitudeFraction);
  const missed = group.filter((r) => !r.correct).map((r) => r.plan.amplitudeFraction);

  return {
    correct: seen.length,
    total: group.length,
    faintestSeen: seen.length ? Math.min(...seen) : null,
    loudestMissed: missed.length ? Math.max(...missed) : null,
  };
}

/** Fraction correct, or null when the group was empty. */
export function accuracy(summary: PlateAxisSummary): number | null {
  return summary.total === 0 ? null : summary.correct / summary.total;
}
