import React, { useEffect } from 'react';
import {
  dateSortKey,
  dateVal,
  daysFromToday,
  formatDateVal,
  formatTimestamp,
  isGeyser,
  pulledAt,
  relativeDay,
  source,
  str,
  syncState,
  titleOf,
  Row,
} from '../lib/data';
import { useSelection } from '../lib/selection';
import { Chip, EmptyState, GeyserMark, Panel, scrollToRow } from '../components/ui';

/* Home is the rim of the well: calm, task-shaped, drawn from the source.
   Sections lead with what needs doing, then what is starting, then what is
   new. No money figures appear here at all — the Money view carries those,
   with their coverage. The single freshness line at the bottom is the only
   freshness wording on this page. */

function flowStartKey(r: Row): string {
  const dv = dateVal(r, 'Date') || dateVal(r, 'Media Cutoff');
  return dateSortKey(dv);
}

export default function HomeView() {
  const { selected } = useSelection();

  useEffect(() => {
    if (
      selected &&
      (selected.source === 'MOVES' || selected.source === 'FLOWS' || selected.source === 'CONTENT')
    ) {
      scrollToRow(selected.id);
    }
  }, [selected]);

  /* Up next: open tasks (MOVES at Status Now or Next), soonest due first,
     undated last, at most five. Calm rows: title and status only. */
  const upNext = source('MOVES')
    .rows.filter((r) => str(r, 'Status') === 'Now' || str(r, 'Status') === 'Next')
    .sort((a, b) => {
      const ka = dateSortKey(dateVal(a, 'Due'));
      const kb = dateSortKey(dateVal(b, 'Due'));
      if (!ka && !kb) return titleOf('MOVES', a).localeCompare(titleOf('MOVES', b));
      if (!ka) return 1;
      if (!kb) return -1;
      return ka.localeCompare(kb) || titleOf('MOVES', a).localeCompare(titleOf('MOVES', b));
    })
    .slice(0, 5);

  /* Starting soon: the flows feed. FLOWS at Status Upcoming or Active,
     dated rows first by start, undated after by name, at most five. */
  const startingSoon = source('FLOWS')
    .rows.filter((r) => str(r, 'Status') === 'Upcoming' || str(r, 'Status') === 'Active')
    .sort((a, b) => {
      const ka = flowStartKey(a);
      const kb = flowStartKey(b);
      if (!ka && !kb) return titleOf('FLOWS', a).localeCompare(titleOf('FLOWS', b));
      if (!ka) return 1;
      if (!kb) return -1;
      return ka.localeCompare(kb) || titleOf('FLOWS', a).localeCompare(titleOf('FLOWS', b));
    })
    .slice(0, 5);

  /* New at the well: CONTENT whose Publish Date falls within the 21 days
     before the pull day, newest first, at most three. */
  const newAtWell = source('CONTENT')
    .rows.filter((r) => {
      const dv = dateVal(r, 'Publish Date');
      if (!dv || !dv.start) return false;
      const d = daysFromToday(dv.start);
      return d !== null && d <= 0 && d >= -21;
    })
    .sort((a, b) =>
      dateSortKey(dateVal(b, 'Publish Date')).localeCompare(dateSortKey(dateVal(a, 'Publish Date'))),
    )
    .slice(0, 3);

  /* The one freshness line, sourced from data/sync-state.json: when the
     water was drawn, and what the two sync legs last recorded. */
  const sheets = syncState.sheetsSync || {};
  const ledger = syncState.dashboardLedger || {};
  const freshnessText =
    'Drawn from Notion · last pull ' +
    formatTimestamp(pulledAt) +
    ' · Sheets last run ' +
    formatTimestamp(sheets.lastRunAt) +
    ', ' +
    String(sheets.conflicts ?? '—') +
    ' conflicts · ledger ' +
    String(ledger.okRuns ?? '—') +
    ' of ' +
    String(ledger.totalRuns ?? '—') +
    ' runs ok';

  return (
    <div>
      <h2 className="view-title">Home</h2>

      <Panel title="Up next" source="MOVES">
        {upNext.length ? (
          <ul className="row-list">
            {upNext.map((r) => {
              const status = str(r, 'Status');
              const isSel = selected?.source === 'MOVES' && selected?.id === r.id;
              return (
                <li key={r.id} id={'row-' + r.id} className={'list-row' + (isSel ? ' row-selected' : '')}>
                  <div className="list-row-main">
                    <span className="list-row-title">{titleOf('MOVES', r)}</span>
                  </div>
                  <div className="chip-row">{status ? <Chip label={status} /> : null}</div>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState>No tasks are marked Now or Next in Notion.</EmptyState>
        )}
      </Panel>

      <Panel title="Starting soon" source="FLOWS">
        {startingSoon.length ? (
          <ul className="row-list">
            {startingSoon.map((r) => {
              const dv = dateVal(r, 'Date') || dateVal(r, 'Media Cutoff');
              const series = str(r, 'Series');
              const status = str(r, 'Status');
              const isSel = selected?.source === 'FLOWS' && selected?.id === r.id;
              return (
                <li key={r.id} id={'row-' + r.id} className={'list-row' + (isSel ? ' row-selected' : '')}>
                  <div className="list-row-main">
                    <span className="list-row-title">{titleOf('FLOWS', r)}</span>
                    <span className="list-row-meta">
                      {dv
                        ? formatDateVal(dv) +
                          (dv.start && relativeDay(dv.start) ? ' · ' + relativeDay(dv.start) : '')
                        : 'No date set'}
                    </span>
                  </div>
                  <div className="chip-row">
                    {isGeyser('FLOWS', r) ? <GeyserMark /> : null}
                    {series ? <Chip label={series} /> : null}
                    {status ? <Chip label={status} /> : null}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState>No flows are Upcoming or Active in Notion.</EmptyState>
        )}
      </Panel>

      <Panel title="New at the well" source="CONTENT">
        {newAtWell.length ? (
          <ul className="row-list">
            {newAtWell.map((r) => {
              const dv = dateVal(r, 'Publish Date');
              const type = str(r, 'Content Type');
              const status = str(r, 'Status');
              const isSel = selected?.source === 'CONTENT' && selected?.id === r.id;
              return (
                <li key={r.id} id={'row-' + r.id} className={'list-row' + (isSel ? ' row-selected' : '')}>
                  <div className="list-row-main">
                    <span className="list-row-title">{titleOf('CONTENT', r)}</span>
                    <span className="list-row-meta">
                      {dv
                        ? 'Publish ' +
                          formatDateVal(dv) +
                          (dv.start && relativeDay(dv.start) ? ' · ' + relativeDay(dv.start) : '')
                        : 'No publish date'}
                    </span>
                  </div>
                  <div className="chip-row">
                    {isGeyser('CONTENT', r) ? <GeyserMark /> : null}
                    {type ? <Chip label={type} /> : null}
                    {status ? <Chip label={status} /> : null}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState>Nothing published in the 21 days before this pull.</EmptyState>
        )}
      </Panel>

      <p className="money-link-line">
        <a href="#/money">Money →</a>
      </p>

      <p className="freshness-line">{freshnessText}</p>
    </div>
  );
}
