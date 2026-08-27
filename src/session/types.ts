import type { Assessment } from '../engine/classify';
import type { ArrangementResult } from '../engine/arrangement';
import type { LuminanceMatchResult } from '../engine/luminanceMatch';
import type { PlateResponse } from '../engine/scoring/plates';
import type { AxisThresholds } from '../engine/thresholdBlock';

export type Phase =
  | 'intro'
  | 'displayCheck'
  | 'plates'
  | 'thresholdsIntro'
  | 'thresholds'
  | 'luminanceIntro'
  | 'luminance'
  | 'arrangementIntro'
  | 'arrangement'
  | 'results';

/** Ordered for the progress indicator; the intro screens carry no weight. */
export const STAGE_ORDER: readonly Phase[] = [
  'plates',
  'thresholds',
  'luminance',
  'arrangement',
];

export const STAGE_LABEL: Record<string, string> = {
  plates: 'Hidden figures',
  thresholds: 'Colour sensitivity',
  luminance: 'Brightness match',
  arrangement: 'Colour ordering',
};

/**
 * Rough share of total time each stage takes, used to make one continuous
 * progress bar rather than four that each restart from zero.
 */
export const STAGE_WEIGHT: Record<string, number> = {
  plates: 0.3,
  thresholds: 0.42,
  luminance: 0.1,
  arrangement: 0.18,
};

/** Everything a completed session produces. Serialisable for export and sharing. */
export interface SessionResults {
  readonly seed: number;
  readonly completedAt: string;
  readonly thresholds: AxisThresholds;
  readonly plates: readonly PlateResponse[];
  readonly luminance: LuminanceMatchResult;
  readonly arrangement: ArrangementResult;
  readonly assessment: Assessment;
  readonly durationMs: number;
}
