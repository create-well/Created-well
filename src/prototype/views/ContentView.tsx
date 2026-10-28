import React, { useMemo, useState } from 'react';
import {
  bool,
  dateVal,
  formatDateVal,
  isGeyser,
  optionsOf,
  source,
  str,
  titleOf,
} from '../lib/data';
import { useSelection } from '../lib/selection';
import { Chip, EmptyState, GeyserMark, Panel, RelationNames, RiseLine } from '../components/ui';

const ALL = '__all__';

export default function ContentView() {
  const rows = source('CONTENT').rows;
  const { selected } = useSelection();
  const [filter, setFilter] = useState<string>(ALL);

  const statusOptions = optionsOf('CONTENT', 'Status');
  const presentStatuses = useMemo(() => {
    const seen = new Set<string>();
    for (const r of rows) {
      const s = str(r, 'Status');
      if (s) seen.add(s);
    }
    const ordered = statusOptions.filter((o) => seen.has(o));
    for (const s of seen) if (!ordered.includes(s)) ordered.push(s);
    return ordered;
  }, [rows, statusOptions]);

  const visible = filter === ALL ? rows : rows.filter((r) => str(r, 'Status') === filter);

  return (
    <div>
      <div className="view-head">
        <h2 className="view-title">Content</h2>
        <RiseLine db="CONTENT" />
      </div>
      <div className="filter-row" role="group" aria-label="Filter by status">
        <button
          type="button"
          className={`chip chip-filter${filter === ALL ? ' chip-active' : ''}`}
          onClick={() => setFilter(ALL)}
        >
          All statuses
        </button>
        {presentStatuses.map((s) => (
          <button
            key={s}
            type="button"
            className={`chip chip-filter${filter === s ? ' chip-active' : ''}`}
            onClick={() => setFilter(filter === s ? ALL : s)}
          >
            {s}
          </button>
        ))}
      </div>

      <Panel title="All content" source="CONTENT">
        {visible.length ? (
          <ul className="row-list">
            {visible.map((r) => {
              const status = str(r, 'Status');
              const type = str(r, 'Content Type');
              const where = str(r, 'Where');
              const pub = formatDateVal(dateVal(r, 'Publish Date'));
              const isFinal = bool(r, 'Final?');
              const link = str(r, 'Link');
              const isSel = selected?.source === 'CONTENT' && selected?.id === r.id;
              return (
                <li key={r.id} id={`row-${r.id}`} className={`list-row${isSel ? ' row-selected' : ''}`}>
                  <div className="list-row-main">
                    <span className="list-row-title">{titleOf('CONTENT', r)}</span>
                    <span className="list-row-meta">{pub ? `Publish ${pub}` : 'No publish date'}</span>
                  </div>
                  <div className="chip-row">
                    {isGeyser('CONTENT', r) ? <GeyserMark /> : null}
                    {status ? <Chip label={status} /> : null}
                    {type ? <Chip label={type} /> : null}
                    {where ? <Chip label={where} /> : null}
                    <RelationNames ids={(r.props['Creator'] as string[]) || []} emptyLabel="" />
                    {isFinal ? <span className="final-mark">Final ✓</span> : null}
                    {link ? (
                      <a className="ext-link" href={link} target="_blank" rel="noreferrer">
                        Open ↗
                      </a>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState>No content rows with this status in Notion.</EmptyState>
        )}
      </Panel>
    </div>
  );
}
