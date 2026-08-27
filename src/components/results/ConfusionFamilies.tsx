/**
 * "Colours you will confuse" -- the section people came for.
 *
 * Families rather than pairs, because that is how the experience actually works:
 * it is not that red looks like brown, it is that red, brown, olive and dark
 * green all arrive as one sludgy colour. Clustering in simulated colour space
 * reproduces exactly that.
 *
 * Every swatch is shown twice, as the colour is and as it reaches the observer.
 * For a normal-vision visitor the right-hand column is the revelation; for a CVD
 * visitor the *left* column is, because the two halves of each pair will look
 * identical to them, which is itself the clearest possible demonstration.
 */
import { useMemo, useState } from 'react';
import { analyseConfusions, describeFamily } from '../../analysis/confusables';
import type { Vision } from '../../color/cvd';

export function ConfusionFamilies({ vision }: { vision: Vision }) {
  const analysis = useMemo(() => analyseConfusions(vision), [vision]);
  const [showSeen, setShowSeen] = useState(true);

  if (!vision) {
    return (
      <section className="stack">
        <h2>Colours you will confuse</h2>
        <p className="muted">
          None. No colour family in the palette collapses for you.
        </p>
      </section>
    );
  }

  const families = analysis.families;

  return (
    <section className="stack">
      <div className="row row--between">
        <h2 style={{ margin: 0 }}>Colours you will confuse</h2>
        <div className="seg seg--small" role="group" aria-label="Swatch rendering">
          <button
            type="button"
            className={`seg__btn ${showSeen ? 'seg__btn--on' : ''}`}
            onClick={() => setShowSeen(true)}
            aria-pressed={showSeen}
          >
            As you see them
          </button>
          <button
            type="button"
            className={`seg__btn ${!showSeen ? 'seg__btn--on' : ''}`}
            onClick={() => setShowSeen(false)}
            aria-pressed={!showSeen}
          >
            True colours
          </button>
        </div>
      </div>

      <div className="row" style={{ gap: 'var(--space-4)' }}>
        <span className="bignum">
          {Math.round(analysis.collapseRate * 100)}
          <span className="bignum__unit">%</span>
        </span>
        <p className="muted" style={{ margin: 0 }}>
          of colour pairs in this palette lose their hue difference for you. Each group below lands
          in nearly the same place.
        </p>
      </div>

      <div className="stack">
        {families.map((family, i) => (
          <div key={i} className="family">
            <div className="family__head">
              <div>
                <strong>{describeFamily(family)}</strong>
                <div className="faint">
                  {family.members.length} colours
                  {family.indistinguishable
                    ? ' \u2014 effectively one colour for you'
                    : family.lightnessSpread > 0.12
                      ? ' \u2014 same hue to you, but brightness still tells them apart'
                      : ' \u2014 very close for you'}
                </div>
              </div>
            </div>

            <div className="swatches">
              {family.members.map((member) => (
                <figure key={member.name} className="swatch">
                  <div
                    className="swatch__chip"
                    style={{ background: showSeen ? member.seenHex : member.hex }}
                  />
                  <figcaption>{member.name}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        ))}
      </div>

      {analysis.pairs.length > 0 && (
        <details className="card">
          <summary>
            <strong>The specific pairs most likely to catch you out</strong>
          </summary>
          <p className="muted">
            Ordered by difference lost. &ldquo;Brightness helps&rdquo; means the hue is gone but one
            is clearly lighter &mdash; the cue people learn to lean on without noticing.
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Pair</th>
                  <th scope="col">Difference normally</th>
                  <th scope="col">Difference for you</th>
                  <th scope="col">Brightness still helps?</th>
                </tr>
              </thead>
              <tbody>
                {analysis.pairs.slice(0, 18).map((pair) => (
                  <tr key={`${pair.a.name}-${pair.b.name}`}>
                    <th scope="row">
                      <span className="row" style={{ gap: 6 }}>
                        <span
                          className="dot-swatch"
                          style={{ background: showSeen ? pair.a.seenHex : pair.a.hex }}
                          aria-hidden="true"
                        />
                        <span
                          className="dot-swatch"
                          style={{ background: showSeen ? pair.b.seenHex : pair.b.hex }}
                          aria-hidden="true"
                        />
                        {pair.a.name} &amp; {pair.b.name}
                      </span>
                    </th>
                    <td className="mono">{(pair.trueDistance * 100).toFixed(0)}</td>
                    <td className="mono">{(pair.seenDistance * 100).toFixed(0)}</td>
                    <td>{pair.brightnessStillSeparates ? 'Yes' : 'No'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      <div className="card stack">
        <h3>Colours that stay reliably distinct</h3>
        <p className="muted">
          Safe choices when you colour-code something for yourself.
        </p>
        <div className="swatches">
          {analysis.safePalette.map((color) => (
            <figure key={color.name} className="swatch">
              <div
                className="swatch__chip"
                style={{ background: showSeen ? color.seenHex : color.hex }}
              />
              <figcaption>{color.name}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
