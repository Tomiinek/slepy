import { useEffect, useState } from 'react';

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia(query).matches
      : false,
  );

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const list = window.matchMedia(query);
    const update = () => setMatches(list.matches);
    update();
    list.addEventListener('change', update);
    return () => list.removeEventListener('change', update);
  }, [query]);

  return matches;
}

export function usePrefersReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}

/** Viewport width, used to warn when a stimulus cannot be shown large enough. */
export function useViewportWidth(): number {
  return useViewport().width;
}

/**
 * Both viewport axes, because a stimulus has to fit between the instruction
 * above it and the controls below it, not just inside the window's width. A wide
 * but short window is the case that gets this wrong.
 */
export function useViewport(): { readonly width: number; readonly height: number } {
  const [size, setSize] = useState(() =>
    typeof window === 'undefined'
      ? { width: 1200, height: 900 }
      : { width: window.innerWidth, height: window.innerHeight },
  );

  useEffect(() => {
    const update = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return size;
}

/**
 * Side length for a round dot stimulus.
 *
 * Width alone is not enough. Each stage spends a fixed slot above and below the
 * stimulus on its instruction text and another row on the answer buttons, so a
 * wide but short window has far less room than its width suggests.
 *
 * The floor is held at 280px even when that does not fit. Shrinking a
 * pseudoisochromatic plate past that point changes what it measures, so it is
 * better to let the window scroll than to quietly weaken the test.
 */
export function useStimulusSize(): number {
  const { width, height } = useViewport();
  /** Two four-line text slots, the button row, the gaps and the progress bar. */
  const CHROME = 380;
  return Math.max(280, Math.min(520, width - 80, height - CHROME));
}
