/**
 * Turning four independent measurements into one statement about someone's
 * colour vision, plus an honest account of how much to trust it.
 *
 * The evidence, and what each piece is actually good for:
 *
 *   Thresholds   Sensitive and quantitative. Tells us *whether* and *how much*.
 *                Ratios between axes distinguish red-green from blue-yellow
 *                robustly, but protan from deutan only weakly.
 *   Luminance    Almost the only clean protan/deutan discriminator available on
 *                an uncalibrated display. One number, high information.
 *   Arrangement  Independent confirmation of the axis, via error direction. Also
 *                a severity cue. Vulnerable to careless dragging.
 *   Plates       Validity check (controls) and a coarse severity cross-check.
 *
 * Where these disagree, the report says so rather than picking a winner
 * silently. A confident wrong answer is far worse here than an uncertain right
 * one: people make real decisions about careers and about their children's
 * eyesight off the back of results like this.
 */
import { CONE_LABEL, CVD_AXES, type CvdAxis } from '../color/lms';
import { deficiencyName, type Deficiency, type Vision } from '../color/cvd';
import { UV_UNIT_SCALE } from '../color/xyz';
import type { AxisThresholds } from './thresholdBlock';
import type { ArrangementResult } from './arrangement';
import { axisAngleDistance, axisAngles } from './arrangement';
import type { LuminanceMatchResult } from './luminanceMatch';
import { accuracy, type PlateSummary } from './scoring/plates';
import {
  AFFECTED_ELEVATION,
  NORMATIVE,
  elevation,
  relativePerformance,
  severityFromElevation,
  severityLabelFor,
  type SeverityLabel,
} from './normative';

/** Labels used verbatim in the report, kept next to the logic that sets them. */
type SeverityOutcome = SeverityLabel;

export type Verdict =
  /** No deficiency found. */
  | 'normal'
  /** A deficiency was identified. */
  | 'deficiency'
  /** Something is off, but the pattern does not fit a single cone type. */
  | 'inconclusive'
  /** Control checks failed; the data cannot be interpreted. */
  | 'invalid';

export type EvidenceWeight = 'strong' | 'moderate' | 'weak';

export interface Evidence {
  readonly label: string;
  readonly detail: string;
  readonly weight: EvidenceWeight;
  /** Whether this piece supports or argues against the conclusion. */
  readonly supports: boolean;
}

export interface AxisMetric {
  readonly axis: CvdAxis;
  readonly threshold: number;
  /** Threshold in the literature's x10^-4 u'v' units. */
  readonly thresholdUnits: number;
  readonly normalMedianUnits: number;
  readonly normalUpperUnits: number;
  readonly elevation: number;
  readonly performance: number;
  readonly outcome: AxisThresholds[CvdAxis]['outcome'];
  readonly clipped: boolean;
}

export interface Assessment {
  readonly verdict: Verdict;
  readonly axis: CvdAxis | null;
  readonly severity: number;
  readonly severityLabel: SeverityLabel;
  /** e.g. "moderate deuteranomaly". Empty for a normal result. */
  readonly name: string;
  readonly headline: string;
  readonly plainSummary: string;
  readonly confidence: 'low' | 'moderate' | 'high';
  readonly confidenceScore: number;
  readonly evidence: readonly Evidence[];
  readonly caveats: readonly string[];
  /** Feeds every simulation in the report. */
  readonly vision: Vision;
  readonly axisMetrics: readonly AxisMetric[];
  readonly conePerformance: Record<CvdAxis, number>;
  readonly redGreenElevation: number;
  readonly tritanElevation: number;
  readonly protanDeutanBalance: number;
}

export interface ClassifierInput {
  readonly thresholds: AxisThresholds;
  readonly plates: PlateSummary;
  readonly luminance: LuminanceMatchResult;
  readonly arrangement: ArrangementResult;
}

