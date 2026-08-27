/**
 * The session state machine.
 *
 * The four measurement stages hold mutable engine objects (the interleaved
 * staircases in particular), so those live in refs and the hook exposes explicit
 * commands that mutate them and then bump a version counter to re-render. Trying
 * to model an adaptive staircase as immutable React state would mean cloning the
 * whole trial history on every keypress for no benefit.
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import { ThresholdBlock, type ThresholdTrialRequest } from '../engine/thresholdBlock';
import { buildPlateSet, type PlatePlan } from '../stimuli/plateSet';
import { scoreArrangement } from '../engine/arrangement';
import {
  interpretLuminanceMatch,
  startingScales,
  type LuminanceMatchResult,
} from '../engine/luminanceMatch';
import { summarisePlates, type PlateResponse } from '../engine/scoring/plates';
import { classify } from '../engine/classify';
import { shuffledStart } from '../engine/arrangement';
import { makeRng, randomSeed } from '../util/rng';
import { STAGE_ORDER, STAGE_WEIGHT, type Phase, type SessionResults } from './types';
import { decodeShared, type DecodedResults } from './share';

export interface SessionApi {
  readonly phase: Phase;
  readonly seed: number;
  readonly progress: number;

  /** Plate stage. */
  readonly platePlan: PlatePlan | null;
  readonly plateIndex: number;
  readonly plateTotal: number;
  answerPlate(response: string | null): void;

  /** Threshold stage. */
  readonly thresholdTrial: ThresholdTrialRequest | null;
  readonly thresholdTrialCount: number;
  readonly thresholdEstimatedRemaining: number;
  answerThreshold(orientation: 'up' | 'right' | 'down' | 'left'): void;

  /** Luminance stage. */
  readonly luminanceRepeat: number;
  readonly luminanceRepeatTotal: number;
  readonly luminanceStart: number;
  submitLuminance(scale: number): void;

  /** Arrangement stage. */
  readonly capOrder: readonly number[];
  setCapOrder(order: readonly number[]): void;
  submitArrangement(): void;

  readonly results: SessionResults | null;

  /** True when the results came from a shared link rather than this session. */
  readonly isShared: boolean;
  /** Whoever the shared results belong to, if the link said. */
  readonly sharedName: string | null;

  advance(to: Phase): void;
  restart(): void;
}

const LUMINANCE_REPEATS = 4;

/** Keeps the cap shuffle independent of the plate and staircase sequences. */
const CAP_SEED_SALT = 0xca9e5;

