// ── Inline deadline editor ────────────────────────────────────────────────────
//
// One component for every editable date in the dashboard.
//
// Before this, three different files each did their own date maths and each
// rendered dates a different way. A Move said "Due Oct 2", a Flow said "14 days
// away", and a third place said "due-soon" with no number at all. Two of them
// parsed date-only strings as UTC midnight, which in Las Vegas is 5pm the day
// before, so they showed the wrong day.
//
// Now the rule lives in whenLabel and the editing lives here.
//
// Clearing the field is allowed on purpose. "no date set" is a real answer and
// it beats a made-up deadline nobody agreed to.

import React, { useState } from 'react';
import { whenLabel, WHEN_TONE_COLOR } from '../../lib/whenLabel';

export function InlineDate({
  value,
  done,
  onSave,
  size = '0.65rem',
  prefix = 'Due ',
  emptyLabel = '📅 no date set',
  readOnly,
}: {
  value?: string;
  done?: boolean;
  onSave: (v: string) => void;
  size?: string;
  /** Word in front of a future date. Overdue dates never get one. */
  prefix?: string;
  emptyLabel?: string;
  readOnly?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const when = whenLabel(value, { done });

  if (editing && !readOnly) {
    return (
      <input
        type="date"
        defaultValue={(value || '').slice(0, 10)}
        autoFocus
        onBlur={e => {
          setEditing(false);
          if (e.target.value !== (value || '').slice(0, 10)) onSave(e.target.value);
        }}
        onKeyDown={e => {
          if (e.key === 'Escape') setEditing(false);
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
        style={{
          fontFamily: 'var(--font-label)', fontSize: size,
          padding: '1px 4px', borderRadius: 4,
          border: '1px solid var(--cr8w-primary)', background: 'transparent',
          color: 'var(--text-primary)',
        }}
      />
    );
  }

  return (
    <span
      onClick={() => { if (!readOnly) setEditing(true); }}
      // The full date, with weekday and year, is always here. Shortening the
      // visible label never hides anything.
      title={when.absolute || (readOnly ? '' : 'click to set a date')}
      style={{
        fontFamily: 'var(--font-label)',
        fontSize: size,
        color: WHEN_TONE_COLOR[when.tone],
        cursor: readOnly ? 'default' : 'pointer',
        borderBottom: readOnly ? 'none' : '1px dotted currentColor',
      }}
    >
      {when.days === null
        ? emptyLabel
        : `${when.overdue ? '' : prefix}${when.text}`}
    </span>
  );
}

// ── Inline select ─────────────────────────────────────────────────────────────
//
// Options come from the real Notion select lists. Anything not on the list is
// rejected by the writer rather than quietly creating a new option, so the
// dashboard and the database stay in step.
export function InlineSelect({ value, options, placeholder, onSave, maxWidth = 150 }: {
  value?: string;
  options: readonly string[];
  placeholder: string;
  onSave: (v: string) => void;
  maxWidth?: number;
}) {
  return (
    <select
      value={value || ''}
      onChange={e => onSave(e.target.value)}
      style={{
        fontFamily: 'var(--font-label)', fontSize: '0.6rem',
        padding: '1px 4px', borderRadius: 4,
        border: '1px solid var(--border-soft)', background: 'transparent',
        color: value ? 'var(--text-secondary)' : 'var(--text-muted)',
        cursor: 'pointer', maxWidth,
      }}
    >
      <option value="">{placeholder}</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

// ── The real Notion select lists, verified against the live schema ────────────

/** MOVES `Touchpoint`. The 14-day return rhythm. */
export const TOUCHPOINT_OPTIONS = [
  'Thank-you (24-48h)',
  'Check-in (Day 5-7)',
  'Next invite (Day 10-14)',
  'Personal invite (after 2nd)',
  'Other',
] as const;

/** MOVES `Type`. */
export const MOVE_TYPE_OPTIONS = ['Prep', 'Day-Of', 'Follow-Up', 'Admin', 'Content'] as const;

/** FLOWS `Type`. */
export const FLOW_TYPE_OPTIONS = [
  'Podyap', 'Open Studio', 'Book Club', 'Workshop',
  'Pop-Up', 'Surprise-ment', 'Geyser', 'Internal',
] as const;

/** FLOWS `Phase`. Where in the making this flow is. */
export const FLOW_PHASE_OPTIONS = [
  'Cohoe', 'Concepting', 'Coordinating', 'Marketing',
  'Day of', 'Decomprocessing', 'Depanty',
] as const;

/** FLOWS `Status`. All seven, including the four the old code never handled. */
export const FLOW_STATUS_OPTIONS = [
  'Idea', 'Scheduled', 'Ready', 'Approved', 'Happened', 'Wrapped', 'Cancelled',
] as const;
