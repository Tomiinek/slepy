/**
 * Working out which named colours a given observer will mix up.
 *
 * The method is simple and, importantly, falsifiable: simulate every colour in
 * the palette through the observer's measured vision, then look for colours that
 * end up close together *after* simulation while being far apart before it. Those
 * are exactly the pairs that other people see as obviously different and this
 * observer does not.
 *
 * Reporting pairs alone undersells it, though. What people actually describe is
 * whole families collapsing -- "all my greens, browns and dull reds are one
 * colour". So the pairs are clustered into families by complete-linkage
 * agglomerative clustering, which requires *every* member of a family to be
 * confusable with every other member. Single-linkage would chain together long
 * straggling groups whose endpoints are perfectly distinguishable, which would be
 * a much less honest thing to show someone.
 */
import { simulateSrgb, type Vision } from '../color/cvd';
import { deltaChromaOk, deltaEOk, oklabFromSrgb, type Oklab } from '../color/oklab';
import { hexFromSrgb, type Srgb } from '../color/srgb';
import { PALETTE_COLORS, type PaletteEntry } from './palette';

/**
 * Simulated *chromatic* distance below which two colours read as the same hue.
 *
 * Chromatic rather than total distance, deliberately. Judging on total distance
 * quietly gets the answer wrong: traffic-light red and traffic-light green still
 * differ in lightness after simulation, so a total-distance test declares them
 * distinguishable -- yet "I can't tell the red light from the green one by
 * colour" is the single most reported experience of red-green deficiency. What
 * survives for those observers is a brightness difference, and brightness is a
 * fragile cue that shifts with the weather, the bulb and the angle.
 *
 * So a family here means "these are the same colour to you". Whether brightness
 * still separates them is reported alongside, per pair, rather than being folded
 * into one number that hides the distinction.
 *
 * The observer's severity is already baked into the simulation, so this stays a
 * fixed perceptual criterion; scaling it by their threshold as well would
 * double-count the deficiency.
 */
export const CONFUSION_LIMIT = 0.02;

/**
 * How much lightness counts relative to hue when deciding whether two colours
 * are "the same colour".
 *
 * Ignoring lightness entirely is wrong in a way that destroys credibility:
 * every near-neutral has almost no chroma, so black, white and all the greys
 * collapse into a single family, and the report ends up claiming someone cannot
 * tell black from white. Weighting lightness fully is wrong in the other
 * direction, as it lets a brightness difference rescue pairs whose hue has
 * genuinely vanished. A low weight matches how people actually name colours:
 * hue dominates, but a large brightness gap is never mistaken.
 */
const LIGHTNESS_WEIGHT = 0.18;

/** Chroma-dominant perceptual distance -- see LIGHTNESS_WEIGHT. */
export function confusionDistance(a: Oklab, b: Oklab): number {
  return Math.hypot(LIGHTNESS_WEIGHT * (a[0] - b[0]), a[1] - b[1], a[2] - b[2]);
}

/**
 * How far apart the colours must be for a normal observer before a collision is
 * worth mentioning. Without this, near-identical shades of grey would fill the
 * results with pairs nobody could tell apart anyway.
 */
export const INTEREST_LIMIT = 0.1;

/**
 * Lightness difference above which brightness is still a usable cue, even though
 * the hue has collapsed. Around three times a just-noticeable difference, so it
 * survives ordinary variation in lighting.
 */
export const LIGHTNESS_CUE_LIMIT = 0.07;

export interface SimulatedColor extends PaletteEntry {
  /** How this colour appears to the observer. */
  readonly seen: Srgb;
  readonly seenHex: string;
  readonly seenLab: Oklab;
  readonly trueLab: Oklab;
}

export interface ConfusablePair {
  readonly a: SimulatedColor;
  readonly b: SimulatedColor;
  /** Total distance a normal observer sees. */
  readonly trueDistance: number;
  /** Total distance this observer sees, lightness included. */
  readonly seenDistance: number;
  /** Hue-and-saturation distance this observer sees. */
  readonly seenChromaDistance: number;
  /** Lightness difference left to this observer. */
  readonly seenLightnessDelta: number;
  /**
   * True when the hue has collapsed but a brightness difference remains, so the
   * two are still separable in good light -- just not by colour.
   */
  readonly brightnessStillSeparates: boolean;
  /**
   * How much chromatic information is lost, 0..1. 1 means the hue difference
   * vanishes entirely; this is what the results are sorted by.
   */
  readonly lost: number;
}

