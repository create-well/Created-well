import React, { useEffect } from 'react';
import { dateSortKey, dateVal, formatDateVal, relativeDay, source, str, titleOf, Row } from '../lib/data';
import { useSelection } from '../lib/selection';
import { Chip, EmptyState, Panel, RelationNames, RiseLine, scrollToRow } from '../components/ui';

/* Presentation label: Tasks. Source truth: these are MOVES rows, and the
   rise line in the header keeps that name visible. */

function byDue(a: Row, b: Row): number {
  const ka = dateSortKey(dateVal(a, 'Due'));
  const kb = dateSortKey(dateVal(b, 'Due'));
  if (!ka && !kb) return titleOf('MOVES', a).localeCompare(titleOf('MOVES', b));
  if (!ka) return 1;
  if (!kb) return -1;
  return ka.localeCompare(kb) || titleOf('MOVES', a).localeCompare(titleOf('MOVES', b));
}

export default function TasksView() {
  const rows = source('MOVES').rows;
  const { selected } = useSelection();

  useEffect(() => {
    if (selected?.source === 'MOVES') scrollToRow(selected.id);
  }, [selected]);

  const open = rows
    .filter((r) => str(r, 'Status') === 'Now' || str(r, 'Status') === 'Next')
    .sort(byDue);
  const closed = rows
    .filter((r) => str(r, 'Status') !== 'Now' && str(r, 'Status') !== 'Next')
    .sort(byDue);

  return (
    <div>
      <div className="view-head">
        <h2 className="view-title">Tasks</h2>
        <RiseLine db="MOVES" />
      </div>

      <Panel title="Open tasks" source="MOVES">
        {open.length ? (
          <ul className="row-list">
            {open.map((r) => {
              const status = str(r, 'Status');
              const type = str(r, 'Type');
              const due = dateVal(r, 'Due');
              const isSel = selected?.source === 'MOVES' && selected?.id === r.id;
              return (
                <li key={r.id} id={`row-${r.id}`} className={`list-row${isSel ? ' row-selected' : ''}`}>
                  <div className="list-row-main">
                    <span className="list-row-title">{titleOf('MOVES', r)}</span>
                    <span className="list-row-meta">
                      {due
                        ? `Due ${formatDateVal(due)}${relativeDay(due.start) ? ` · ${relativeDay(due.start)}` : ''}`
                        : 'No due date set'}
                    </span>
                  </div>
                  <div className="chip-row">
                    {status ? <Chip label={status} /> : null}
                    {type ? <Chip label={type} /> : null}
                    <RelationNames ids={(r.props['Owner'] as string[]) || []} emptyLabel="No owner set" />
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState>No tasks are marked Now or Next in Notion.</EmptyState>
        )}
      </Panel>

      {closed.length ? (
        <Panel title="Done and dropped" source="MOVES">
          <ul className="row-list">
            {closed.map((r) => {
              const status = str(r, 'Status');
              const type = str(r, 'Type');
              const isSel = selected?.source === 'MOVES' && selected?.id === r.id;
              return (
                <li key={r.id} id={`row-${r.id}`} className={`list-row${isSel ? ' row-selected' : ''}`}>
                  <div className="list-row-main">
                    <span className="list-row-title">{titleOf('MOVES', r)}</span>
                  </div>
                  <div className="chip-row">
                    {status ? <Chip label={status} /> : <Chip label="Status not set" />}
                    {type ? <Chip label={type} /> : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>
      ) : null}
    </div>
  );
}
