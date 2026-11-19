import React, { useState } from 'react';
import { Link } from 'react-router';
import { useDashboard } from '../../../contexts/DashboardContext';
import { formatDate } from '../data';
import { flowHeading } from '../../../lib/flows';
import { lastGatheringFor } from '../../../lib/people';

// ── Everyone (Phase 3 leg L2, packet M §2.1) ────────────────────────────────
// Every PEOPLE record, one row each, sorted by name. A row carries only
// what the record files: the stage word when the Pathway Stage is one
// of the five named stages (any other status — including the legacy
// 'active' — renders no stage line), roles when filed, the last
// gathering when one resolves, and the consent line only when the
// record carries the consentCaptured field at all. No contact,
// message, schedule, or invite actions live here — this leg is
// read-only. The panel renders only on a settled payload (PeoplePage's
// ViewShell gates that), so zero stations is the honest zero: "No
// people filed yet."

// The five Pathway Stage words, verbatim (packet M §2.1). Anything
// outside this list renders no stage line.
const PATHWAY_STAGES = ['Curious', 'Exploring', 'Rooted', 'Dormant', 'Do Not Contact'] as const;

const bodyText: React.CSSProperties = {
  fontFamily: 'var(--font-body)', fontSize: '0.82rem',
  color: 'var(--text-secondary, #6B5F7A)', lineHeight: 1.55,
};

export function EveryoneList() {
  const { data } = useDashboard();
  const [query, setQuery] = useState('');
  const people = data.stations ?? [];
  const q = query.trim().toLowerCase();
  const rows = people
    .filter((p) => !q || p.name.toLowerCase().includes(q))
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{
        fontFamily: 'var(--font-display)', fontSize: '1.05rem', fontWeight: 700,
        color: 'var(--cr8w-text, #2D2438)',
      }}>
        Everyone · {people.length}
      </div>

      {people.length > 0 && (
        <input
          type="search"
          aria-label="Search people by name"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name"
          style={{
            padding: '8px 12px', borderRadius: 10, border: '1px solid rgba(0,0,0,0.12)',
            background: '#fff', fontFamily: 'var(--font-body)', fontSize: '0.82rem',
            color: 'var(--cr8w-text, #2D2438)', maxWidth: 320,
          }}
        />
      )}

      {people.length === 0 && (
        <div style={{ ...bodyText, color: 'var(--text-muted, #6B5F7A)' }}>
          No people filed yet.
        </div>
      )}

      {rows.map((person) => {
        const last = lastGatheringFor(person.notionPageId, data.coFlowDates);
        return (
          <section
            key={person.id}
            style={{
              background: '#fff', border: '1px solid rgba(0,0,0,0.07)', borderRadius: 12,
              padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6,
            }}
          >
            <Link
              to={`/people/${person.id}`}
              style={{
                fontFamily: 'var(--font-display)', fontSize: '0.95rem', fontWeight: 600,
                color: 'var(--cr8w-text, #2D2438)', textDecoration: 'none',
              }}
            >
              {person.name}
            </Link>

            {(PATHWAY_STAGES as readonly string[]).includes(person.status) && (
              <div style={bodyText}>{person.status}</div>
            )}

            {person.description && <div style={bodyText}>{person.description}</div>}

            {last && (
              <div style={bodyText}>
                Last gathering: {flowHeading(last)}, {formatDate(last.date)}
              </div>
            )}

            {person.consentCaptured !== undefined && (
              <div style={bodyText}>
                {person.consentCaptured ? 'Consent captured' : 'Consent not captured'}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
