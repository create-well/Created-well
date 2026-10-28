import { useEffect, useState } from 'react';
import { fetchPublicContent, type ReleaseState } from './publicContent';

/**
 * Loads the public release once per mount; see publicContent.ts.
 * A 60-second tick re-renders consumers so the render-derived
 * freshness band (FLAG 1) re-derives on idle screens — a screen
 * left open never sits on Fresh past its window.
 */
export function usePublicContent(): ReleaseState {
  const [state, setState] = useState<ReleaseState>({ kind: 'loading' });
  const [, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    fetchPublicContent().then((next) => {
      if (live) setState(next);
    });
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => {
      live = false;
      clearInterval(id);
    };
  }, []);
  return state;
}
