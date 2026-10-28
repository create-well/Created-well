import React from 'react';
import { formatTimestamp, pulledAt, rowIndex, SOURCES } from '../lib/data';
import { useSelection } from '../lib/selection';

export function SourceLine({ source }: { source: string }) {
  const s = SOURCES[source];
  const count = s ? s.rowCount : 0;
  return <p className="source-line">Source: Notion {source} · {count} rows</p>;
}

/**
 * The rise path, stated once per source view: where this screen's water
 * comes from, how it rises, and when it was drawn. `db` is the Notion
 * source name (MOVES stays MOVES here even where the UI label is Tasks).
 */
export function RiseLine({ db }: { db: string }) {
  return (
    <p className="rise-line">
      Notion · {db} → sync → this view · drawn {formatTimestamp(pulledAt)}
    </p>
  );
}

/**
 * Emergence marker. Rendered only where a row's date lands on the pull day
 * (see isGeyser in lib/data); if nothing earns it, it appears nowhere.
 */
export function GeyserMark() {
  return (
    <span className="chip geyser-chip" title="Emergence: this lands on the day the snapshot was drawn">
      ◆ Geyser
    </span>
  );
}

export function Chip({
  label,
  onClick,
  title,
}: {
  label: string;
  onClick?: () => void;
  title?: string;
}) {
  if (onClick) {
    return (
      <button type="button" className="chip chip-link" onClick={onClick} title={title}>
        {label}
      </button>
    );
  }
  return (
    <span className="chip" title={title}>
      {label}
    </span>
  );
}

/** A chip that jumps to a related row (resolving its title from the index). */
export function RelationChip({ id }: { id: string }) {
  const { jumpTo } = useSelection();
  const hit = rowIndex.get(id);
  if (!hit) {
    return <Chip label={`Row ${id.slice(0, 8)}… (not in snapshot)`} />;
  }
  return (
    <Chip
      label={`${hit.title}`}
      title={`${hit.source} — open`}
      onClick={() => jumpTo(hit.source, id)}
    />
  );
}

export function RelationChips({ ids }: { ids: string[] }) {
  if (!ids.length) return null;
  return (
    <span className="chip-row">
      {ids.map((id) => (
        <RelationChip key={id} id={id} />
      ))}
    </span>
  );
}

/** Plain-language names for a relation property's target ids (no jump). */
export function namesFor(ids: string[]): string[] {
  return ids.map((id) => {
    const hit = rowIndex.get(id);
    return hit ? hit.title : `Row ${id.slice(0, 8)}…`;
  });
}

/**
 * Renders relation names as jumping chips when the property has any ids,
 * otherwise the honest empty state.
 */
export function RelationNames({
  ids,
  emptyLabel = 'Not set in Notion',
}: {
  ids: string[];
  emptyLabel?: string;
}) {
  if (!ids.length) return emptyLabel ? <span className="muted">{emptyLabel}</span> : null;
  return <RelationChips ids={ids} />;
}

export function Panel({
  title,
  source,
  children,
  extra,
}: {
  title: string;
  source?: string;
  children: React.ReactNode;
  extra?: React.ReactNode;
}) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h3 className="panel-title">{title}</h3>
        {extra}
      </div>
      {children}
      {source ? <SourceLine source={source} /> : null}
    </section>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="empty-state">{children}</p>;
}

/** Scroll a freshly selected row into view (after render). */
export function scrollToRow(id: string) {
  window.setTimeout(() => {
    const el = document.getElementById(`row-${id}`);
    if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, 60);
}
