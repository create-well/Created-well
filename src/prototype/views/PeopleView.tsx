import React, { useEffect } from 'react';
import { fillCount, relIds, source, str, strList, titleOf } from '../lib/data';
import { useSelection } from '../lib/selection';
import { Chip, Panel, RiseLine, scrollToRow } from '../components/ui';

const REL_COUNTS: { prop: string; target: string; label: string }[] = [
  { prop: 'Flows Held', target: 'FLOWS', label: 'Flows Held' },
  { prop: 'Moves Owned', target: 'MOVES', label: 'Moves Owned' },
  { prop: 'Content Created', target: 'CONTENT', label: 'Content Created' },
  { prop: 'Follow-up Moves', target: 'MOVES', label: 'Follow-up Moves' },
];

export default function PeopleView() {
  const data = source('PEOPLE');
  const rows = data.rows;
  const { selected, jumpTo } = useSelection();

  useEffect(() => {
    if (selected?.source === 'PEOPLE') scrollToRow(selected.id);
  }, [selected]);

  /* The banner's numbers are computed from the pull's fill counts, so the
     sentence stays true if the source changes. */
  const pathway = fillCount('PEOPLE', 'Pathway Stage');
  const bench = fillCount('PEOPLE', 'Bench Stage');
  const rolesSet = fillCount('PEOPLE', 'Roles');

  return (
    <div>
      <div className="view-head">
        <h2 className="view-title">People</h2>
        <RiseLine db="PEOPLE" />
      </div>
      <div className="notice-banner" role="note">
        In Notion, Pathway Stage and Bench Stage are empty for all {rows.length} people
        {pathway !== null && bench !== null
          ? ` (${pathway} and ${bench} filled, respectively)`
          : ''}
        , and Roles is set for {rolesSet ?? 0}. These cards show what the source actually
        holds.
      </div>
      <Panel title="People" source="PEOPLE">
        <div className="people-grid">
          {rows.map((r) => {
            const status = str(r, 'Status');
            const roles = strList(r, 'Roles');
            const description = str(r, 'Description');
            const isSel = selected?.source === 'PEOPLE' && selected?.id === r.id;
            return (
              <article
                key={r.id}
                id={`row-${r.id}`}
                className={`person-card${isSel ? ' row-selected' : ''}`}
              >
                <h4 className="person-name">{titleOf('PEOPLE', r)}</h4>
                <div className="chip-row">
                  {status ? <Chip label={status} /> : null}
                  {roles.map((role) => (
                    <Chip key={role} label={role} />
                  ))}
                </div>
                {description ? (
                  <p className="clamp-3 body-text">{description}</p>
                ) : (
                  <p className="muted">No description in Notion</p>
                )}
                <div className="chip-row">
                  {REL_COUNTS.map(({ prop, target, label }) => {
                    const ids = relIds(r, prop);
                    if (!ids.length) return null;
                    return (
                      <button
                        key={prop}
                        type="button"
                        className="chip chip-link"
                        onClick={() => jumpTo(target, ids[0])}
                        title={`Open first linked row in ${target}`}
                      >
                        {label} {ids.length}
                      </button>
                    );
                  })}
                </div>
              </article>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}