export function classify(input: ClassifierInput): Assessment {
  const { thresholds, plates, luminance, arrangement } = input;

  const axisMetrics = CVD_AXES.map<AxisMetric>((axis) => {
    const result = thresholds[axis];
    return {
      axis,
      threshold: result.threshold,
      thresholdUnits: result.threshold * UV_UNIT_SCALE,
      normalMedianUnits: NORMATIVE[axis].median * UV_UNIT_SCALE,
      normalUpperUnits: NORMATIVE[axis].upper * UV_UNIT_SCALE,
      elevation: elevation(result.threshold, axis),
      performance: relativePerformance(result.threshold, axis),
      outcome: result.outcome,
      clipped: result.outcome === 'exceeds-display' || result.outcome === 'below-display',
    };
  });

  const metric = (axis: CvdAxis) => axisMetrics.find((m) => m.axis === axis)!;
  const conePerformance = Object.fromEntries(
    axisMetrics.map((m) => [m.axis, m.performance]),
  ) as Record<CvdAxis, number>;

  // Red-green evidence pools the two nearly-parallel axes, because either
  // deficiency elevates both and the pooled value is the more stable statistic.
  const redGreenElevation = Math.sqrt(
    metric('protan').elevation * metric('deutan').elevation,
  );
  const tritanElevation = metric('tritan').elevation;

  // Positive means the protan axis is the more elevated of the two.
  const protanDeutanBalance = Math.log(
    metric('protan').threshold / metric('deutan').threshold,
  );

  const evidence: Evidence[] = [];
  const caveats: string[] = [];

  if (!plates.valid) {
    return invalidResult(plates, axisMetrics, conePerformance, redGreenElevation, tritanElevation, protanDeutanBalance);
  }

  const redGreenAffected = redGreenElevation >= AFFECTED_ELEVATION;
  const tritanAffected = tritanElevation >= AFFECTED_ELEVATION;

  // ---- Which axis? -------------------------------------------------------

  let axis: CvdAxis | null = null;
  let verdict: Verdict = 'normal';

  if (!redGreenAffected && !tritanAffected) {
    verdict = 'normal';
  } else if (redGreenAffected && !tritanAffected) {
    verdict = 'deficiency';
    axis = decideRedGreenType(protanDeutanBalance, luminance, evidence);
  } else if (tritanAffected && !redGreenAffected) {
    verdict = 'deficiency';
    axis = 'tritan';
    evidence.push({
      label: 'Blue-yellow threshold raised on its own',
      detail: `Your tritan-axis threshold is ${fmt(tritanElevation)}x the typical value while your red-green axes are normal.`,
      weight: 'moderate',
      supports: true,
    });
  } else {
    // Every axis elevated. Usually a display, focus or attention problem rather
    // than three simultaneous inherited deficiencies, which would be vanishingly
    // rare. But it can also be a genuine acquired deficiency, so we say both.
    const ratio = redGreenElevation / tritanElevation;
    if (ratio > 2.2) {
      verdict = 'deficiency';
      axis = decideRedGreenType(protanDeutanBalance, luminance, evidence);
      caveats.push(
        'Your blue-yellow threshold was raised too, which is common on an uncalibrated screen and usually means little.',
      );
    } else if (ratio < 0.45) {
      verdict = 'deficiency';
      axis = 'tritan';
    } else {
      verdict = 'inconclusive';
      caveats.push(
        'All three axes came out raised by about the same amount. Colour blindness hits one cone type, not all three, so the likely culprits are the screen, the lighting, or tiredness.',
      );
    }
  }

  // ---- How severe? -------------------------------------------------------
  //
  // Detection pooled the two red-green axes because that is the more stable
  // statistic, but severity should reflect the worst-affected direction: a
  // deuteranope is not half as affected just because the neighbouring protan
  // axis is still partly usable.
  const severityAxes: CvdAxis[] = axis === 'tritan' ? ['tritan'] : ['protan', 'deutan'];
  const severityMetrics = severityAxes.map(metric);
  const drivingElevation = axis
    ? Math.max(...severityMetrics.map((m) => m.elevation))
    : Math.max(redGreenElevation, tritanElevation);

  // A staircase that failed at the largest colour the display can produce tells
  // us the threshold lies somewhere beyond the measurable range. Treating that
  // censored value as if it were the real threshold would systematically report
  // dichromats as moderately affected, so we take it for what it is: evidence of
  // a complete deficiency on that axis.
  const censored = severityMetrics.some((m) => m.outcome === 'exceeds-display');

  const severity = !axis ? 0 : censored ? 1 : severityFromElevation(drivingElevation);
  const severityLabel: SeverityOutcome = !axis
    ? 'none'
    : censored
      ? 'complete'
      : severityLabelFor(drivingElevation);

  const vision: Vision = axis && verdict === 'deficiency' ? { axis, severity } : null;

  // ---- Corroboration -----------------------------------------------------

  addThresholdEvidence(evidence, axis, redGreenElevation, tritanElevation, verdict);
  addArrangementEvidence(evidence, arrangement, axis, verdict);
  addPlateEvidence(evidence, plates, axis, verdict);

  for (const m of axisMetrics) {
    if (m.outcome === 'exceeds-display') {
      caveats.push(
        `On the ${axisWord(m.axis)} axis you did not detect even the strongest colour this screen can produce, so your true threshold is somewhere beyond ${Math.round(m.thresholdUnits)} and we can only report a lower bound.`,
      );
    }
    if (m.outcome === 'below-display') {
      caveats.push(
        `On the ${axisWord(m.axis)} axis you were still correct at the smallest colour step the screen can render, so your discrimination there is better than this display can measure.`,
      );
    }
    if (m.outcome === 'inconclusive') {
      caveats.push(
        `The ${axisWord(m.axis)} axis did not settle within its trial budget, so treat that number as rough.`,
      );
    }
  }

  if (luminance.consistency > 2.5) {
    caveats.push(
      'Your brightness-matching settings varied a lot between repeats, so that part of the evidence carries less weight than usual.',
    );
  }

  const { confidence, confidenceScore } = assessConfidence({
    verdict,
    axis,
    evidence,
    arrangement,
    luminance,
    plates,
    axisMetrics,
    redGreenElevation,
    tritanElevation,
  });

  return {
    verdict,
    axis,
    severity,
    severityLabel,
    name: vision ? `${severityLabel} ${deficiencyName(vision as Deficiency)}` : '',
    headline: buildHeadline(verdict, vision as Deficiency | null, severityLabel),
    plainSummary: buildSummary(verdict, vision as Deficiency | null, severityLabel, conePerformance),
    confidence,
    confidenceScore,
    evidence,
    caveats,
    vision,
    axisMetrics,
    conePerformance,
    redGreenElevation,
    tritanElevation,
    protanDeutanBalance,
  };
}

