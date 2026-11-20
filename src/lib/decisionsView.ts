// Decision-queue derivations (D-1): ordering, partitioning, and the
// write shapes for the decisions resource. Defer keeps its settled
// meaning: the item stays pending and its urgency drops to
// 'when-clear' — it does not leave the queue.
import type { DecisionRecord, DecisionCreate } from '../app/components/api';

export const URGENCY_ORDER: Record<DecisionRecord['urgency'], number> = {
  'now': 0,
  'this-week': 1,
  'when-clear': 2,
};

/** Pending first by urgency (now, this week, when clear), newest first inside each band. */
export function sortPendingDecisions(records: DecisionRecord[]): DecisionRecord[] {
  return records
    .filter(d => d.status === 'pending')
    .sort((a, b) => {
      const byUrgency = URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency];
      if (byUrgency !== 0) return byUrgency;
      return (b.created_at || '').localeCompare(a.created_at || '');
    });
}

/** Decided items for the archive, most recently decided first. */
export function decidedDecisions(records: DecisionRecord[]): DecisionRecord[] {
  return records
    .filter(d => d.status === 'decided')
    .sort((a, b) => (b.decided_at || b.created_at || '').localeCompare(a.decided_at || a.created_at || ''));
}

// Two-queue split (packets C/F, adopted 2026-11-19): pending items
// wait in their owner's queue. Records filed before the owner field
// existed carry none; they derive to 'monny' — the program's owner
// of record — so every pending item is visible in exactly one of
// the two named queues, never a hidden third.
export type DecisionOwner = 'monny' | 'bingle';

export function decisionOwner(d: DecisionRecord): DecisionOwner {
  return d.owner === 'bingle' ? 'bingle' : 'monny';
}

/** The pending items waiting in one owner's queue, urgency order kept. */
export function waitingForOwner(records: DecisionRecord[], owner: DecisionOwner): DecisionRecord[] {
  return sortPendingDecisions(records).filter(d => decisionOwner(d) === owner);
}

export function buildDecisionCreate(values: {
  question: string;
  context: string;
  urgency: DecisionRecord['urgency'];
  owner?: DecisionOwner;
}): DecisionCreate {
  return {
    question: values.question,
    context: values.context,
    urgency: values.urgency,
    ...(values.owner ? { owner: values.owner } : {}),
  };
}

/** The decide write: status + the answer + when it was decided. */
export function buildDecideUpdate(answer: string, nowIso: string): Partial<DecisionRecord> {
  return { status: 'decided', answer, decided_at: nowIso };
}

/** The defer write: urgency only — status stays pending by design. */
export function buildDeferUpdate(): Partial<DecisionRecord> {
  return { urgency: 'when-clear' };
}
