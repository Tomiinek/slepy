/**
 * Seeded PRNG (mulberry32). Every stimulus is generated from an explicit seed so
 * a session can be reproduced exactly -- which matters for debugging a reported
 * result, and lets the test suite drive the real generators deterministically.
 */
export interface Rng {
  /** Uniform in [0, 1). */
  next(): number;
  /** Uniform in [lo, hi). */
  range(lo: number, hi: number): number;
  /** Uniform integer in [0, n). */
  int(n: number): number;
  pick<T>(items: readonly T[]): T;
  shuffle<T>(items: readonly T[]): T[];
  /** Approximately normal, mean 0, sd 1. */
  normal(): number;
}

export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  if (a === 0) a = 0x9e3779b9;

  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const rng: Rng = {
    next,
    range: (lo, hi) => lo + next() * (hi - lo),
    int: (n) => Math.floor(next() * n),
    pick: (items) => items[Math.floor(next() * items.length)],
    shuffle: (items) => {
      const out = items.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
    // Irwin-Hall with n = 6, rescaled. Plenty for visual jitter and much cheaper
    // than Box-Muller, with the bonus of being bounded so no wild outliers.
    normal: () => {
      let s = 0;
      for (let i = 0; i < 6; i++) s += next();
      return (s - 3) / 0.7071;
    },
  };

  return rng;
}

/** A seed derived from the current time, for fresh sessions. */
export function randomSeed(): number {
  return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
}
