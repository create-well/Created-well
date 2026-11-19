// ── Follow-Up Owed computation (Phase 3, packet M §2.3) ────────────────────
// Membership is computed, never filed (the depanty shape): a person
// is owed a follow-up when they have a Next Invitation date filed OR
// at least one open linked Follow-up Move. Leaving the queue is
// computed the same way. A Move is open unless its status is done or
// dropped. Do Not Contact rows never enter the queue (packet M §7):
// a Next Invitation filed on such a row is a data contradiction for
// the build packet, never a task on this surface.

import type { Station, Task } from '../app/components/api';
import { isDoNotContact } from './peopleConsent.ts';

export type FollowUpTask = Pick<Task, 'title' | 'person' | 'due_date' | 'status'>;

export interface FollowUpOwedEntry {
  person: Station;
  /** Open Follow-up Moves resolved against the tasks payload. */
  moves: FollowUpTask[];
  /** Relation targets with no matching row in the tasks payload. */
  unresolvedMoveCount: number;
  nextInvitation?: string;
}

const OPEN_STATUSES = new Set(['todo', 'in_progress', 'blocked']);

export function isOpenMove(task: Pick<Task, 'status'>): boolean {
  return OPEN_STATUSES.has(task.status);
}

/**
 * The queue, computed from the people and tasks slices. Relation
 * targets join to tasks on the MOVES Notion page id
 * (Task.notionPageId), the id space getRelationIds returns.
 */
export function followUpOwedQueue(
  people: Station[],
  tasks: Task[],
): FollowUpOwedEntry[] {
  const byPageId = new Map<string, Task>();
  for (const t of tasks) {
    if (t.notionPageId) byPageId.set(t.notionPageId, t);
  }

  const entries: FollowUpOwedEntry[] = [];
  for (const person of people) {
    if (isDoNotContact(person)) continue;

    const moves: FollowUpTask[] = [];
    let unresolvedMoveCount = 0;
    for (const moveId of person.followUpMoveIds ?? []) {
      const task = byPageId.get(moveId);
      if (!task) {
        unresolvedMoveCount += 1;
      } else if (isOpenMove(task)) {
        moves.push(task);
      }
    }

    const nextInvitation = person.nextInvitation || undefined;
    if (nextInvitation || moves.length > 0 || unresolvedMoveCount > 0) {
      entries.push({ person, moves, unresolvedMoveCount, nextInvitation });
    }
  }

  entries.sort((a, b) => a.person.name.localeCompare(b.person.name));
  return entries;
}
