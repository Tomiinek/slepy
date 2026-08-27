/**
 * The share section.
 *
 * One job: produce a link that explains your colour vision to someone else, so
 * you can answer "so you can't see traffic lights?" by sending a URL instead of
 * giving the same speech again.
 *
 * The link opens a page written *about* you rather than a copy of your own
 * report, which is why the optional name matters: "Tomas has deuteranomaly"
 * lands very differently from "someone has deuteranomaly". The name is the only
 * personal detail in the URL and is entirely optional.
 */
import { useCallback, useMemo, useState } from 'react';
import { sanitiseName, shareUrl } from '../../session/share';
import type { SessionResults } from '../../session/types';

export function SharePanel({ results }: { results: SessionResults }) {
  const [name, setName] = useState('');
  const [copied, setCopied] = useState(false);

  const url = useMemo(() => shareUrl(results, name), [results, name]);
  const clean = sanitiseName(name);

  const copyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard access can be refused; showing the URL is a fine fallback.
      window.prompt('Copy this link', url);
    }
  }, [url]);

  return (
    <section className="stack">
      <h2>Explain this to someone else</h2>
      <p className="muted">
        This link opens a page written for whoever you send it to: what you confuse, what you
        actually see, and straight answers to the questions people always ask.
      </p>

      <div className="share">
        <label className="share__field">
          <span className="faint">Your name, so the page can say who it is about (optional)</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Tomas"
            maxLength={24}
            autoComplete="given-name"
          />
        </label>

        <p className="share__preview faint">
          They will read: &ldquo;<strong>{clean || 'They'}</strong>{' '}
          {clean ? 'has' : 'have'} {results.assessment.name || 'typical colour vision'}&rdquo;, then
          the answers to the usual questions.
        </p>

        <div className="row">
          <button type="button" className="btn btn--primary" onClick={copyLink}>
            {copied ? 'Link copied' : 'Copy the link'}
          </button>
          <a className="btn btn--ghost" href={url} target="_blank" rel="noreferrer">
            Preview it
          </a>
        </div>

        <p className="faint" aria-live="polite">
          {copied ? 'Copied to your clipboard.' : '\u00a0'}
        </p>
      </div>
    </section>
  );
}
