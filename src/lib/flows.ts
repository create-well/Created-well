import type { CoFlowDate } from '../app/components/api';

export type FlowType =
  | 'Podyap'
  | 'Open Studio'
  | 'Book Club'
  | 'Workshop'
  | 'Pop-Up'
  | 'Surprise-ment'
  | 'Geyser'
  | 'Internal';

/**
 * Canonical flow type matching logic for Create Well OS.
 * Prefers the structured flowType property (from Notion Type select),
 * then falls back to known theme strings and aliases.
 */
export function matchesFlowType(f: CoFlowDate, type: FlowType | string): boolean {
  const target = type.toLowerCase();
  if (f.flowType && f.flowType.toLowerCase() === target) {
    return true;
  }
  const theme = (f.theme || '').toLowerCase();
  if (theme === target) return true;

  // Canonical aliases per CR8W Podyaps Production Bible & FLOWS schema
  if (target === 'podyap') {
    return ['podyap', 'yapcast', 'playdate'].includes(theme);
  }
  if (target === 'workshop') {
    return ['workshop', 'wellshop', 'expresshop', 'playshop'].includes(theme);
  }
  if (target === 'book club') {
    return ['book club', 'bookclub'].includes(theme);
  }
  if (target === 'open studio') {
    return ['open studio', 'openstudio'].includes(theme);
  }
  return false;
}

export function isPodyap(f: CoFlowDate): boolean {
  return matchesFlowType(f, 'Podyap');
}

export function isWorkshop(f: CoFlowDate): boolean {
  return matchesFlowType(f, 'Workshop');
}

export function isBookClub(f: CoFlowDate): boolean {
  return matchesFlowType(f, 'Book Club');
}

/**
 * SLO Create is the core monthly offering — its own recurring series,
 * never a workshop (model of record, 2026-11-14). The payload does
 * not project the FLOWS Series property (projecting it would be a
 * source change, outside the rename step), so series membership is
 * read from the row's Name — sessions are filed "SLO Create (11/18)"
 * — carried on title, with theme as its fallback, the same name
 * resolution flowTitle uses.
 */
export function isSloCreateSeries(f: CoFlowDate): boolean {
  const name = (f.title || f.theme || '').trim().toLowerCase();
  return /^slo create\b/.test(name);
}

export function isGroupEvent(f: CoFlowDate): boolean {
  return isWorkshop(f) || isBookClub(f);
}

export function isCommunityFlow(f: CoFlowDate): boolean {
  const theme = (f.theme || '').toLowerCase();
  const type = (f.flowType || '').toLowerCase();
  return (
    isPodyap(f) ||
    isWorkshop(f) ||
    isBookClub(f) ||
    ['open studio', 'openstudio', 'pop-up', 'surprise-ment', 'geyser'].includes(theme) ||
    ['open studio', 'pop-up', 'surprise-ment', 'geyser'].includes(type)
  );
}
