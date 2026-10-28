import React, { useMemo } from 'react';
import { dateVal, formatDateVal, formatUSD, num, source, str, titleOf, Row } from '../lib/data';
import { useSelection } from '../lib/selection';
import { Chip, Panel, RiseLine } from '../components/ui';

export interface MoneySummary {
  total: number;
  withAmount: number;
  recorded: number;
  coverage: number; // 0..1
  recordedSum: number;
  byDirection: { direction: string; sum: number; rows: number }[];
  directionless: { sum: number; rows: number };
}

export function moneySummary(rows: Row[]): MoneySummary {
  const withAmountRows = rows.filter((r) => num(r, 'Amount') !== null);
  const recordedSum = withAmountRows.reduce((acc, r) => acc + (num(r, 'Amount') as number), 0);
  const dirMap = new Map<string, { sum: number; rows: number }>();
  let dlSum = 0;
  let dlRows = 0;
  for (const r of withAmountRows) {
    const amt = num(r, 'Amount') as number;
    const dir = str(r, 'Direction');
    if (dir) {
      const cur = dirMap.get(dir) || { sum: 0, rows: 0 };
      cur.sum += amt;
      cur.rows += 1;
      dirMap.set(dir, cur);
    } else {
      dlSum += amt;
      dlRows += 1;
    }
  }
  return {
    total: rows.length,
    withAmount: withAmountRows.length,
    recorded: withAmountRows.length,
    coverage: rows.length ? withAmountRows.length / rows.length : 0,
    recordedSum,
    byDirection: Array.from(dirMap.entries()).map(([direction, v]) => ({ direction, ...v })),
    directionless: { sum: dlSum, rows: dlRows },
  };
}

/** Coverage-honest money summary. Never shows a total without its coverage. */
export function MoneySummaryStrip() {
  const rows = source('MONEY').rows;
  const s = useMemo(() => moneySummary(rows), [rows]);
  const partial = s.coverage < 1;
  return (
    <div>
      <p className="coverage-line">
        Amounts recorded on {s.withAmount} of {s.total} rows. Totals below cover recorded
        amounts only.
      </p>
      <div className="money-strip">
        <div className="money-figure">
          <span className="money-figure-label">
            Recorded total{partial ? ' (partial)' : ''}
          </span>
          <span className="money-figure-value">{formatUSD(s.recordedSum)}</span>
          <span className="money-figure-note">
            from {s.recorded} of {s.total} rows
          </span>
        </div>
        {s.byDirection.map((d) => (
          <div key={d.direction} className="money-figure">
            <span className="money-figure-label">
              {d.direction}
              {partial ? ' (partial)' : ''}
            </span>
            <span className="money-figure-value">{formatUSD(d.sum)}</span>
            <span className="money-figure-note">
              {d.rows} row{d.rows === 1 ? '' : 's'}
            </span>
          </div>
        ))}
        {s.directionless.rows > 0 ? (
          <div className="money-figure">
            <span className="money-figure-label">Direction not set (partial)</span>
            <span className="money-figure-value">{formatUSD(s.directionless.sum)}</span>
            <span className="money-figure-note">
              {s.directionless.rows} row{s.directionless.rows === 1 ? '' : 's'}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function MoneyView() {
  const rows = source('MONEY').rows;
  const { selected } = useSelection();
  return (
    <div>
      <div className="view-head">
        <h2 className="view-title">Money</h2>
        <RiseLine db="MONEY" />
      </div>
      <Panel title="Recorded amounts" source="MONEY">
        <MoneySummaryStrip />
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Stage</th>
                <th>Direction</th>
                <th className="num">Amount</th>
                <th>Actual date</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const amount = num(r, 'Amount');
                const stage = str(r, 'Stage');
                const direction = str(r, 'Direction');
                const actual = formatDateVal(dateVal(r, 'Actual'));
                const isSel = selected?.source === 'MONEY' && selected?.id === r.id;
                return (
                  <tr key={r.id} id={`row-${r.id}`} className={isSel ? 'row-selected' : undefined}>
                    <td className="cell-title">{titleOf('MONEY', r)}</td>
                    <td>{stage ? <Chip label={stage} /> : <span className="muted">Not set in Notion</span>}</td>
                    <td>
                      {direction ? <Chip label={direction} /> : <span className="muted">Direction not set</span>}
                    </td>
                    <td className="num">
                      {amount !== null ? formatUSD(amount) : <span className="muted">Amount not set</span>}
                    </td>
                    <td>{actual ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
