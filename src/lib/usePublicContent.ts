import { useEffect, useState } from 'react';
import { fetchPublicContent, type ReleaseState } from './publicContent';

/** Loads the public release once per mount; see publicContent.ts. */
export function usePublicContent(): ReleaseState {
  const [state, setState] = useState<ReleaseState>({ kind: 'loading' });
  useEffect(() => {
    let live = true;
    fetchPublicContent().then((next) => {
      if (live) setState(next);
    });
    return () => {
      live = false;
    };
  }, []);
  return state;
}