/**
 * Protan or deutan? The luminance probe leads, because the threshold ratio is
 * only weakly informative: the two confusion axes are separated by about 17
 * degrees, so both deficiencies elevate both axes and the asymmetry is small
 * next to the trial-to-trial noise.
 */
function decideRedGreenType(
  balance: number,
  luminance: LuminanceMatchResult,
  evidence: Evidence[],
): CvdAxis {
  const luminanceSaysProtan = luminance.protanIndex > 0.45;
  const luminanceIsUsable = luminance.consistency < 2.5;
  const thresholdSaysProtan = balance > 0;
  const thresholdIsDecisive = Math.abs(balance) > 0.22;

  if (luminanceIsUsable) {
    evidence.push({
      label: luminanceSaysProtan
        ? 'Red appears dark to you'
        : 'Red appears normally bright to you',
      detail: luminanceSaysProtan
        ? `You had to make the red patch ${fmt(luminance.scale)}x the brightness of the grey one to match it. Needing red that much brighter points to the L cone, the long-wavelength one, which is the protan pattern.`
        : `Your red-to-grey brightness match came out close to typical, which argues for the M cone (deutan) rather than the L cone: protans need red noticeably brighter than this.`,
      weight: 'strong',
      supports: true,
    });
  } else {
    evidence.push({
      label: 'Brightness match was inconsistent',
      detail:
        'Your repeats of the red-brightness task disagreed with each other, so it could not settle whether the L or M cone is the affected one.',
      weight: 'weak',
      supports: false,
    });
  }

  if (thresholdIsDecisive) {
    evidence.push({
      label: `Thresholds lean ${thresholdSaysProtan ? 'protan' : 'deutan'}`,
      detail: `Your ${thresholdSaysProtan ? 'protan' : 'deutan'}-axis threshold is the higher of the two red-green axes, which is the expected pattern for a ${thresholdSaysProtan ? 'protan' : 'deutan'} deficiency.`,
      weight: 'weak',
      supports: true,
    });
  }

  if (luminanceIsUsable) return luminanceSaysProtan ? 'protan' : 'deutan';
  if (thresholdIsDecisive) return thresholdSaysProtan ? 'protan' : 'deutan';
  // Deutan is roughly five times more common than protan, so it is the better
  // guess when the evidence genuinely cannot separate them.
  return 'deutan';
}

