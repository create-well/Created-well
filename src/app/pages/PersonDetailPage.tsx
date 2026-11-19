import React from 'react';
import { Link, useParams } from 'react-router';
import { useDashboard } from '../../contexts/DashboardContext';
import { TASK_ROLES, formatDate } from '../components/data';
import type { Station, Task } from '../components/api';
import { resolvePerson, gatheringsFor } from '../../lib/people';
import { isOpenMove } from '../../lib/followUps';
import { compareWorkListTasks } from '../../lib/flows';

// ── Person detail (Phase 3 leg L2, packet M §2.2) ───────────────────────────
// One person, everything attached on one page, in the Gathering detail
// pattern this phase copies: resolvePerson gates on a settled payload
// (never a false not-found while loading), the stale banner rides a
// found resolution, and sections render in a fixed order — header,
// consent, gatherings, follow-ups owed, notes. Read-only: no contact
// or scheduling actions live here (leg L2's ruling). Every line reads
// what the record files and nothing else: missing pieces read as
// themselves, never invented.

// The five Pathway Stage words, verbatim (packet M §2.1). Anything
// outside this list — including the legacy 'active' — renders no
// stage line.
const PATHWAY_STAGES: readonly string[] = ['Curious', 'Exploring', 'Rooted', 'Dormant', 'Do Not Contact'];

function SectionTitle({ children }: { children: string }) {
  return (
    <div style={{
      fontFamily: 'var(--font-label)', fontSize: '0.65rem', fontWeight: 700,
      color: 'var(--text-muted, #8A7060)', textTransform: 'uppercase',
      letterSpacing: '0.06em', marginBottom: 8,
    }}>{children}</div>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{
      background: '#fff', border: '1px solid rgba(0,0,0,0.07)', borderRadius: 12,
      padding: '14px 16px',
    }}>
      <SectionTitle>{title}</SectionTitle>
      {children}
    </section>
  );
}

const bodyText: React.CSSProperties = {
  fontFamily: 'var(--font-body)', fontSize: '0.82rem',
  color: 'var(--text-secondary, #6B5F7A)', lineHeight: 1.55,
};
const linkText: React.CSSProperties = {
  fontFamily: 'var(--font-label)', fontSize: '0.72rem', fontWeight: 700,
  color: 'var(--cr8w-primary-text, #466F64)', textDecoration: 'none',
};

