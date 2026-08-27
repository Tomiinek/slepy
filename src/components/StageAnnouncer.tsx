/**
 * Moves focus and announces when the app changes phase.
 *
 * This is the accessibility problem that single-page apps almost always get
 * wrong, and it is worse here than usual. The whole test is a sequence of full
 * screen replacements with no page loads, so a screen reader is never told that
 * anything happened, and keyboard focus stays on a button that no longer exists
 * -- which sends focus back to the top of the document, silently.
 *
 * Two things fix it. Focus moves to the new screen's container, which is given
 * `tabIndex={-1}` so it can receive focus without becoming a tab stop. And a
 * live region announces the stage, because the stimulus screens are mostly
 * canvas and there is little for a reader to pick up on its own.
 *
 * The document title is updated too. That is what surfaces in window switchers
 * and in the tab list, and it is a cheap way to keep orientation.
 */
import { useEffect, useRef } from 'react';
import type { Phase } from '../session/types';

const ANNOUNCEMENT: Record<Phase, string> = {
  intro: 'Welcome. Introduction and instructions.',
  displayCheck: 'Display check. Confirm your screen is set up correctly before starting.',
  plates: 'Stage 1 of 4: hidden figures. Read the number in the dots.',
  thresholdsIntro: 'Stage 2 of 4 is about to begin: colour sensitivity.',
  thresholds: 'Stage 2 of 4: colour sensitivity. Say which side the gap is on.',
  luminanceIntro: 'Stage 3 of 4 is about to begin: brightness match.',
  luminance: 'Stage 3 of 4: brightness match. Match the red square to the grey one.',
  arrangementIntro: 'Stage 4 of 4 is about to begin: colour ordering.',
  arrangement: 'Stage 4 of 4: colour ordering. Arrange the swatches into a smooth sequence.',
  results: 'Your results are ready.',
};

const TITLE: Record<Phase, string> = {
  intro: 'Colour vision test',
  displayCheck: 'Display check',
  plates: 'Stage 1 of 4 \u2014 hidden figures',
  thresholdsIntro: 'Stage 2 of 4 \u2014 colour sensitivity',
  thresholds: 'Stage 2 of 4 \u2014 colour sensitivity',
  luminanceIntro: 'Stage 3 of 4 \u2014 brightness match',
  luminance: 'Stage 3 of 4 \u2014 brightness match',
  arrangementIntro: 'Stage 4 of 4 \u2014 colour ordering',
  arrangement: 'Stage 4 of 4 \u2014 colour ordering',
  results: 'Your results',
};

export function useStageAnnouncement(phase: Phase, target: React.RefObject<HTMLElement>) {
  // Skips the very first render: moving focus before the user has interacted
  // steals it from the address bar and scrolls the page unexpectedly.
  const mounted = useRef(false);

  useEffect(() => {
    document.title = `${TITLE[phase]} \u00b7 Colour vision`;

    if (!mounted.current) {
      mounted.current = true;
      return;
    }

    target.current?.focus();
    // Each screen is a fresh scroll context; without this, entering the report
    // from the arrangement stage lands halfway down it.
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [phase, target]);
}

export function StageAnnouncer({ phase }: { phase: Phase }) {
  return (
    <div role="status" aria-live="polite" className="visually-hidden">
      {ANNOUNCEMENT[phase]}
    </div>
  );
}