function addThresholdEvidence(
  evidence: Evidence[],
  axis: CvdAxis | null,
  redGreenElevation: number,
  tritanElevation: number,
  verdict: Verdict,
): void {
  if (verdict === 'normal') {
    evidence.push({
      label: 'All three thresholds in the normal range',
      detail: `Your red-green thresholds came out ${fmt(redGreenElevation)}x and blue-yellow ${fmt(tritanElevation)}x the typical value, both within normal variation.`,
      weight: 'strong',
      supports: true,
    });
    return;
  }

  if (axis === 'tritan') {
    return;
  }

  evidence.push({
    label: 'Red-green thresholds clearly raised',
    detail: `You needed ${fmt(redGreenElevation)}x more colour difference than a typical observer to see the red-green shapes, while your blue-yellow threshold stayed at ${fmt(tritanElevation)}x. One axis raised and the other normal is the signature of a single affected cone type.`,
    weight: 'strong',
    supports: true,
  });
}

function addArrangementEvidence(
  evidence: Evidence[],
  arrangement: ArrangementResult,
  axis: CvdAxis | null,
  verdict: Verdict,
): void {
  if (arrangement.confusionAngle === null || arrangement.totalErrorScore === 0) {
    evidence.push({
      label: 'Colour ordering was essentially perfect',
      detail: 'You arranged the colour caps in order with no significant transpositions.',
      weight: verdict === 'normal' ? 'moderate' : 'weak',
      supports: verdict === 'normal',
    });
    return;
  }

  if (arrangement.axisStrength < 0.55) {
    evidence.push({
      label: 'Colour ordering errors had no clear direction',
      detail: `You made ${arrangement.totalErrorScore} steps of ordering error, but they did not line up along any one colour axis, which is more typical of rushing than of a colour deficiency.`,
      weight: 'weak',
      supports: false,
    });
    return;
  }

  const agrees =
    axis !== null &&
    (arrangement.matchedAxis === axis ||
      // Protan and deutan are too close together for this stage to separate, so
      // either counts as agreement for a red-green conclusion.
      (axis !== 'tritan' && arrangement.matchedAxis !== 'tritan'));

  const angles = axisAngles();
  const delta = axis ? axisAngleDistance(arrangement.confusionAngle, angles[axis]) : null;

  evidence.push({
    label: agrees
      ? 'Colour ordering errors line up with the same axis'
      : 'Colour ordering errors point at a different axis',
    detail: agrees
      ? `Your ordering mistakes fell along the ${arrangement.matchedAxis === 'tritan' ? 'blue-yellow' : 'red-green'} direction${delta !== null ? `, within ${Math.round(delta)} degrees of the expected confusion axis` : ''}. This is measured a completely different way from the threshold test, so the agreement is meaningful.`
      : `Your ordering mistakes fell along the ${arrangement.matchedAxis === 'tritan' ? 'blue-yellow' : 'red-green'} direction, which does not match the threshold result.`,
    weight: 'moderate',
    supports: agrees,
  });
}