export interface ConfusionFamily {
  readonly members: readonly SimulatedColor[];
  /** Mean colour of the family as the observer sees it. */
  readonly seenHex: string;
  /** Largest true distance within the family, i.e. how much is being merged. */
  readonly spread: number;
  /** Lightness range left within the family. */
  readonly lightnessSpread: number;
  /** True when every member also looks equally bright, so nothing separates them. */
  readonly indistinguishable: boolean;
  readonly categories: readonly string[];
}

export interface ConfusionAnalysis {
  readonly colors: readonly SimulatedColor[];
  readonly families: readonly ConfusionFamily[];
  readonly pairs: readonly ConfusablePair[];
  /** Colours this observer can always tell apart from each other. */
  readonly safePalette: readonly SimulatedColor[];
  /**
   * Share of clearly-different palette pairs whose hue difference is lost, 0..1.
   */
  readonly collapseRate: number;
}

export function simulatePalette(vision: Vision): SimulatedColor[] {
  return PALETTE_COLORS.map((entry) => {
    const seen = simulateSrgb(entry.color, vision);
    return {
      ...entry,
      seen,
      seenHex: hexFromSrgb(seen),
      seenLab: oklabFromSrgb(seen),
      trueLab: oklabFromSrgb(entry.color),
    };
  });
}

export function analyseConfusions(vision: Vision): ConfusionAnalysis {
  const colors = simulatePalette(vision);
  const pairs: ConfusablePair[] = [];
  let collapsed = 0;
  let considered = 0;

  for (let i = 0; i < colors.length; i++) {
    for (let j = i + 1; j < colors.length; j++) {
      const a = colors[i];
      const b = colors[j];
      const trueDistance = deltaEOk(a.trueLab, b.trueLab);
      const trueChroma = deltaChromaOk(a.trueLab, b.trueLab);
      const seenChromaDistance = deltaChromaOk(a.seenLab, b.seenLab);

      // Colours that were already the same hue for everyone -- a light grey and a
      // dark grey, say -- are not a deficiency finding, and counting them would
      // give even a normal observer a non-zero collapse rate.
      const isHueDifference =
        trueDistance >= INTEREST_LIMIT && trueChroma >= CONFUSION_LIMIT;

      // Pairs are judged on hue alone, deliberately differently from families.
      // "Traffic-light red and traffic-light green are the same colour to me,
      // I go by which lamp is lit" is a true and important thing to report, and
      // a combined distance would silently drop it because the two do still
      // differ in brightness. The `brightnessStillSeparates` flag carries that
      // qualification instead of hiding it.
      if (isHueDifference) {
        considered++;
        if (seenChromaDistance < CONFUSION_LIMIT) collapsed++;
      }

      if (!isHueDifference || seenChromaDistance >= CONFUSION_LIMIT) continue;

      const seenLightnessDelta = Math.abs(a.seenLab[0] - b.seenLab[0]);

      pairs.push({
        a,
        b,
        trueDistance,
        seenDistance: deltaEOk(a.seenLab, b.seenLab),
        seenChromaDistance,
        seenLightnessDelta,
        brightnessStillSeparates: seenLightnessDelta >= LIGHTNESS_CUE_LIMIT,
        lost: 1 - seenChromaDistance / trueChroma,
      });
    }
  }

  pairs.sort((x, y) => y.lost - x.lost || y.trueDistance - x.trueDistance);

  return {
    colors,
    pairs,
    families: buildFamilies(colors),
    safePalette: buildSafePalette(colors),
    collapseRate: considered > 0 ? collapsed / considered : 0,
  };
}

/**
 * Complete-linkage agglomerative clustering in the observer's own colour space.
 *
 * Merging stops when the closest two clusters are further apart than the
 * confusion limit. Complete linkage means the merge distance is the *worst* pair
 * across the two clusters, so a family only forms if all of its members really do
 * look alike to this observer.
 */
