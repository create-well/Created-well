import React, { useEffect } from 'react';
import {
  SOURCES,
  TITLE_PROP,
  dateVal,
  formatDateVal,
  isGeyser,
  relIds,
  rowIndex,
  titleOf,
} from '../lib/data';
import { useSelection } from '../lib/selection';
import { Chip, GeyserMark, RelationChips, SourceLine } from './ui';

function isEmptyValue(v: any): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === 'object') {
    if ('start' in v) return !v.start;
    if ('count' in v) return v.count === 0;
  }
  return false;
}

function DetailValue({ source, propName, value }: { source: string; propName: string; value: any }) {
  const meta = SOURCES[source]?.properties.find((p) => p.name === propName);
  const type = meta?.type || '';

  if (type === 'relation') {
    const ids = relIds({ id: '', props: { [propName]: value } } as any, propName);
    return <RelationChips ids={ids} />;
  }
  if (type === 'date') {
    const dv = dateVal({ id: '', props: { [propName]: value } } as any, propName);
    return <span>{formatDateVal(dv) ?? 'Not set in Notion'}</span>;
  }
  if (type === 'checkbox') {
    return <span>{value === true ? 'Yes ✓' : 'No'}</span>;
  }
  if (type === 'multi_select' && Array.isArray(value)) {
    return (
      <span className="chip-row">
        {value.map((v: string) => (
          <Chip key={v} label={v} />
        ))}
      </span>
    );
  }
  if (type === 'url' && typeof value === 'string') {
    return (
      <a href={value} target="_blank" rel="noreferrer">
        {value} ↗
      </a>
    );
  }
  if (typeof value === 'boolean') return <span>{value ? 'Yes' : 'No'}</span>;
  if (typeof value === 'number') return <span>{value}</span>;
  if (typeof value === 'string') return <span className="detail-text">{value}</span>;
  if (Array.isArray(value)) return <span>{value.map((x) => String(x)).join(', ')}</span>;
  if (value && typeof value === 'object') {
    if ('count' in value) return <span>{value.count}</span>;
    return <span>{JSON.stringify(value)}</span>;
  }
  return <span>{String(value)}</span>;
}

export function RowDetail() {
  const { selected, clear } = useSelection();

  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') clear();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, clear]);

  if (!selected) return null;
  const hit = rowIndex.get(selected.id);
  if (!hit) return null;
  const { source, row } = hit;
  const data = SOURCES[source];
  const titleProp = TITLE_PROP[source] || 'Name';

  const entries = (data?.properties || [])
    .map((p) => ({ name: p.name, type: p.type, value: row.props[p.name] }))
    .filter((e) => e.name !== titleProp && !isEmptyValue(e.value));

  return (
    <aside className="detail-drawer" aria-label="Row detail">
      <div className="detail-head">
        <div>
          <p className="detail-source">{source}</p>
          <h2 className="detail-title">{titleOf(source, row)}</h2>
          {isGeyser(source, row) ? (
            <div className="chip-row">
              <GeyserMark />
            </div>
          ) : null}
        </div>
        <button type="button" className="detail-close" onClick={clear} aria-label="Close detail">
          ×
        </button>
      </div>
      {entries.length ? (
        <dl className="detail-list">
          {entries.map((e) => (
            <div key={e.name} className="detail-row">
              <dt>{e.name}</dt>
              <dd>
                <DetailValue source={source} propName={e.name} value={e.value} />
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="empty-state">No other fields are set on this row in Notion.</p>
      )}
      {row.url ? (
        <p className="detail-notion-link">
          <a href={row.url} target="_blank" rel="noreferrer">
            Open in Notion ↗
          </a>
        </p>
      ) : null}
      <SourceLine source={source} />
    </aside>
  );
}