function addPlateEvidence(
  evidence: Evidence[],
  plates: PlateSummary,
  axis: CvdAxis | null,
  verdict: Verdict,
): void {
  const rg = accuracy(plates.redGreen);
  if (rg === null) return;

  if (verdict === 'normal') {
    evidence.push({
      label: `Read ${plates.redGreen.correct} of ${plates.redGreen.total} hidden-figure plates`,
      detail: 'Including the faintest ones, which a colour deficiency would hide.',
      weight: 'moderate',
      supports: rg > 0.75,
    });
    return;
  }

  const expected = axis !== 'tritan';
  evidence.push({
    label: `Missed ${plates.redGreen.total - plates.redGreen.correct} of ${plates.redGreen.total} red-green plates`,
    detail:
      plates.redGreen.faintestSeen !== null
        ? `You read plates down to ${Math.round(plates.redGreen.faintestSeen * 100)}% of the maximum colour difference and lost them below that.`
        : 'You did not read any of the red-green plates, which indicates a strong deficiency.',
    weight: 'moderate',
    supports: expected,
  });

  if (plates.hiddenDigitTotal > 0 && plates.hiddenDigitCorrect > 0) {
    evidence.push({
      label: `Read ${plates.hiddenDigitCorrect} of ${plates.hiddenDigitTotal} reverse plates`,
      detail:
        'These carry a figure that is camouflaged by red-green noise. People with normal colour vision are distracted by the noise and usually miss it; red-green deficient observers cannot see the noise at all, so the figure stands out. Reading these is evidence in its own right.',
      weight: 'moderate',
      supports: true,
    });
  }
}

interface ConfidenceInput {
  readonly verdict: Verdict;
  readonly axis: CvdAxis | null;
  readonly evidence: readonly Evidence[];
  readonly arrangement: ArrangementResult;
  readonly luminance: LuminanceMatchResult;
  readonly plates: PlateSummary;
  readonly axisMetrics: readonly AxisMetric[];
  readonly redGreenElevation: number;
  readonly tritanElevation: number;
}

function assessConfidence(input: ConfidenceInput): {
  confidence: 'low' | 'moderate' | 'high';
  confidenceScore: number;
} {
  let score = 0.5;

  const supporting = input.evidence.filter((e) => e.supports);
  const contradicting = input.evidence.filter((e) => !e.supports);
  const weightOf = (e: Evidence) => (e.weight === 'strong' ? 0.16 : e.weight === 'moderate' ? 0.09 : 0.04);

  for (const e of supporting) score += weightOf(e);
  for (const e of contradicting) score -= weightOf(e) * 1.3;

  // A result sitting right on a boundary deserves less confidence than one far
  // from it, regardless of how much evidence agrees.
  const margin =
    input.verdict === 'normal'
      ? AFFECTED_ELEVATION / Math.max(input.redGreenElevation, input.tritanElevation)
      : Math.max(input.redGreenElevation, input.tritanElevation) / AFFECTED_ELEVATION;
  if (margin < 1.25) score -= 0.18;
  else if (margin > 2.5) score += 0.1;

  if (input.verdict === 'inconclusive') score = Math.min(score, 0.3);
  if (input.axisMetrics.some((m) => m.outcome === 'inconclusive')) score -= 0.12;
  if (input.luminance.consistency > 2.5 && input.axis !== 'tritan' && input.verdict === 'deficiency') {
    score -= 0.1;
  }
  if (input.plates.medianResponseMs > 0 && input.plates.medianResponseMs < 900) {
    // Answering plates faster than they can be read suggests clicking through.
    score -= 0.15;
  }

  const clamped = Math.max(0.05, Math.min(0.97, score));
  return {
    confidence: clamped >= 0.75 ? 'high' : clamped >= 0.5 ? 'moderate' : 'low',
    confidenceScore: clamped,
  };
}

