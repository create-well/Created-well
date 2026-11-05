/**
 * Minimal boundary validation for KV-backed dashboard slices.
 *
 * The dashboard payload historically passed KV rows through on trust:
 * TypeScript types described the rows, but nothing checked the stored
 * values at runtime. A malformed row could therefore reach a page and
 * fail there, far from the bad data. This module checks only the
 * fields each consumer treats as load-bearing. It does not attempt a
 * full schema for every optional field, and it never rewrites a valid
 * record: valid rows pass through by reference, malformed rows are
 * dropped, and the caller names the drop count in sourceErrors.
 */

export interface KvValidationResult {
  values: Record<string, unknown>[];
  dropped: number;
}

type Rule = {
  /** Fields that must be strings (empty is allowed unless noted). */
  strings: readonly string[];
  /** Fields that, when present, must be finite numbers. */
  numbers?: readonly string[];
  /** Fields that must hold one of the listed values. */
  enums?: Readonly<Record<string, readonly string[]>>;
};

const RULES: Readonly<Record<string, Rule>> = {
  cr8w_messages: { strings: ['author', 'content'] },
  cr8w_braindumps: { strings: ['author', 'content'] },
  cr8w_announcements: { strings: ['text'] },
  cr8w_forum_replies: { strings: ['author', 'content'] },
  cr8w_workshops: { strings: ['title', 'date'], numbers: ['capacity', 'participants'] },
  cr8w_workshop_programs: { strings: ['seriesName'] },
  cr8w_workshop_resources: { strings: ['title', 'url'] },
  cr8w_coflow_checkins: { strings: ['weekOf', 'author'] },
  cr8w_well_notes: { strings: ['content'] },
  cr8w_calendar_events: { strings: ['title', 'start', 'end'] },
  cr8w_decisions: {
    strings: ['question'],
    enums: {
      urgency: ['now', 'this-week', 'when-clear'],
      // Mirrors the D-1b server guard: 'deferred' is not a status.
      status: ['pending', 'decided'],
    },
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasUsableId(record: Record<string, unknown>): boolean {
  const id = record.id;
  return (typeof id === 'string' && id.length > 0)
    || (typeof id === 'number' && Number.isFinite(id));
}

function isValid(key: string, value: unknown): boolean {
  if (!isRecord(value) || !hasUsableId(value)) return false;
  // Forum replies address their parent post by id; it is load-bearing
  // in the same way the row's own id is.
  if (key === 'cr8w_forum_replies') {
    const postId = value.postId;
    if (!((typeof postId === 'string' && postId.length > 0)
      || (typeof postId === 'number' && Number.isFinite(postId)))) return false;
  }
  // Decision context is written by the server on create; when a stored
  // row carries it, it must be text. Absence stays valid for older rows.
  if (key === 'cr8w_decisions' && 'context' in value && typeof value.context !== 'string') return false;

  const rule = RULES[key];
  if (!rule) return true;
  for (const field of rule.strings) {
    if (typeof value[field] !== 'string') return false;
  }
  for (const field of rule.numbers ?? []) {
    if (field in value && !(typeof value[field] === 'number' && Number.isFinite(value[field]))) return false;
  }
  for (const [field, allowed] of Object.entries(rule.enums ?? {})) {
    if (!allowed.includes(value[field] as string)) return false;
  }
  return true;
}

export function validateKvSlice(key: string, values: readonly unknown[]): KvValidationResult {
  const valid: Record<string, unknown>[] = [];
  let dropped = 0;
  for (const value of values) {
    if (isValid(key, value)) valid.push(value as Record<string, unknown>);
    else dropped += 1;
  }
  return { values: valid, dropped };
}
