import React, { useState } from 'react';
import { useDashboard } from '../../contexts/DashboardContext';
import { ViewShell } from '../components/ViewShell';
import { shortDateLabel } from '../../lib/dateLabel';
import {
  sortPendingDecisions, decidedDecisions,
  buildDecisionCreate, buildDecideUpdate, buildDeferUpdate,
} from '../../lib/decisionsView';
import type { DecisionRecord } from '../components/api';

const URGENCY_LABELS: Record<DecisionRecord['urgency'], string> = {
  'now': 'Needs deciding now',
  'this-week': 'This week',
  'when-clear': 'When I have clarity',
};

const URGENCY_COLORS: Record<DecisionRecord['urgency'], string> = {
  'now': '#FF453A',
  'this-week': '#FF9F0A',
  'when-clear': '#7BA89D',
};

function DecisionCard({
  decision,
  onDecide,
  onDefer,
}: {
  decision: DecisionRecord;
  onDecide: (id: number, answer: string) => Promise<void>;
  onDefer: (id: number) => Promise<void>;
}) {
  const [deciding, setDeciding] = useState(false);
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (decision.status === 'decided') {
    return (
      <div style={{
        padding: '12px 16px',
        borderRadius: 12,
        background: 'var(--cr8w-card-bg, #F4F1ED)',
        border: '1px solid var(--border-soft, rgba(196,164,132,0.15))',
        opacity: 0.75,
      }}>
        <div style={{
          fontFamily: 'var(--font-body)', fontSize: '0.82rem',
          color: 'var(--cr8w-text, #2D2438)', marginBottom: 4,
          textDecoration: 'line-through',
        }}>
          {decision.question}
        </div>
        {decision.answer && (
          <div style={{
            fontFamily: 'var(--font-body)', fontSize: '0.75rem',
            color: 'var(--text-muted)', fontStyle: 'italic',
          }}>
            → {decision.answer}
          </div>
        )}
        <div style={{
          fontFamily: 'var(--font-label)', fontSize: '0.62rem',
          color: '#30D158', marginTop: 4,
        }}>
          ✓ Decided {shortDateLabel(decision.decided_at, '')}
        </div>
      </div>
    );
  }

  async function submitDecide() {
    setBusy(true);
    setError('');
    try {
      await onDecide(decision.id, answer);
      setDeciding(false);
    } catch {
      setError('That did not save. Check the connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  async function submitDefer() {
    setBusy(true);
    setError('');
    try {
      await onDefer(decision.id);
    } catch {
      setError('That did not save. Check the connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{
      padding: '14px 16px',
      borderRadius: 12,
      background: 'var(--cr8w-card-bg, #F4F1ED)',
      border: '1px solid var(--border-soft, rgba(196,164,132,0.15))',
      borderLeft: `3px solid ${URGENCY_COLORS[decision.urgency]}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: decision.context ? 6 : 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{
            fontFamily: 'var(--font-body)', fontSize: '0.85rem',
            fontWeight: 600, color: 'var(--cr8w-text, #2D2438)',
            lineHeight: 1.4, marginBottom: 2,
          }}>
            {decision.question}
          </div>
          <div style={{
            fontFamily: 'var(--font-label)', fontSize: '0.62rem',
            color: URGENCY_COLORS[decision.urgency], fontWeight: 600,
          }}>
            {URGENCY_LABELS[decision.urgency]}
          </div>
        </div>
      </div>
      {decision.context && (
        <div style={{
          fontFamily: 'var(--font-body)', fontSize: '0.75rem',
          color: 'var(--text-muted, #6B5F7A)', lineHeight: 1.5,
          marginBottom: 10,
        }}>
          {decision.context}
        </div>
      )}

      {deciding ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input
            autoFocus
            value={answer}
            onChange={e => setAnswer(e.target.value)}
            placeholder="What did you decide?"
            style={{
              fontFamily: 'var(--font-body)', fontSize: '0.8rem',
              border: '1px solid var(--cr8w-primary, #7BA89D)',
              borderRadius: 8, background: 'transparent',
              color: 'var(--cr8w-text)', outline: 'none',
              padding: '6px 10px', width: '100%', boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={submitDecide} disabled={busy} style={{
              padding: '5px 14px', borderRadius: 7,
              background: '#30D158', color: '#fff',
              fontFamily: 'var(--font-label)', fontSize: '0.72rem', fontWeight: 600,
              border: 'none', cursor: busy ? 'wait' : 'pointer',
            }}>
              {busy ? 'Saving…' : 'Mark decided'}
            </button>
            <button onClick={() => setDeciding(false)} disabled={busy} style={{
              padding: '5px 14px', borderRadius: 7, background: 'none',
              color: 'var(--text-muted)', fontFamily: 'var(--font-label)', fontSize: '0.72rem',
              border: '1px solid var(--border-soft)', cursor: 'pointer',
            }}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => setDeciding(true)} style={{
            padding: '5px 14px', borderRadius: 7,
            background: 'var(--cr8w-primary, #7BA89D)', color: '#fff',
            fontFamily: 'var(--font-label)', fontSize: '0.72rem', fontWeight: 600,
            border: 'none', cursor: 'pointer',
          }}>
            Decide
          </button>
          <button onClick={submitDefer} disabled={busy} style={{
            padding: '5px 12px', borderRadius: 7, background: 'none',
            color: 'var(--text-muted)', fontFamily: 'var(--font-label)', fontSize: '0.72rem',
            border: '1px solid var(--border-soft)', cursor: busy ? 'wait' : 'pointer',
          }}>
            {busy ? 'Saving…' : 'Defer'}
          </button>
        </div>
      )}
      {error && (
        <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: '#FF453A', marginTop: 8 }}>
          {error}
        </div>
      )}
    </div>
  );
}

function AddDecisionForm({
  onAdd,
  onCancel,
}: {
  onAdd: (d: { question: string; context: string; urgency: DecisionRecord['urgency'] }) => Promise<void>;
  onCancel: () => void;
}) {
  const [question, setQuestion] = useState('');
  const [context, setContext] = useState('');
  const [urgency, setUrgency] = useState<DecisionRecord['urgency']>('this-week');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim() || busy) return;
    setBusy(true);
    setError('');
    try {
      await onAdd({ question: question.trim(), context: context.trim(), urgency });
      onCancel();
    } catch {
      setError('That did not save. Check the connection and try again.');
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} style={{
      padding: '14px 16px',
      borderRadius: 12,
      border: '1px solid var(--cr8w-primary, #7BA89D)',
      background: 'var(--cr8w-card-bg, #F4F1ED)',
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      <input
        autoFocus
        value={question}
        onChange={e => setQuestion(e.target.value)}
        placeholder="What needs to be decided?"
        style={{
          fontFamily: 'var(--font-body)', fontSize: '0.85rem', fontWeight: 600,
          border: 'none', background: 'transparent',
          color: 'var(--cr8w-text)', outline: 'none', padding: 0,
        }}
      />
      <textarea
        value={context}
        onChange={e => setContext(e.target.value)}
        placeholder="Context (optional) — what makes this tricky?"
        rows={2}
        style={{
          fontFamily: 'var(--font-body)', fontSize: '0.78rem',
          border: '1px solid var(--border-soft, rgba(196,164,132,0.25))',
          borderRadius: 8, background: 'transparent',
          color: 'var(--cr8w-text)', outline: 'none',
          padding: '6px 10px', resize: 'none',
        }}
      />
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {(['now', 'this-week', 'when-clear'] as DecisionRecord['urgency'][]).map(u => {
          const selected = urgency === u;
          return (
            <button
              key={u}
              type="button"
              aria-pressed={selected}
              onClick={() => setUrgency(u)}
              style={{
                padding: '4px 10px', borderRadius: 6, cursor: 'pointer',
                fontFamily: 'var(--font-label)', fontSize: '0.65rem', fontWeight: selected ? 800 : 600,
                border: `1px solid ${selected ? URGENCY_COLORS[u] : 'var(--border-soft)'}`,
                background: selected ? URGENCY_COLORS[u] : 'none',
                color: selected ? '#fff' : 'var(--text-muted)',
              }}
            >
              {URGENCY_LABELS[u]}
            </button>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" disabled={busy} style={{
          padding: '6px 16px', borderRadius: 8,
          background: 'var(--cr8w-text, #2D2438)', color: '#fff',
          fontFamily: 'var(--font-label)', fontSize: '0.72rem', fontWeight: 600,
          border: 'none', cursor: busy ? 'wait' : 'pointer',
        }}>
          {busy ? 'Adding…' : 'Add to queue'}
        </button>
        <button type="button" onClick={onCancel} disabled={busy} style={{
          padding: '6px 14px', borderRadius: 8, background: 'none',
          color: 'var(--text-muted)', fontFamily: 'var(--font-label)', fontSize: '0.72rem',
          border: '1px solid var(--border-soft)', cursor: 'pointer',
        }}>
          Cancel
        </button>
      </div>
      {error && (
        <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: '#FF453A' }}>
          {error}
        </div>
      )}
    </form>
  );
}

export function DecisionsPage() {
  const { data, actions } = useDashboard();
  const [adding, setAdding] = useState(false);
  const [showDecided, setShowDecided] = useState(false);

  const state =
    data.syncStatus === 'loading' ? 'loading' :
    data.syncStatus === 'failed' ? 'failed' : 'fresh';

  const records = data.decisions || [];
  const pending = sortPendingDecisions(records);
  const decided = decidedDecisions(records);

  async function addDecision(d: { question: string; context: string; urgency: DecisionRecord['urgency'] }) {
    await actions.addDecision(buildDecisionCreate(d));
  }

  async function decide(id: number, answer: string) {
    await actions.updateDecision(id, buildDecideUpdate(answer, new Date().toISOString()));
  }

  async function defer(id: number) {
    await actions.updateDecision(id, buildDeferUpdate());
  }

  return (
    <ViewShell state={state} onRetry={() => {}}>
      <div style={{ maxWidth: 620, margin: '0 auto', padding: '24px 16px 96px' }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{
            fontFamily: 'var(--font-label)', fontSize: '0.62rem', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.1em',
            color: 'var(--text-muted)', marginBottom: 6,
          }}>
            Monica's Decision Queue
          </div>
          <h1 style={{
            fontFamily: 'var(--font-display)', fontSize: '1.6rem', fontWeight: 800,
            color: 'var(--cr8w-text, #2D2438)', margin: 0, letterSpacing: '-0.02em',
          }}>
            {pending.length === 0 ? 'Queue is clear' : `${pending.length} decision${pending.length > 1 ? 's' : ''} pending`}
          </h1>
          <p style={{
            fontFamily: 'var(--font-body)', fontSize: '0.8rem',
            color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.5,
          }}>
            One place for everything that needs a decision. Decide, defer, or let it wait.
          </p>
        </div>

        {/* Guiding principle — at the top, solid card treatment */}
        <div style={{
          padding: '14px 18px',
          borderRadius: 12,
          background: 'var(--cr8w-card-bg, #F4F1ED)',
          border: '1px solid rgba(123,168,157,0.18)',
          marginBottom: 24,
        }}>
          <div style={{
            fontFamily: 'var(--font-label)', fontSize: '0.6rem', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.1em',
            color: 'var(--text-muted)', marginBottom: 6,
          }}>
            How Monica decides
          </div>
          <div style={{
            fontFamily: 'var(--font-body)', fontSize: '0.78rem',
            color: 'var(--cr8w-text, #2D2438)', lineHeight: 1.6,
          }}>
            Does this move the work forward, or does it just move the worry?
            If it's not a clear yes, it's a defer or a no.
          </div>
        </div>

        {/* Add button */}
        <div style={{ marginBottom: 20 }}>
          {adding ? (
            <AddDecisionForm onAdd={addDecision} onCancel={() => setAdding(false)} />
          ) : (
            <button
              onClick={() => setAdding(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 18px', borderRadius: 10,
                background: 'var(--cr8w-text, #2D2438)', color: '#fff',
                fontFamily: 'var(--font-label)', fontSize: '0.78rem', fontWeight: 600,
                border: 'none', cursor: 'pointer',
                letterSpacing: '0.02em',
              }}
            >
              + Add decision
            </button>
          )}
        </div>

        {/* Pending decisions */}
        {pending.length === 0 && !adding ? (
          <div style={{
            padding: '32px 0',
            textAlign: 'center',
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-body)',
            fontSize: '0.82rem',
            lineHeight: 1.6,
          }}>
            <div style={{ fontSize: '2rem', marginBottom: 10 }}>⚡</div>
            <strong style={{ display: 'block', color: 'var(--cr8w-text)', marginBottom: 4 }}>
              Nothing needs deciding right now
            </strong>
            A clear queue is a sign of good hygiene — not avoidance.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
            {pending.map(d => (
              <DecisionCard key={d.id} decision={d} onDecide={decide} onDefer={defer} />
            ))}
          </div>
        )}

        {/* Decided archive */}
        {decided.length > 0 && (
          <div>
            <button
              onClick={() => setShowDecided(v => !v)}
              aria-expanded={showDecided}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: 'var(--font-label)', fontSize: '0.7rem', fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.08em',
                color: 'var(--text-muted)',
                padding: '8px 0', marginBottom: 10,
              }}
            >
              <span style={{ transform: showDecided ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▶</span>
              Decided ({decided.length})
            </button>
            {showDecided && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {decided.map(d => <DecisionCard key={d.id} decision={d} onDecide={decide} onDefer={defer} />)}
              </div>
            )}
          </div>
        )}
      </div>
    </ViewShell>
  );
}
