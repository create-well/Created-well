// Keyboard model for a tab list (ARIA tabs pattern), extracted pure
// so the suite can pin it: Tab enters the list once (roving tabindex
// on the active tab), arrow keys move AND activate (automatic
// activation), Home/End jump, and Enter/Space activate the focused
// tab explicitly. The explicit activation matters: QA's audit found
// the Geyser view tabs did not switch on Enter/Space in their
// keyboard probe (finding 2026-11-02), so switching never relies on
// native button key activation alone.

export interface TabKeyResult {
  /** Index that should receive focus. */
  focusIndex: number;
  /** Index that should become the active tab. */
  activateIndex: number;
}

export function resolveTabKey(
  key: string,
  currentIndex: number,
  count: number,
): TabKeyResult | null {
  if (count <= 0 || currentIndex < 0 || currentIndex >= count) return null;
  switch (key) {
    case 'ArrowRight': {
      const next = (currentIndex + 1) % count;
      return { focusIndex: next, activateIndex: next };
    }
    case 'ArrowLeft': {
      const prev = (currentIndex - 1 + count) % count;
      return { focusIndex: prev, activateIndex: prev };
    }
    case 'Home':
      return { focusIndex: 0, activateIndex: 0 };
    case 'End':
      return { focusIndex: count - 1, activateIndex: count - 1 };
    case 'Enter':
    case ' ':
      return { focusIndex: currentIndex, activateIndex: currentIndex };
    default:
      return null;
  }
}
