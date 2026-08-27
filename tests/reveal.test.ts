/**
 * Does "reveal" mode actually reveal anything?
 *
 * The claim the report makes is specific and falsifiable: two colours that a
 * deficient observer cannot tell apart become distinguishable *to that same
 * observer* after daltonisation. That is only true if the correction moves the
 * lost difference onto an axis they still have. It is easy to write a
 * daltonisation that looks busy and recovers nothing, so this measures it: take
 * confusable pairs, and check the difference the observer perceives grows.
 *
 * Note both sides are passed through the observer's own simulation. Comparing a
 * daltonised image directly against the original would only prove that a normal
 * observer sees a change, which is not the claim.
 */
import { describe, expect, it } from 'vitest';
import { simulateSrgb, type Deficiency } from '../src/color/cvd';
import { daltonizeSrgb } from '../src/color/daltonize';
import { deltaEOkSrgb } from '../src/color/oklab';
import { srgbFromHex } from '../src/color/srgb';
import { PALETTE } from '../src/analysis/palette';
import { CVD_AXES } from '../src/color/lms';

/** What the observer perceives, given a colour that may have been corrected. */
function perceived(hex: string, vision: Deficiency, correct: boolean) {
  const srgb = srgbFromHex(hex);
  return simulateSrgb(correct ? daltonizeSrgb(srgb, vision) : srgb, vision);
}

describe('reveal (reverse daltonisation)', () => {
  for (const axis of CVD_AXES) {
    const vision: Deficiency = { axis, severity: 1 };

    it(`recovers contrast a ${axis} dichromat has lost`, () => {
      // The pairs this deficiency collapses hardest: a large real difference that
      // the observer perceives as almost nothing. Ranking rather than applying a
      // fixed cutoff keeps the test meaningful on every axis -- the palette is
      // built around everyday colours, which collide far more often on the
      // red-green axes than on the blue-yellow one.
      const scored: { pair: [string, string]; loss: number }[] = [];
      for (let i = 0; i < PALETTE.length; i++) {
        for (let j = i + 1; j < PALETTE.length; j++) {
          const a = PALETTE[i].hex;
          const b = PALETTE[j].hex;
          const real = deltaEOkSrgb(srgbFromHex(a), srgbFromHex(b));
          if (real < 0.15) continue;
          const seen = deltaEOkSrgb(
            perceived(a, vision, false),
            perceived(b, vision, false),
          );
          scored.push({ pair: [a, b], loss: real - seen });
        }
      }

      scored.sort((x, y) => y.loss - x.loss);
      const pairs = scored.slice(0, 30).map((s) => s.pair);

      expect(pairs.length).toBeGreaterThan(3);

      let improved = 0;
      for (const [a, b] of pairs) {
        const before = deltaEOkSrgb(
          perceived(a, vision, false),
          perceived(b, vision, false),
        );
        const after = deltaEOkSrgb(
          perceived(a, vision, true),
          perceived(b, vision, true),
        );
        if (after > before + 0.02) improved++;
      }

      // Not every pair can be rescued -- the correction has a finite budget of
      // lightness and blue-yellow range to redistribute into, and some pairs are
      // already similar in both. Most should improve.
      expect(improved / pairs.length).toBeGreaterThan(0.6);
    });

    it(`leaves a ${axis} observer's neutrals alone`, () => {
      // Greys carry no chromatic difference to redistribute, so correcting them
      // should be close to a no-op. A correction that tints neutrals is a sign
      // the transform is not anchored properly, and it makes photographs look
      // broken rather than clearer.
      for (const grey of ['#202020', '#808080', '#d0d0d0']) {
        const before = perceived(grey, vision, false);
        const after = perceived(grey, vision, true);
        expect(deltaEOkSrgb(before, after)).toBeLessThan(0.06);
      }
    });
  }
});
