/**
 * Minimal boundary validation for KV-backed dashboard slices.
 *
 * The dashboard payload historically passed KV rows through on trust:
 * TypeScript types described the rows, but nothing checked the stored
 * values at runtime. A row with a wrong primitive in a load-bearing
 * field (a numeric `content`, a string `capacity`, an object `title`)
 * could reach a page and fail there, far from the bad data.
 *
 * The shape is deliberately permissive, for legacy data's sake:
 * - A row must be a plain record. Non-records are dropped.
 * - Fields are checked only when present and non-null. A merely
 *   incomplete legacy row survives untouched; a field holding a
 *   definite wrong primitive drops the row.
 * - `id`, when present, must be a non-empty string or a finite number;
 *   `created_at` / `updated_at`, when present, must be strings (never
 *   parsed — a non-ISO legacy string survives).
 * - Descriptive vocabularies are NOT enum-checked (they evolve and
 *   hold legacy values); only `decisions` enforces its urgency/status
 *   sets, because the write route already treats those as closed.
 * - Nothing is coerced and nothing is rewritten: valid rows pass
 *   through by reference, unknown fields survive, and the caller
 *   names the drop count in sourceErrors.
 */

export interface KvValidationResult {
  values: Record<string, unknown>[];
  dropped: number;
}

type Rule = {
  /** Fields that, when present and non-null, must be strings. */
  strings?: readonly string[];
  /** Fields that, when present and non-null, must be finite numbers. */
  numbers?: readonly string[];
  /** Fields that, when present and non-null, must be booleans. */
  booleans?: readonly string[];
  /** Fields that, when present and non-null, must be arrays of strings. */
  stringArrays?: readonly string[];
  /** Fields that must hold one of the listed values when present. */
  enums?: Readonly<Record<string, readonly string[]>>;
};

const RULES: Readonly<Record<string, Rule>> = {
  cr8w_messages: { strings: ['author', 'content', 'reaction'], booleans: ['edited'] },
  cr8w_braindumps: { strings: ['author', 'content', 'tags', 'drive_link'] },
  cr8w_announcements: { strings: ['text', 'priority'], numbers: ['active'] },
  cr8w_forum_replies: { strings: ['author', 'content'] },
  cr8w_workshops: {
    strings: ['title', 'description', 'facilitator', 'date', 'location', 'status', 'googleDocLink'],
    numbers: ['capacity', 'participants'],
    stringArrays: ['tags'],
  },
  cr8w_workshop_programs: {
    strings: ['seriesName', 'description', 'targetAudience', 'facilitator'],
    stringArrays: ['learningObjectives', 'materialsNeeded'],
  },
  cr8w_workshop_resources: { strings: ['title', 'type', 'url', 'lastUpdated', 'author'] },
  cr8w_coflow_checkins: {
    strings: ['weekOf', 'author', 'locationSuggestion', 'mood', 'timePreference', 'notes'],
    booleans: ['confirmTime'],
    stringArrays: ['agendaItems'],
  },
  cr8w_well_notes: { strings: ['content'], numbers: ['landed'] },
  cr8w_calendar_events: { strings: ['title', 'start', 'end', 'location', 'description', 'creator', 'synced_at'] },
  cr8w_decisions: {
    strings: ['question', 'context', 'answer'],
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

function present(record: Record<string, unknown>, field: string): boolean {
  return field in record && record[field] !== null && record[field] !== undefined;
}

function isStringArray(value: unknown): boolean {
  return Array.isArray(value) && value.every((v) => typeof v === 'string');
}

function isValid(key: string, value: unknown): boolean {
  if (!isRecord(value)) return false;

  if (present(value, 'id')) {
    const id = value.id;
    if (!((typeof id === 'string' && id.length > 0)
      || (typeof id === 'number' && Number.isFinite(id)))) return false;
  }
  for (const field of ['created_at', 'updated_at']) {
    if (present(value, field) && typeof value[field] !== 'string') return false;
  }
  // Message tags are string-or-null by contract; reactions map emoji
  // to arrays of person keys. Both break consumers when mistyped.
  if (key === 'cr8w_messages') {
    if (present(value, 'tag') && typeof value.tag !== 'string') return false;
    if (present(value, 'reactions')) {
      const reactions = value.reactions;
      if (!isRecord(reactions) || !Object.values(reactions).every(isStringArray)) return false;
    }
  }
  // Forum replies address their parent by postId; consumers match it
  // with strict equality, so a wrong-typed postId must not cross.
  if (key === 'cr8w_forum_replies' && present(value, 'postId')) {
    const postId = value.postId;
    if (!((typeof postId === 'string' && postId.length > 0)
      || (typeof postId === 'number' && Number.isFinite(postId)))) return false;
  }
  // Session outline entries are rendered field by field.
  if (key === 'cr8w_workshop_programs' && present(value, 'sessionOutline')) {
    const outline = value.sessionOutline;
    if (!Array.isArray(outline) || !outline.every(isRecord)) return false;
  }

  const rule = RULES[key];
  if (!rule) return true;
  for (const field of rule.strings ?? []) {
    if (present(value, field) && typeof value[field] !== 'string') return false;
  }
  for (const field of rule.numbers ?? []) {
    if (present(value, field) && !(typeof value[field] === 'number' && Number.isFinite(value[field]))) return false;
  }
  for (const field of rule.booleans ?? []) {
    if (present(value, field) && typeof value[field] !== 'boolean') return false;
  }
  for (const field of rule.stringArrays ?? []) {
    if (present(value, field) && !isStringArray(value[field])) return false;
  }
  for (const [field, allowed] of Object.entries(rule.enums ?? {})) {
    if (present(value, field) && !allowed.includes(value[field] as string)) return false;
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