function buildFamilies(colors: readonly SimulatedColor[]): ConfusionFamily[] {
  let clusters: SimulatedColor[][] = colors.map((c) => [c]);

  const linkage = (a: SimulatedColor[], b: SimulatedColor[]): number => {
    let worst = 0;
    for (const x of a) {
      for (const y of b) {
        worst = Math.max(worst, confusionDistance(x.seenLab, y.seenLab));
      }
    }
    return worst;
  };

  for (;;) {
    let bestI = -1;
    let bestJ = -1;
    let bestDistance = Infinity;

    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const d = linkage(clusters[i], clusters[j]);
        if (d < bestDistance) {
          bestDistance = d;
          bestI = i;
          bestJ = j;
        }
      }
    }

    if (bestI < 0 || bestDistance >= CONFUSION_LIMIT) break;

    clusters[bestI] = [...clusters[bestI], ...clusters[bestJ]];
    clusters = clusters.filter((_, index) => index !== bestJ);
  }

  return clusters
    .filter((members) => members.length > 1)
    .map((members) => {
      let spread = 0;
      for (const a of members) {
        for (const b of members) {
          spread = Math.max(spread, deltaEOk(a.trueLab, b.trueLab));
        }
      }
      const lightnesses = members.map((m) => m.seenLab[0]);
      const lightnessSpread = Math.max(...lightnesses) - Math.min(...lightnesses);

      return {
        members: [...members].sort((a, b) => a.trueLab[0] - b.trueLab[0]),
        seenHex: meanSeenHex(members),
        spread,
        lightnessSpread,
        indistinguishable: lightnessSpread < LIGHTNESS_CUE_LIMIT,
        categories: [...new Set(members.map((m) => m.category))],
      };
    })
    // Only families that merge genuinely different colours are interesting.
    .filter((family) => family.spread >= INTEREST_LIMIT)
    .sort((a, b) => b.members.length - a.members.length || b.spread - a.spread);
}

/**
 * A set of colours this observer can always tell apart from each other.
 *
 * The obvious implementation -- "colours whose nearest neighbour is far away" --
 * returns nothing useful, because a deficiency squeezes ninety colours onto
 * effectively one chromatic axis and then nothing is far from everything. The
 * question worth answering is different and more actionable: if you have to pick
 * a few colours that you will never mix up, which ones? That is a maximal set of
 * mutually distinguishable colours, built here greedily from the most saturated
 * candidates outward, since vivid colours anchor a palette better than muted
 * ones.
 *
 * This is the section people can actually use -- for their own charts, labels,
 * and anything they have to colour-code at work.
 */
function buildSafePalette(colors: readonly SimulatedColor[]): SimulatedColor[] {
  const margin = CONFUSION_LIMIT * 2.5;

  const candidates = [...colors].sort(
    (a, b) => Math.hypot(b.seenLab[1], b.seenLab[2]) - Math.hypot(a.seenLab[1], a.seenLab[2]),
  );

  const chosen: SimulatedColor[] = [];
  for (const candidate of candidates) {
    const clashes = chosen.some(
      (picked) => confusionDistance(candidate.seenLab, picked.seenLab) < margin,
    );
    if (!clashes) chosen.push(candidate);
  }

  return chosen.sort((a, b) => a.seenLab[0] - b.seenLab[0]);
}

function meanSeenHex(members: readonly SimulatedColor[]): string {
  const mean = members
    .reduce<[number, number, number]>(
      (acc, m) => [acc[0] + m.seen[0], acc[1] + m.seen[1], acc[2] + m.seen[2]],
      [0, 0, 0],
    )
    .map((v) => v / members.length) as unknown as Srgb;
  return hexFromSrgb(mean);
}

/**
 * A short, plain-language description of a family, for the report heading.
 * Written to read like something a person would say.
 */
export function describeFamily(family: ConfusionFamily): string {
  const names = family.members.map((m) => m.name.toLowerCase());
  if (names.length === 2) return `${cap(names[0])} and ${names[1]}`;
  const head = names.slice(0, -1).map(cap).join(', ');
  return `${head} and ${names[names.length - 1]}`;
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
