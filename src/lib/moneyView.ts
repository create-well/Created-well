// Money view derivations (M-1): signing, ledger ordering, totals, and
// the needs-category queue. Direction is the field of record for the
// sign: 'In' is income, 'Out' is expense. A record with no direction is
// never guessed at — it displays unsigned and untagged, and it is
// excluded from the net (an unsigned amount cannot be added honestly).
import type { MoneyRecord } from '../app/components/api';

export type MoneyDirection = 'in' | 'out' | null;

export function moneyDirection(record: Pick<MoneyRecord, 'direction'>): MoneyDirection {
  if (record.direction === 'In') return 'in';
  if (record.direction === 'Out') return 'out';
  return null;
}

/** Signed amount for display and totals; null when the record is undirected. */
export function signedAmount(record: Pick<MoneyRecord, 'direction' | 'amount'>): number | null {
  const d = moneyDirection(record);
  if (d === null) return null;
  return d === 'in' ? record.amount : -record.amount;
}

/**
 * The whole ledger, most recent first: by date (the Actual/Expected
 * date the normalizer projects), falling back to creation time for
 * undated records; ties break by creation time, newest first.
 */
export function ledgerOrder(records: MoneyRecord[]): MoneyRecord[] {
  const when = (r: MoneyRecord) => r.date || r.created_at || '';
  return [...records]
    .sort((a, b) => {
      const byWhen = when(b).localeCompare(when(a));
      if (byWhen !== 0) return byWhen;
      return (b.created_at || '').localeCompare(a.created_at || '');
    });
}

/** The first `limit` records of the ledger, newest first. */
export function recentActivity(records: MoneyRecord[], limit = 5): MoneyRecord[] {
  return ledgerOrder(records).slice(0, limit);
}

export interface MoneyTotals {
  income: number;
  expenses: number;
  /** income − expenses over direction-known records only. */
  net: number;
  /** Records with an amount but no direction: counted, never signed. */
  undirected: number;
}

export function moneyTotals(records: MoneyRecord[]): MoneyTotals {
  let income = 0;
  let expenses = 0;
  let undirected = 0;
  for (const r of records) {
    const d = moneyDirection(r);
    if (d === 'in') income += r.amount;
    else if (d === 'out') expenses += r.amount;
    else undirected += 1;
  }
  return { income, expenses, net: income - expenses, undirected };
}

/**
 * The Needs Category queue: the records the workbook feed marks
 * 'Needs category', in ledger order. Categorization happens in the
 * workbook; this derivation only reads.
 */
export function needsCategoryQueue(records: MoneyRecord[]): MoneyRecord[] {
  return ledgerOrder(records).filter(r => r.kind === 'Needs category');
}
