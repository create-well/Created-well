// Move form (AddTaskModal) interaction contract — pure logic, no DOM.
// Implements the state machine behind the Move QA acceptance contract
// (comparison record: intake-scoring/move-qa-handoff, 2026-11-02):
// validation in place, a pending phase that cannot be dismissed or
// double-submitted, definite-vs-unknown failure taxonomy, and a
// reconcile gate before retrying an unknown outcome. The component
// owns rendering; everything decidable lives here so the node suite
// can pin it headlessly.

export interface MoveFormValues {
  title: string;
  person: string;
  priority: 'high' | 'medium' | 'low';
  dueDate: string;
  source: string;
  category: string;
}

export function initialMoveFormValues(person: string): MoveFormValues {
  return { title: '', person, priority: 'medium', dueDate: '', source: '', category: '' };
}

export function isMoveFormDirty(values: MoveFormValues, initial: MoveFormValues): boolean {
  return (
    values.title !== initial.title ||
    values.person !== initial.person ||
    values.priority !== initial.priority ||
    values.dueDate !== initial.dueDate ||
    values.source !== initial.source ||
    values.category !== initial.category
  );
}

export interface MoveFormErrors {
  title?: string;
}

export function validateMoveForm(values: MoveFormValues): MoveFormErrors {
  if (!values.title.trim()) return { title: 'Give the Move a title.' };
  return {};
}

// The create path (api req()) throws Error("POST /tasks → 422: ...") for
// HTTP failures; network and timeout failures arrive as TypeError /
// AbortError with no status. A 4xx is a definite rejection: nothing was
// written, retry is safe. A 5xx or a status-less failure is UNKNOWN: the
// write may or may not have landed, so a blind retry could duplicate it.
export type CreateErrorKind = 'definite' | 'unknown';

export function classifyCreateError(err: unknown): CreateErrorKind {
  const message = err instanceof Error ? err.message : String(err ?? '');
  const match = message.match(/→\s*(\d{3})\b/);
  if (match) {
    const status = Number(match[1]);
    if (status >= 400 && status < 500) return 'definite';
  }
  return 'unknown';
}

export type MoveFormPhase =
  | 'editing'
  | 'submitting'
  | 'failed-definite'
  | 'failed-unknown'
  | 'done';

export interface MoveFormState {
  phase: MoveFormPhase;
}

export type MoveFormEvent =
  | { type: 'submit' }
  | { type: 'resolved' }
  | { type: 'rejected'; kind: CreateErrorKind }
  | { type: 'reconciled' }
  | { type: 'edit' };

export const initialMoveFormState: MoveFormState = { phase: 'editing' };

export function moveFormReducer(state: MoveFormState, event: MoveFormEvent): MoveFormState {
  switch (state.phase) {
    case 'editing':
      return event.type === 'submit' ? { phase: 'submitting' } : state;
    case 'submitting':
      if (event.type === 'resolved') return { phase: 'done' };
      if (event.type === 'rejected') {
        return { phase: event.kind === 'definite' ? 'failed-definite' : 'failed-unknown' };
      }
      // A second submit while one is in flight is a duplicate: ignore it.
      return state;
    case 'failed-definite':
      if (event.type === 'submit') return { phase: 'submitting' };
      if (event.type === 'edit') return { phase: 'editing' };
      return state;
    case 'failed-unknown':
      // Retry stays blocked until the board has been reconciled; editing
      // the values does not lift the block on its own.
      if (event.type === 'reconciled') return { phase: 'editing' };
      return state;
    case 'done':
      return state;
  }
}

export function canSubmitMoveForm(state: MoveFormState): boolean {
  return state.phase === 'editing' || state.phase === 'failed-definite';
}

// What a close request (Esc, close control, Cancel, overlay click) may do:
// a pending save blocks dismissal outright; a dirty form asks first; a
// clean form (or a finished one) just closes.
export type CloseIntent = 'close' | 'confirm-discard' | 'blocked-pending';

export function moveFormCloseIntent(state: MoveFormState, dirty: boolean): CloseIntent {
  if (state.phase === 'submitting') return 'blocked-pending';
  if (state.phase === 'done') return 'close';
  return dirty ? 'confirm-discard' : 'close';
}

// The create payload is built from the form values ONLY (ruling
// follow-through, QA fast-score catch 2026-11-02): the acting-person
// context seeds the initial values but must never override an
// explicit assignee choice at submit — a deliberate Unassigned
// submits an empty person. There is deliberately no context
// parameter here, so the override class cannot return.
export interface MoveCreatePayload {
  person: string;
  title: string;
  status: 'todo';
  priority: MoveFormValues['priority'];
  due_date: string;
  source: string;
  category: string;
}

export function buildMovePayload(values: MoveFormValues): MoveCreatePayload {
  return {
    person: values.person,
    title: values.title.trim(),
    status: 'todo',
    priority: values.priority,
    due_date: values.dueDate,
    source: values.source,
    category: values.category,
  };
}