export function useSession(): SessionApi {
  // A shared link goes straight to the report it encodes. Doing this in the
  // initialisers rather than an effect avoids rendering the intro screen for a
  // frame first, which looked like a bug.
  const shared = useMemo(() => readSharedResults(), []);

  const [seed, setSeed] = useState(() => shared?.results.seed ?? randomSeed());
  const [phase, setPhase] = useState<Phase>(shared ? 'results' : 'intro');
  const [version, setVersion] = useState(0);
  const [results, setResults] = useState<SessionResults | null>(shared?.results ?? null);
  // Cleared as soon as the visitor starts their own test, so the shared framing
  // never leaks into their own report.
  const [sharedName, setSharedName] = useState<string | null>(shared?.name ?? null);
  const [isShared, setIsShared] = useState(Boolean(shared));

  const bump = useCallback(() => setVersion((v) => v + 1), []);

  const plateSet = useMemo(() => buildPlateSet(seed), [seed]);
  const plateResponses = useRef<PlateResponse[]>([]);
  const plateShownAt = useRef<number>(Date.now());

  const block = useRef<ThresholdBlock>(new ThresholdBlock(seed));
  const luminanceSettings = useRef<number[]>([]);
  const startedAt = useRef<number>(Date.now());

  const capStarts = useMemo(() => shuffledStart(makeRng(seed ^ CAP_SEED_SALT), 0), [seed]);
  const [capOrder, setCapOrder] = useState<readonly number[]>(capStarts);

  // Reset derived stage state whenever the seed changes (i.e. on restart).
  const seedRef = useRef(seed);
  if (seedRef.current !== seed) {
    seedRef.current = seed;
    plateResponses.current = [];
    block.current = new ThresholdBlock(seed);
    luminanceSettings.current = [];
    startedAt.current = Date.now();
  }

  const plateIndex = plateResponses.current.length;
  const platePlan = plateIndex < plateSet.length ? plateSet[plateIndex] : null;
  const thresholdTrial = phase === 'thresholds' ? block.current.nextTrial() : null;

  const finish = useCallback(() => {
    const thresholds = block.current.results();
    const plates = summarisePlates(plateResponses.current);
    const luminance: LuminanceMatchResult = interpretLuminanceMatch(luminanceSettings.current);
    const arrangement = scoreArrangement(capOrder);

    setResults({
      seed,
      completedAt: new Date().toISOString(),
      thresholds,
      plates: plateResponses.current,
      luminance,
      arrangement,
      assessment: classify({ thresholds, plates, luminance, arrangement }),
      durationMs: Date.now() - startedAt.current,
    });
    setPhase('results');
  }, [capOrder, seed]);

  const answerPlate = useCallback(
    (response: string | null) => {
      const plan = plateSet[plateResponses.current.length];
      if (!plan) return;

      plateResponses.current = [
        ...plateResponses.current,
        {
          plan,
          response,
          correct: response !== null && response === plan.answer,
          elapsedMs: Date.now() - plateShownAt.current,
        },
      ];
      plateShownAt.current = Date.now();

      if (plateResponses.current.length >= plateSet.length) setPhase('thresholdsIntro');
      bump();
    },
    [bump, plateSet],
  );

  const answerThreshold = useCallback(
    (orientation: 'up' | 'right' | 'down' | 'left') => {
      block.current.respondWithOrientation(orientation);
      if (block.current.finished) setPhase('luminanceIntro');
      bump();
    },
    [bump],
  );

  const submitLuminance = useCallback(
    (scale: number) => {
      luminanceSettings.current = [...luminanceSettings.current, scale];
      if (luminanceSettings.current.length >= LUMINANCE_REPEATS) setPhase('arrangementIntro');
      bump();
    },
    [bump],
  );

  const advance = useCallback((to: Phase) => {
    if (to === 'plates') plateShownAt.current = Date.now();
    setPhase(to);
  }, []);

  const restart = useCallback(() => {
    const next = randomSeed();
    setResults(null);
    setCapOrder(shuffledStart(makeRng(next ^ CAP_SEED_SALT), 0));
    setSeed(next);
    setPhase('intro');
    setIsShared(false);
    setSharedName(null);
    // Otherwise a reload would drop the observer straight back into the shared
    // report they just chose to leave.
    if (typeof window !== 'undefined' && window.location.hash.startsWith('#r=')) {
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  const progress = useMemo(() => {
    let done = 0;
    for (const stage of STAGE_ORDER) {
      const weight = STAGE_WEIGHT[stage];
      const fraction = stageFraction(stage, {
        phase,
        plateIndex,
        plateTotal: plateSet.length,
        thresholdProgress: block.current.progress,
        luminanceDone: luminanceSettings.current.length,
      });
      done += weight * fraction;
    }
    return Math.min(1, done);
    // `version` is the signal that the mutable engine objects moved on.
  }, [phase, plateIndex, plateSet.length, version]);

  return {
    phase,
    seed,
    progress,
    platePlan,
    plateIndex,
    plateTotal: plateSet.length,
    answerPlate,
    thresholdTrial,
    thresholdTrialCount: block.current.trialCount,
    thresholdEstimatedRemaining: block.current.estimatedRemaining,
    answerThreshold,
    luminanceRepeat: luminanceSettings.current.length,
    luminanceRepeatTotal: LUMINANCE_REPEATS,
    luminanceStart: startingScales()[luminanceSettings.current.length % LUMINANCE_REPEATS],
    submitLuminance,
    capOrder,
    setCapOrder,
    submitArrangement: finish,
    results,
    isShared,
    sharedName,
    advance,
    restart,
  };
}

/** A result carried in the URL hash, if there is a valid one. */
function readSharedResults(): DecodedResults | null {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash;
  if (!hash.startsWith('#r=')) return null;
  return decodeShared(hash);
}

interface ProgressInputs {
  phase: Phase;
  plateIndex: number;
  plateTotal: number;
  thresholdProgress: number;
  luminanceDone: number;
}

/** How far through a given stage we are: 1 if already past it, 0 if not started. */
function stageFraction(stage: Phase, inputs: ProgressInputs): number {
  const order: Phase[] = [
    'intro',
    'displayCheck',
    'plates',
    'thresholdsIntro',
    'thresholds',
    'luminanceIntro',
    'luminance',
    'arrangementIntro',
    'arrangement',
    'results',
  ];
  const current = order.indexOf(inputs.phase);
  const target = order.indexOf(stage);

  if (current > target) return 1;
  if (current < target) return 0;

  switch (stage) {
    case 'plates':
      return inputs.plateTotal ? inputs.plateIndex / inputs.plateTotal : 0;
    case 'thresholds':
      return inputs.thresholdProgress;
    case 'luminance':
      return inputs.luminanceDone / LUMINANCE_REPEATS;
    case 'arrangement':
      return 0.5;
    default:
      return 0;
  }
}
