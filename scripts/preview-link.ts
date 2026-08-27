/**
 * Prints a shareable report URL for a synthetic observer.
 *
 * Used to open the results page directly during development and visual review,
 * instead of sitting through all four stages to reach it. Run with:
 *   npx vite-node scripts/preview-link.ts -- deutan
 */
import { encodeResults } from '../src/session/share';
import { classify } from '../src/engine/classify';
import { interpretLuminanceMatch } from '../src/engine/luminanceMatch';
import { scoreArrangement } from '../src/engine/arrangement';
import { summarisePlates } from '../src/engine/scoring/plates';
import { buildPlateSet } from '../src/stimuli/plateSet';
import { CVD_AXES, type CvdAxis } from '../src/color/lms';
import type { AxisThresholds } from '../src/engine/thresholdBlock';
import type { SessionResults } from '../src/session/types';

type Profile = 'normal' | 'protan' | 'deutan' | 'tritan';

const NORMAL = 0.0019;

const PROFILES: Record<Profile, { thresholds: Record<CvdAxis, number>; luminance: number[] }> = {
  normal: {
    thresholds: { protan: NORMAL, deutan: NORMAL, tritan: NORMAL * 1.2 },
    luminance: [0.42, 0.44, 0.41, 0.43],
  },
  protan: {
    thresholds: { protan: NORMAL * 9, deutan: NORMAL * 8, tritan: NORMAL * 1.1 },
    luminance: [0.9, 0.94, 0.88, 0.92],
  },
  deutan: {
    thresholds: { protan: NORMAL * 5.5, deutan: NORMAL * 6.5, tritan: NORMAL * 1.1 },
    luminance: [0.44, 0.46, 0.43, 0.45],
  },
  tritan: {
    thresholds: { protan: NORMAL * 1.1, deutan: NORMAL, tritan: NORMAL * 7 },
    luminance: [0.43, 0.45, 0.42, 0.44],
  },
};

function makeResults(profile: Profile): SessionResults {
  const seed = 987654;
  const spec = PROFILES[profile];

  const thresholds = {} as AxisThresholds;
  for (const axis of CVD_AXES) {
    const value = spec.thresholds[axis];
    thresholds[axis] = {
      threshold: value,
      outcome: 'measured',
      reversals: [value * 1.05, value * 0.95, value, value * 1.02],
      trials: [],
      precision: 1.1,
    };
  }

  const plan = buildPlateSet(seed);
  const deficient = profile !== 'normal';
  const plates = summarisePlates(
    plan.map((p, i) => {
      // Controls always right; red-green plates missed for a deficient observer.
      const miss = deficient && p.mode !== 'control' && i % 3 !== 0;
      return {
        plan: p,
        response: miss ? null : p.answer,
        correct: !miss,
        elapsedMs: 2400,
      };
    }),
  );

  const luminance = interpretLuminanceMatch(spec.luminance);
  const arrangement = scoreArrangement(scoreArrangement([]).order);

  return {
    seed,
    completedAt: new Date().toISOString(),
    thresholds,
    plates: plates.responses,
    luminance,
    arrangement,
    assessment: classify({ thresholds, plates, luminance, arrangement }),
  };
}

const profile = (process.argv[2] ?? 'deutan') as Profile;
const results = makeResults(profile);

console.log(`profile:  ${profile}`);
console.log(`verdict:  ${results.assessment.headline}`);
console.log(`url:      http://localhost:5173/#r=${encodeResults(results)}`);