function invalidResult(
  plates: PlateSummary,
  axisMetrics: readonly AxisMetric[],
  conePerformance: Record<CvdAxis, number>,
  redGreenElevation: number,
  tritanElevation: number,
  protanDeutanBalance: number,
): Assessment {
  return {
    verdict: 'invalid',
    axis: null,
    severity: 0,
    severityLabel: 'none',
    name: '',
    headline: 'This run cannot be scored',
    plainSummary:
      'The check plates are designed so that the figure is carried by brightness, which every form of colour blindness leaves intact. Missing one means something other than colour vision got in the way, so scoring the rest would be misleading.',
    confidence: 'low',
    confidenceScore: 0.05,
    evidence: [
      {
        label: `Missed ${plates.controlsTotal - plates.controlsPassed} of ${plates.controlsTotal} check plates`,
        detail:
          'These are readable with any colour vision at all, including complete colour blindness. The usual causes are a very dim or filtered display, a night-mode or blue-light filter still switched on, a browser zoom that shrank the plate, or the instructions being misread.',
        weight: 'strong',
        supports: false,
      },
    ],
    caveats: [
      'Turn off Night Shift, f.lux, True Tone and any blue-light filter, set the display brightness high, reset browser zoom to 100%, and run it again.',
    ],
    vision: null,
    axisMetrics,
    conePerformance,
    redGreenElevation,
    tritanElevation,
    protanDeutanBalance,
  };
}

function buildHeadline(
  verdict: Verdict,
  vision: Deficiency | null,
  severityLabel: SeverityLabel,
): string {
  switch (verdict) {
    case 'normal':
      return 'Normal colour vision';
    case 'invalid':
      return 'This run cannot be scored';
    case 'inconclusive':
      return 'No clear pattern';
    case 'deficiency': {
      if (!vision) return 'No clear pattern';
      const common: Record<CvdAxis, string> = {
        protan: 'red-weak',
        deutan: 'green-weak',
        tritan: 'blue-yellow',
      };
      const nameOfType = deficiencyName(vision);
      return `${capitalise(severityLabel)} ${nameOfType} (${common[vision.axis]})`;
    }
  }
}

function buildSummary(
  verdict: Verdict,
  vision: Deficiency | null,
  severityLabel: SeverityLabel,
  conePerformance: Record<CvdAxis, number>,
): string {
  if (verdict === 'normal') {
    return 'Your three cone types appear to be working and to be well separated from each other. You distinguished colour differences down to the range typical of normal colour vision on all three axes.';
  }
  if (verdict === 'inconclusive') {
    return 'Your thresholds came out raised on every axis by a similar amount. That is not the pattern of inherited colour blindness, which affects one cone type at a time, so the most likely cause is something about the viewing conditions rather than your eyes.';
  }
  if (verdict === 'invalid' || !vision) {
    return '';
  }

  const cone = CONE_LABEL[vision.axis];
  const pct = Math.round(conePerformance[vision.axis] * 100);
  const complete = severityLabel === 'complete';

  const which: Record<CvdAxis, string> = {
    protan: 'long-wavelength (red-sensitive)',
    deutan: 'middle-wavelength (green-sensitive)',
    tritan: 'short-wavelength (blue-sensitive)',
  };

  if (complete) {
    return `Your ${which[vision.axis]} ${cone}s appear not to be contributing usable colour information. That leaves you with two working channels instead of three, so a whole family of colours that other people see as different arrive as the same colour. This is the complete form, and it is stable over a lifetime rather than something that worsens.`;
  }

  return `Your ${which[vision.axis]} ${cone}s are responding, but their sensitivity overlaps too closely with the neighbouring cone type, so the difference signal between them is weak. On this axis you resolved about ${pct}% of the colour difference a typical observer resolves. You have three working channels, but one pair of them is telling you nearly the same thing.`;
}

function axisWord(axis: CvdAxis): string {
  return axis === 'tritan' ? 'blue-yellow' : axis === 'protan' ? 'protan (red)' : 'deutan (green)';
}

function fmt(n: number): string {
  if (!Number.isFinite(n)) return '\u221e';
  return n >= 10 ? n.toFixed(0) : n.toFixed(1);
}

function capitalise(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
