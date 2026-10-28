import React from 'react';
import PrototypeApp from '../../prototype/App';
import '../../prototype/prototype.css';

/**
 * Source-First Prototype, hosted home (G-08, Q-35 "ride the hosted
 * home", proposal adopted 2026-10-27): the prototype's React tree +
 * its 2026-10-26 snapshot, ported in as a lazy, session-gated route.
 * It renders REAL OS data, so it lives behind the same AuthGate as
 * every other surface — never as static public assets. The
 * prototype's styles are namespaced under .sfp-root (prototype.css);
 * its intake still stages to localStorage only, under its verbatim
 * note, exactly as built.
 */
export function SourceFirstPage() {
  return (
    <div className="sfp-root">
      <PrototypeApp />
    </div>
  );
}
