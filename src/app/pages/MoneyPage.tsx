import React, { useEffect, useRef, useState } from 'react';
import { useDashboard } from '../../contexts/DashboardContext';
import { ViewShell } from '../components/ViewShell';
import { dateLabel, localDateString } from '../../lib/dateLabel';
import {
  moneyDirection, moneyTotals, recentActivity, buildMoneyPayload,
} from '../../lib/moneyView';
import { getSetting, setSetting } from '../components/api';
import type { MoneyRecord } from '../components/api';

const NEXT_MOVE_KEY = 'money_next_move';
const INCOME_COLOR = '#30D158';
const EXPENSE_COLOR = '#FF453A';

function formatAmount(n: number): string {
  return `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function ActivityRow({ record }: { record: MoneyRecord }) {
  const direction = moneyDirection(record);
  return (
    <div style={{
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
          {record.name}
        </div>
        <div style={{ fontFamily: 'var(--font-label)', fontSize: '0.65rem', color: 'var(--text-muted, #6B5F7A)', marginTop: 1 }}>
          {record.date
            ? dateLabel(record.date, { month: 'short', day: 'numeric', year: 'numeric' })
            : 'No date yet.'}
          {direction && (
            <span style={{ color: direction === 'in' ? INCOME_COLOR : EXPENSE_COLOR, fontWeight: 700 }}>
              {' · '}{direction === 'in' ? 'Income' : 'Expense'}
            </span>
          )}
        </div>
      </div>
      <span style={{
        fontFamily: 'var(--font-label)',
        fontSize: '0.88rem',
        fontWeight: 700,
        color: direction === 'in' ? INCOME_COLOR : direction === 'out' ? EXPENSE_COLOR : 'var(--cr8w-text, #2D2438)',
      }}>
        {direction === 'in' ? '+' : direction === 'out' ? '−' : ''}{formatAmount(record.amount)}
      </span>
    </div>
  );
}

export function MoneyPage() {
  const { data, actions } = useDashboard();
  const records = data.money || [];
  const totals = moneyTotals(records);
  const recent = recentActivity(records, 5);

  const [direction, setDirection] = useState<'in' | 'out'>('in');
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(localDateString());
  const [logging, setLogging] = useState(false);
  const [logError, setLogError] = useState('');
  const labelRef = useRef<HTMLInputElement>(null);

  const [nextMove, setNextMove] = useState('');
  const [editingNextMove, setEditingNextMove] = useState(false);
  const [savingNextMove, setSavingNextMove] = useState(false);
  const [nextMoveError, setNextMoveError] = useState('');

  const state =
    data.syncStatus === 'loading' ? 'loading' :
    data.syncStatus === 'failed' ? 'failed' : 'fresh';

  // MONEY A: the quick-log form is hidden (one reversible change — the
  // form code below is untouched). POST /api/server/money now answers
  // 410: money is logged in the "Create Well — Budget & P&L Bookkeeping"
  // workbook, which feeds this page through KV (cr8w_money). Flip this
  // back to true only if a working quick-log endpoint returns.
  const SHOW_QUICK_LOG = false;

  // Autofocus the description field on fine-pointer devices only; on
  // touch it would open the keyboard over the page on arrival.
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia?.('(pointer: fine)').matches) {
      labelRef.current?.focus();
    }
  }, []);

  // Next Right Money Move persists in the dashboard KV store (M-1d).
  useEffect(() => {
    let live = true;
    getSetting<string>(NEXT_MOVE_KEY)
      .then(res => { if (live && typeof res.value === 'string') setNextMove(res.value); })
      .catch(e => console.error('Load next money move error:', e));
    return () => { live = false; };
  }, []);

  async function submitLog(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseFloat(amount);
    if (!label.trim() || !amount || Number.isNaN(parsed) || logging) return;
    setLogging(true);
    setLogError('');
    try {
      await actions.addMoney(buildMoneyPayload({
        label: label.trim(), amount: parsed, date, direction,
      }));
      setLabel(''); setAmount(''); setDate(localDateString());
    } catch {
      setLogError('That entry did not save. Check the connection and try again.');
    } finally {
      setLogging(false);
    }
  }

  async function saveNextMove(value: string) {
    setSavingNextMove(true);
    setNextMoveError('');
    try {
      await setSetting(NEXT_MOVE_KEY, value);
      setNextMove(value);
      setEditingNextMove(false);
    } catch {
      setNextMoveError('That did not save. Try again.');
    } finally {
      setSavingNextMove(false);
    }
  }

  const segmentStyle = (active: boolean): React.CSSProperties => ({
    flex: 1,
    minHeight: 44,
    padding: '7px 0',
    borderRadius: 8,
    border: 'none',
    cursor: 'pointer',
    fontFamily: 'var(--font-label)',
    fontSize: '0.78rem',
    fontWeight: 700,
    background: active ? 'var(--cr8w-primary, #7BA89D)' : 'transparent',
    color: active ? '#fff' : 'var(--text-muted, #6B5F7A)',
  });

  const fieldStyle: React.CSSProperties = {
    fontFamily: 'var(--font-body)', fontSize: '0.82rem',
    border: '1px solid var(--border-soft, rgba(196,164,132,0.25))',
    borderRadius: 6, background: 'transparent',
    color: 'var(--cr8w-text)', outline: 'none', padding: '6px 8px',
  };

  return (
    <ViewShell state={state} onRetry={() => {}}>
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 16px 96px' }}>
        {/* Header — settled copy */}
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
            Money
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

        {/* Net summary — solid card treatment, no gradient */}
        {(totals.income > 0 || totals.expenses > 0) && (
          <div style={{
            padding: '16px 20px',
            borderRadius: 14,
            background: 'var(--cr8w-card-bg, #F4F1ED)',
            border: `1px solid ${totals.net >= 0 ? 'rgba(48,209,88,0.2)' : 'rgba(255,69,58,0.2)'}`,
            marginBottom: 28,
          }}>
            <div style={{
              fontFamily: 'var(--font-label)', fontSize: '0.6rem', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.08em',
              color: 'var(--text-muted)', marginBottom: 2,
            }}>
              Net this period
            </div>
            <div style={{
              fontFamily: 'var(--font-display)', fontSize: '1.6rem', fontWeight: 800,
              color: totals.net >= 0 ? INCOME_COLOR : EXPENSE_COLOR,
              letterSpacing: '-0.02em',
            }}>
              {totals.net >= 0 ? '+' : '−'}{formatAmount(totals.net)}
            </div>
            {totals.undirected > 0 && (
              <div style={{
                fontFamily: 'var(--font-body)', fontSize: '0.72rem',
                color: 'var(--text-muted, #6B5F7A)', marginTop: 4,
              }}>
                {totals.undirected} record{totals.undirected === 1 ? '' : 's'} without a direction yet — not counted in this net.
              </div>
            )}
          </div>
        )}

        {/* Quick Log — one card, segmented Direction toggle, one-row form.
            Hidden under MONEY A (see SHOW_QUICK_LOG above). */}
        {SHOW_QUICK_LOG && (
        <section style={{
          padding: '16px 18px',
          borderRadius: 14,
          background: 'var(--cr8w-card-bg, #F4F1ED)',
          border: '1px solid var(--border-soft, rgba(196,164,132,0.15))',
          marginBottom: 28,
        }}>
          <div style={{
            fontFamily: 'var(--font-label)', fontSize: '0.6rem', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: '0.1em',
            color: 'var(--text-muted)', marginBottom: 10,
          }}>
            Quick log
          </div>
          <div
            role="group"
            aria-label="Direction"
            style={{
              display: 'flex', gap: 4, padding: 4, marginBottom: 12,
              borderRadius: 10, background: 'rgba(123,168,157,0.08)',
            }}
          >
            <button type="button" aria-pressed={direction === 'in'} onClick={() => setDirection('in')} style={segmentStyle(direction === 'in')}>
              📥 Income
            </button>
            <button type="button" aria-pressed={direction === 'out'} onClick={() => setDirection('out')} style={segmentStyle(direction === 'out')}>
              📤 Expense
            </button>
          </div>
          <form onSubmit={submitLog} style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <input
              ref={labelRef}
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="What is this?"
              aria-label="What is this?"
              style={{ ...fieldStyle, flex: '2 1 180px', fontFamily: 'var(--font-body)' }}
            />
            <div style={{ display: 'flex', alignItems: 'center', flex: '1 1 110px', ...fieldStyle, padding: 0 }}>
              <span style={{
                fontFamily: 'var(--font-label)', fontSize: '0.82rem',
                color: 'var(--text-muted)', paddingLeft: 8,
              }}>$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="Amount"
                aria-label="Amount"
                style={{
                  fontFamily: 'var(--font-label)', fontSize: '0.82rem',
                  border: 'none', background: 'transparent', width: '100%',
                  color: 'var(--cr8w-text)', outline: 'none', padding: '6px 8px 6px 4px',
                }}
              />
            </div>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              aria-label="Date"
              style={{ ...fieldStyle, fontFamily: 'var(--font-label)', fontSize: '0.78rem', flex: '0 1 auto' }}
            />
            <button
              type="submit"
              disabled={logging}
              style={{
                padding: '6px 16px', borderRadius: 7, minHeight: 44,
                background: 'var(--cr8w-primary, #7BA89D)', color: '#fff',
                fontFamily: 'var(--font-label)', fontSize: '0.78rem', fontWeight: 600,
                border: 'none', cursor: logging ? 'wait' : 'pointer',
                opacity: logging ? 0.7 : 1,
              }}
            >
              {logging ? 'Logging…' : 'Add'}
            </button>
          </form>
          {logError && (
            <div style={{
              fontFamily: 'var(--font-body)', fontSize: '0.75rem',
              color: '#B3261E', marginTop: 8,
            }}>
              {logError}
            </div>
          )}
        </section>
        )}

        {/* Recent Activity — last 5, merged, signed with word tags */}
        <section style={{ marginBottom: 28 }}>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: '0.9rem',
            fontWeight: 700,
            color: 'var(--cr8w-text, #2D2438)',
            letterSpacing: '-0.01em',
            marginBottom: 12,
          }}>
            Recent activity
          </div>
          {recent.length === 0 ? (
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
              No money tracked yet. Real numbers only.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {recent.map(record => <ActivityRow key={record.id} record={record} />)}
            </div>
          )}
        </section>

        {/* Next right money move — solid card treatment, KV-persisted */}
        <section style={{
          padding: '16px 18px',
          borderRadius: 14,
          background: 'var(--cr8w-card-bg, #F4F1ED)',
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
                <button onClick={() => saveNextMove(nextMove)} disabled={savingNextMove} style={{
                  padding: '5px 14px', borderRadius: 7, minHeight: 44,
                  background: 'var(--cr8w-primary, #7BA89D)', color: '#fff',
                  fontFamily: 'var(--font-label)', fontSize: '0.72rem', fontWeight: 600,
                  border: 'none', cursor: savingNextMove ? 'wait' : 'pointer',
                }}>
                  {savingNextMove ? 'Saving…' : 'Save'}
                </button>
                <button onClick={() => saveNextMove('')} disabled={savingNextMove} style={{
                  padding: '5px 14px', borderRadius: 7, minHeight: 44,
                  background: 'none', color: 'var(--text-muted)',
                  fontFamily: 'var(--font-label)', fontSize: '0.72rem',
                  border: '1px solid var(--border-soft)', cursor: 'pointer',
                }}>
                  Clear
                </button>
              </div>
              {nextMoveError && (
                <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: '#B3261E' }}>
                  {nextMoveError}
                </div>
              )}
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
