import React, { useState } from 'react';
import { useDashboard } from '../../contexts/DashboardContext';
import { ViewShell } from '../components/ViewShell';

interface MoneyEntry {
  id: string;
  label: string;
  amount: number;
  date: string;
  category: 'revenue' | 'expense';
  verified: boolean;
}

function EmptySection({ label }: { label: string }) {
  return (
    <div style={{
      padding: '20px 0',
      textAlign: 'center',
      color: 'var(--text-muted, #6B5F7A)',
      fontFamily: 'var(--font-body)',
      fontSize: '0.78rem',
      lineHeight: 1.5,
      borderRadius: 10,
      border: '1px dashed var(--border-soft, rgba(196,164,132,0.25))',
      background: 'rgba(123,168,157,0.03)',
    }}>
      No {label} tracked yet. Real numbers only.
    </div>
  );
}

function MoneySection({
  title, emoji, entries, category, onAdd,
}: {
  title: string;
  emoji: string;
  entries: MoneyEntry[];
  category: 'revenue' | 'expense';
  onAdd: (e: Omit<MoneyEntry, 'id' | 'verified'>) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim() || !amount) return;
    onAdd({ label: label.trim(), amount: parseFloat(amount), date, category });
    setLabel(''); setAmount(''); setDate(new Date().toISOString().split('T')[0]);
    setAdding(false);
  }

  const total = entries.reduce((sum, e) => sum + e.amount, 0);

  return (
    <section style={{ marginBottom: 28 }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '1.1rem' }}>{emoji}</span>
          <span style={{
            fontFamily: 'var(--font-display)',
            fontSize: '0.9rem',
            fontWeight: 700,
            color: 'var(--cr8w-text, #2D2438)',
            letterSpacing: '-0.01em',
          }}>
            {title}
          </span>
        </div>
        {entries.length > 0 && (
          <span style={{
            fontFamily: 'var(--font-label)',
            fontSize: '0.85rem',
            fontWeight: 700,
            color: category === 'revenue' ? '#30D158' : '#FF453A',
          }}>
            {category === 'expense' ? '−' : '+'}${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        )}
      </div>

      {entries.length === 0 && !adding && <EmptySection label={title.toLowerCase()} />}

      {entries.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
          {entries.map(entry => (
            <div key={entry.id} style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '9px 14px',
              borderRadius: 10,
              background: 'var(--cr8w-card-bg, #F4F1ED)',
              border: '1px solid var(--border-soft, rgba(196,164,132,0.15))',
            }}>
              <div>
                <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.82rem', color: 'var(--cr8w-text, #2D2438)' }}>
                  {entry.label}
                </div>
                <div style={{ fontFamily: 'var(--font-label)', fontSize: '0.65rem', color: 'var(--text-muted, #6B5F7A)', marginTop: 1 }}>
                  {new Date(entry.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
              </div>
              <span style={{
                fontFamily: 'var(--font-label)',
                fontSize: '0.88rem',
                fontWeight: 700,
                color: category === 'revenue' ? '#30D158' : '#FF453A',
              }}>
                {category === 'expense' ? '−' : '+'}${entry.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          ))}
        </div>
      )}

      {adding ? (
        <form onSubmit={submit} style={{
          display: 'flex', flexDirection: 'column', gap: 8,
          padding: '12px 14px',
          background: 'var(--cr8w-card-bg, #F4F1ED)',
          border: '1px solid var(--cr8w-primary, #7BA89D)',
          borderRadius: 10,
        }}>
          <input
            autoFocus
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="What is this?"
            style={{
              fontFamily: 'var(--font-body)', fontSize: '0.82rem',
              border: 'none', background: 'transparent',
              color: 'var(--cr8w-text)', outline: 'none', padding: 0,
            }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="Amount"
              style={{
                fontFamily: 'var(--font-label)', fontSize: '0.82rem',
                border: '1px solid var(--border-soft, rgba(196,164,132,0.25))',
                borderRadius: 6, background: 'transparent',
                color: 'var(--cr8w-text)', outline: 'none', padding: '4px 8px', flex: 1,
              }}
            />
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              style={{
                fontFamily: 'var(--font-label)', fontSize: '0.78rem',
                border: '1px solid var(--border-soft, rgba(196,164,132,0.25))',
                borderRadius: 6, background: 'transparent',
                color: 'var(--cr8w-text)', outline: 'none', padding: '4px 8px',
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="submit" style={{
              padding: '5px 14px', borderRadius: 7,
              background: 'var(--cr8w-primary, #7BA89D)', color: '#fff',
              fontFamily: 'var(--font-label)', fontSize: '0.72rem', fontWeight: 600,
              border: 'none', cursor: 'pointer',
            }}>
              Add
            </button>
            <button type="button" onClick={() => setAdding(false)} style={{
              padding: '5px 14px', borderRadius: 7,
              background: 'none', color: 'var(--text-muted)',
              fontFamily: 'var(--font-label)', fontSize: '0.72rem',
              border: '1px solid var(--border-soft)', cursor: 'pointer',
            }}>
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setAdding(true)}
          style={{
            marginTop: entries.length > 0 ? 6 : 8,
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: 'var(--font-label)', fontSize: '0.72rem',
            color: 'var(--cr8w-primary, #7BA89D)',
            padding: '4px 0',
          }}
        >
          + Add real {category}
        </button>
      )}
    </section>
  );
}

export function MoneyPage() {
  const { data } = useDashboard();
  const [entries, setEntries] = useState<MoneyEntry[]>([]);
  const [nextMove, setNextMove] = useState('');
  const [editingNextMove, setEditingNextMove] = useState(false);

  const state =
    data.syncStatus === 'loading' ? 'loading' :
    data.syncStatus === 'failed' ? 'failed' : 'fresh';

  const revenue = entries.filter(e => e.category === 'revenue');
  const expenses = entries.filter(e => e.category === 'expense');
  const net = revenue.reduce((s, e) => s + e.amount, 0) - expenses.reduce((s, e) => s + e.amount, 0);

  function addEntry(entry: Omit<MoneyEntry, 'id' | 'verified'>) {
    setEntries(prev => [...prev, { ...entry, id: String(Date.now()), verified: true }]);
  }

  return (
    <ViewShell state={state} onRetry={() => {}}>
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 16px 48px' }}>
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <div style={{
            fontFamily: 'var(--font-label)',
            fontSize: '0.62rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: 'var(--text-muted, #6B5F7A)',
            marginBottom: 6,
          }}>
            Money, Real Only
          </div>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: '1.6rem',
            fontWeight: 800,
            color: 'var(--cr8w-text, #2D2438)',
            margin: 0,
            letterSpacing: '-0.02em',
            lineHeight: 1.2,
          }}>
            What's actually here
          </h1>
          <p style={{
            fontFamily: 'var(--font-body)',
            fontSize: '0.8rem',
            color: 'var(--text-muted, #6B5F7A)',
            marginTop: 6,
            lineHeight: 1.5,
          }}>
            No projections. No "expected." Only tracked, real numbers.
          </p>
        </div>

        {/* Net summary */}
        {entries.length > 0 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            padding: '16px 20px',
            borderRadius: 14,
            background: net >= 0
              ? 'linear-gradient(135deg, rgba(48,209,88,0.06) 0%, rgba(48,209,88,0.02) 100%)'
              : 'linear-gradient(135deg, rgba(255,69,58,0.06) 0%, rgba(255,69,58,0.02) 100%)',
            border: `1px solid ${net >= 0 ? 'rgba(48,209,88,0.2)' : 'rgba(255,69,58,0.2)'}`,
            marginBottom: 28,
          }}>
            <div>
              <div style={{
                fontFamily: 'var(--font-label)', fontSize: '0.6rem', fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.08em',
                color: 'var(--text-muted)', marginBottom: 2,
              }}>
                Net this period
              </div>
              <div style={{
                fontFamily: 'var(--font-display)', fontSize: '1.6rem', fontWeight: 800,
                color: net >= 0 ? '#30D158' : '#FF453A',
                letterSpacing: '-0.02em',
              }}>
                {net >= 0 ? '+' : '−'}${Math.abs(net).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>
        )}

        <MoneySection
          title="Revenue"
          emoji="📥"
          entries={revenue}
          category="revenue"
          onAdd={addEntry}
        />
        <MoneySection
          title="Expenses"
          emoji="📤"
          entries={expenses}
          category="expense"
          onAdd={addEntry}
        />

        {/* Next right money move */}
        <section style={{
          marginTop: 8,
          padding: '16px 18px',
          borderRadius: 14,
          background: 'linear-gradient(135deg, rgba(184,169,212,0.06) 0%, rgba(123,168,157,0.04) 100%)',
          border: '1px solid rgba(184,169,212,0.2)',
        }}>
          <div style={{
            fontFamily: 'var(--font-label)', fontSize: '0.6rem', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.1em',
            color: 'var(--text-muted)', marginBottom: 8,
          }}>
            Next right money move
          </div>
          {editingNextMove ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <textarea
                autoFocus
                value={nextMove}
                onChange={e => setNextMove(e.target.value)}
                placeholder="One clear action. What does money need from you right now?"
                rows={2}
                style={{
                  fontFamily: 'var(--font-body)', fontSize: '0.82rem',
                  border: '1px solid var(--cr8w-primary, #7BA89D)',
                  borderRadius: 8, background: 'transparent',
                  color: 'var(--cr8w-text)', outline: 'none',
                  padding: '8px 10px', resize: 'none', width: '100%', boxSizing: 'border-box',
                }}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setEditingNextMove(false)} style={{
                  padding: '5px 14px', borderRadius: 7,
                  background: 'var(--cr8w-primary, #7BA89D)', color: '#fff',
                  fontFamily: 'var(--font-label)', fontSize: '0.72rem', fontWeight: 600,
                  border: 'none', cursor: 'pointer',
                }}>
                  Save
                </button>
                <button onClick={() => { setNextMove(''); setEditingNextMove(false); }} style={{
                  padding: '5px 14px', borderRadius: 7,
                  background: 'none', color: 'var(--text-muted)',
                  fontFamily: 'var(--font-label)', fontSize: '0.72rem',
                  border: '1px solid var(--border-soft)', cursor: 'pointer',
                }}>
                  Clear
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setEditingNextMove(true)}
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: 'var(--font-body)', fontSize: '0.82rem',
                color: nextMove ? 'var(--cr8w-text, #2D2438)' : 'var(--text-muted, #6B5F7A)',
                padding: 0, lineHeight: 1.5,
              }}
            >
              {nextMove || 'Tap to name your next right move…'}
            </button>
          )}
        </section>
      </div>
    </ViewShell>
  );
}
