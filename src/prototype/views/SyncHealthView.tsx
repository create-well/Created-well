import React from 'react';
import { formatTimestamp, syncState } from '../lib/data';
import { Panel, RiseLine } from '../components/ui';

export default function SyncHealthView() {
  const ledger = syncState.dashboardLedger || {};
  const sheets = syncState.sheetsSync || {};
  const perSource = Object.entries(ledger.perSource || {}) as [string, any][];
  const perDb = Object.entries(sheets.perDb || {}) as [string, any][];
  const notConnected: any[] = Array.isArray(syncState.notConnected) ? syncState.notConnected : [];

  return (
    <div>
      <div className="view-head">
        <h2 className="view-title">Sync Health</h2>
        <RiseLine db="SYNC LEDGER" />
      </div>
      <p className="view-sub">
        Freshness here is only what the two ledgers record. The dashboard live-sync ledger and
        the Sheets two-way sync are separate systems and are reported separately. What returns
        — intake, surveys, feedback — flows back down the same channel; these ledgers record
        the rising leg.
      </p>

      <Panel title="Dashboard live-sync — Notion SYNC LEDGER" source="SYNC LEDGER">
        <p className="coverage-line">
          {ledger.totalRuns} runs recorded · {ledger.okRuns} ok · {ledger.failedRuns} failed ·
          window {formatTimestamp(ledger.windowStart)} → {formatTimestamp(ledger.windowEnd)}
        </p>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Source</th>
                <th className="num">Runs</th>
                <th>Last run started</th>
                <th className="num">Rows reported</th>
                <th>Run status</th>
              </tr>
            </thead>
            <tbody>
              {perSource.map(([name, v]) => (
                <tr key={name}>
                  <td className="cell-title">{name}</td>
                  <td className="num">{v.runs}</td>
                  <td>{formatTimestamp(v.started)}</td>
                  <td className="num">{v.rows}</td>
                  <td>{v.runStatus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {Array.isArray(ledger.notes) && ledger.notes.length ? (
          <ul className="callout-list">
            {ledger.notes.map((n: string, i: number) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        ) : null}
      </Panel>

      <Panel title="Sheets two-way sync — workbook">
        <p className="coverage-line">
          Workbook: {sheets.workbook} · last run {formatTimestamp(sheets.lastRunAt)} · conflicts:{' '}
          {sheets.conflicts}
        </p>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Database</th>
                <th className="num">Notion rows</th>
                <th className="num">Sheet rows</th>
                <th>Match</th>
              </tr>
            </thead>
            <tbody>
              {perDb.map(([name, v]) => (
                <tr key={name}>
                  <td className="cell-title">{name}</td>
                  <td className="num">{v.notionRows}</td>
                  <td className="num">{v.sheetRows}</td>
                  <td>{v.match ? 'Match ✓' : 'MISMATCH'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {Array.isArray(sheets.notes) && sheets.notes.length ? (
          <ul className="callout-list">
            {sheets.notes.map((n: string, i: number) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        ) : null}
      </Panel>

      <Panel title="Not connected">
        {notConnected.length ? (
          <div className="not-connected-grid">
            {notConnected.map((entry, i) => (
              <article key={i} className="not-connected-card">
                <h4>{entry.name}</h4>
                <p>{entry.state}</p>
              </article>
            ))}
          </div>
        ) : (
          <p className="empty-state">Nothing is recorded as not connected.</p>
        )}
      </Panel>
    </div>
  );
}
