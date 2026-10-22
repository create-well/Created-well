import React, { useMemo, useState } from 'react';
import type { Station } from './api';

interface CarePeopleRegistryProps {
  people: Station[];
  syncStatus: 'loading' | 'fresh' | 'stale' | 'failed';
}

const STAGE_COLORS: Record<string, { background: string; color: string }> = {
  active: { background: 'rgba(48, 209, 88, 0.12)', color: '#18733a' },
  waiting: { background: 'rgba(255, 159, 10, 0.14)', color: '#8a5100' },
  paused: { background: 'rgba(120, 113, 108, 0.14)', color: '#625b55' },
};

function stageFor(person: Station): keyof typeof STAGE_COLORS {
  const status = person.status.toLowerCase();
  if (status.includes('pause') || status.includes('hold')) return 'paused';
  if (status.includes('wait') || status.includes('next')) return 'waiting';
  return 'active';
}

function stageLabel(stage: keyof typeof STAGE_COLORS): string {
  return stage === 'active' ? 'In motion' : stage === 'waiting' ? 'Needs invitation' : 'Resting';
}

export function CarePeopleRegistry({ people, syncStatus }: CarePeopleRegistryProps) {
  const [query, setQuery] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const filteredPeople = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return people;
    return people.filter(person =>
      [person.name, person.owner, person.status, person.description]
        .some(value => value.toLowerCase().includes(normalized)),
    );
  }, [people, query]);

  return (
    <section
      aria-labelledby="care-people-registry-title"
      style={{
        background: 'var(--bg-card, #fff)',
        border: '1px solid var(--border-soft, #e0dbd5)',
        borderRadius: 'var(--cr-radius-md, 12px)',
        padding: 20,
        marginBottom: 20,
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span aria-hidden="true" style={{ fontSize: 20 }}>◌</span>
            <h2 id="care-people-registry-title" style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: '1.2rem', color: 'var(--text-primary)' }}>
              People & Pathways
            </h2>
          </div>
          <p style={{ margin: '6px 0 0', maxWidth: 560, color: 'var(--text-muted)', fontFamily: 'var(--font-body)', fontSize: '0.8rem', lineHeight: 1.5 }}>
            A gentle operational view of who is in motion, who needs an invitation, and who is resting. This prototype is read-only while the pathway data contract is being shaped.
          </p>
        </div>
        <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-label)', fontSize: '0.68rem' }}>
          {syncStatus === 'stale' ? 'Showing fallback data' : syncStatus === 'failed' ? 'Sync unavailable' : `${people.length} people in view`}
        </span>
      </div>

      <label style={{ display: 'block', marginTop: 16, color: 'var(--text-muted)', fontFamily: 'var(--font-label)', fontSize: '0.7rem' }}>
        Find a person or pathway
        <input
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="Search people, owners, or status"
          aria-label="Find a person or pathway"
          style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 6, padding: '9px 11px', border: '1px solid var(--border-soft, #e0dbd5)', borderRadius: 8, background: 'var(--bg-elevated, #faf7f5)', color: 'var(--text-primary)', font: 'inherit' }}
        />
      </label>

      {filteredPeople.length === 0 ? (
        <p style={{ margin: '18px 0 0', color: 'var(--text-muted)', fontFamily: 'var(--font-body)', fontSize: '0.8rem' }}>
          No people match this search yet.
        </p>
      ) : (
        <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
          {filteredPeople.map(person => {
            const stage = stageFor(person);
            const colors = STAGE_COLORS[stage];
            const expanded = expandedId === person.id;
            return (
              <article key={person.id} style={{ border: '1px solid var(--border-soft, #e0dbd5)', borderRadius: 10, padding: '12px 14px', background: 'var(--bg-elevated, #faf7f5)' }}>
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : person.id)}
                  aria-expanded={expanded}
                  style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', gap: 12, border: 0, padding: 0, background: 'transparent', color: 'inherit', cursor: 'pointer', textAlign: 'left' }}
                >
                  <span style={{ minWidth: 0 }}>
                    <strong style={{ display: 'block', color: 'var(--text-primary)', fontFamily: 'var(--font-label)', fontSize: '0.86rem' }}>{person.name}</strong>
                    <span style={{ display: 'block', marginTop: 3, color: 'var(--text-muted)', fontFamily: 'var(--font-body)', fontSize: '0.74rem' }}>{person.owner || 'No steward assigned'}</span>
                  </span>
                  <span style={{ flexShrink: 0, padding: '4px 8px', borderRadius: 999, background: colors.background, color: colors.color, fontFamily: 'var(--font-label)', fontSize: '0.66rem', fontWeight: 700 }}>{stageLabel(stage)}</span>
                </button>
                {expanded && (
                  <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border-soft, #e0dbd5)', color: 'var(--text-muted)', fontFamily: 'var(--font-body)', fontSize: '0.76rem', lineHeight: 1.5 }}>
                    <div><strong>Status:</strong> {person.status || 'Not set'}</div>
                    <div><strong>Pathway note:</strong> {person.description || 'No pathway note has been added yet.'}</div>
                    <div style={{ marginTop: 8, color: 'var(--text-muted)', fontSize: '0.68rem' }}>
                      {person.notionPageId ? 'Notion-backed record' : 'Local record'} · Read-only prototype
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