function PersonDetail({ person }: { person: Station }) {
  const { data } = useDashboard();
  const gatherings = gatheringsFor(person.notionPageId, data.coFlowDates);

  // Follow-up Moves join on the MOVES Notion page id, the same id
  // space lib/followUps queues on: relation target → Task.notionPageId.
  // Only open Moves (never done/dropped) render; each row reads as
  // filed — a missing owner or date is itself, never dressed up.
  const tasksByPageId = new Map<string, (typeof data.tasks)[number]>();
  for (const t of data.tasks ?? []) {
    if (t.notionPageId) tasksByPageId.set(t.notionPageId, t);
  }
  const followUps = (person.followUpMoveIds ?? [])
    .map((moveId) => tasksByPageId.get(moveId))
    .filter((t): t is Task => t !== undefined && isOpenMove(t))
    .sort(compareWorkListTasks);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Header */}
      <div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.35rem', fontWeight: 500, color: 'var(--cr8w-text, #2D2438)', lineHeight: 1.25 }}>
          {person.name}
        </div>
        {(PATHWAY_STAGES.includes(person.status) || person.description) && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginTop: 6, fontFamily: 'var(--font-label)', fontSize: '0.72rem', color: 'var(--text-muted, #8A7060)' }}>
            {PATHWAY_STAGES.includes(person.status) && <span>{person.status}</span>}
            {person.description && <span>{person.description}</span>}
          </div>
        )}
      </div>

      {/* Consent — only when the record carries the field at all */}
      {person.consentCaptured !== undefined && (
        <DetailSection title="Consent">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, ...bodyText }}>
            <div>{person.consentCaptured ? 'Consent captured' : 'Consent not captured'}</div>
            {person.consentCaptured && person.consentChannels && person.consentChannels.length > 0 && (
              <div>{person.consentChannels.join(', ')}</div>
            )}
            {person.consentCaptured && person.consentCapturedDate && (
              <div>Captured {formatDate(person.consentCapturedDate)}</div>
            )}
          </div>
        </DetailSection>
      )}

      {/* Gatherings they came to */}
      <DetailSection title="Gatherings they came to">
        {gatherings.length === 0 ? (
          <div style={bodyText}>No gatherings yet.</div>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {gatherings.map((g) => (
              <li key={g.id}>
                <Link to={`/gatherings/${g.id}`} style={linkText}>
                  {g.title || g.theme || 'Untitled Flow'} — {g.date ? formatDate(g.date) : 'Date not set yet.'}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </DetailSection>

      {/* Follow-ups owed */}
      <DetailSection title="Follow-ups owed">
        {followUps.length === 0 && !person.nextInvitation ? (
          <div style={bodyText}>No follow-ups owed.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {followUps.length > 0 && (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {followUps.map((t) => {
                  const role = t.person ? TASK_ROLES[t.person] : undefined;
                  const owner = role ? role.name : t.person;
                  return (
                    <li key={t.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: 'var(--cr8w-text, #2D2438)' }}>{t.title}</span>
                      <span style={{ display: 'flex', gap: 8, alignItems: 'center', fontFamily: 'var(--font-label)', fontSize: '0.7rem', color: 'var(--text-muted, #8A7060)' }}>
                        {owner ? <span>{owner}</span> : null}
                        <span>{t.due_date ? formatDate(t.due_date) : 'No date yet.'}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
            {person.nextInvitation && (
              <div style={bodyText}>Next invitation: {person.nextInvitation}</div>
            )}
          </div>
        )}
      </DetailSection>

      {/* Notes — Description prose, detail views only */}
      {person.descriptionFull && (
        <DetailSection title="Notes">
          <div style={{ ...bodyText, whiteSpace: 'pre-wrap' }}>{person.descriptionFull}</div>
        </DetailSection>
      )}
    </div>
  );
}

export function PersonDetailPage() {
  const { id } = useParams();
  const { data, actions } = useDashboard();
  const resolution = resolvePerson(data.stations, data.syncStatus, id ?? '');

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-8 sm:px-6 lg:px-8">
      <div style={{ padding: '16px 0 12px' }}>
        <Link
          to="/people"
          style={{ fontFamily: 'var(--font-label)', fontSize: '0.72rem', fontWeight: 700, color: 'var(--cr8w-primary-text, #466F64)', textDecoration: 'none' }}
        >
          ← People
        </Link>
      </div>

      {data.syncStatus === 'stale' && resolution.state === 'found' && (
        <p className="home-stale-marker" style={{ marginBottom: 12 }}>
          Last-good read — not a live read.
        </p>
      )}

      {resolution.state === 'loading' && (
        data.syncStatus === 'failed' ? (
          <div style={{ padding: '36px 24px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: 'var(--text-secondary, #6B5F7A)', marginBottom: 12 }}>
              This person could not be loaded.
            </div>
            <button
              onClick={() => actions.retrySync()}
              style={{ fontFamily: 'var(--font-label)', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
            >
              Try again
            </button>
          </div>
        ) : (
          <div style={{ padding: '36px 24px', textAlign: 'center', fontFamily: 'var(--font-body)', fontSize: '0.85rem', color: 'var(--text-secondary, #6B5F7A)' }}>
            Loading this person…
          </div>
        )
      )}

      {resolution.state === 'not-found' && (
        <div style={{ padding: '36px 24px', textAlign: 'center' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 600, color: 'var(--cr8w-text, #2D2438)', marginBottom: 6 }}>
            This person is not on the board.
          </div>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: 'var(--text-muted, #8A7060)' }}>
            They may have been removed, or the link is wrong.
          </div>
        </div>
      )}

      {resolution.state === 'found' && <PersonDetail person={resolution.person} />}
    </div>
  );
}
