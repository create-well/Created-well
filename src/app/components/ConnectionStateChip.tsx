import React from 'react';
import type { ConnectionChipInput } from '../../lib/connectionStateChip';
import { connectionChipModel, type ConnectionChipTone } from '../../lib/connectionStateChip';

/**
 * The connection-state-wording template's first rendering component
 * (templates/registry.json id connection-state-wording, File B
 * "Connection States" page 3:168 of the CR8W CMS Template Kit). It
 * carries both kit component sets as two separate variant families that
 * are never merged into one state list: the kit connection-state family
 * ("Connection state chip", set 3:181: NOT CONNECTED / VERIFYING / LIVE /
 * UNREACHABLE / WRITES DISABLED, under the kit's never-red rule — no
 * state in that family renders in a red or danger treatment) and the
 * dashboard freshness family ("Freshness chip", set 3:188: Fresh /
 * Aging / Stale, mirroring src/lib/freshnessLabel.ts's render-time
 * band). The component is presentational: a caller supplies the state
 * or band, and the chip only renders it — no fetching, no timers, no
 * storage, no context reads. Styling is Layer 1 tokens of record only
 * (src/styles/tokens.css); the refresh-fork variable names are
 * forbidden here, and any neutral outside Layer 1 comes from
 * currentColor, never a fork variable or a hard-coded hex.
 */

const TONE_STYLES: Record<ConnectionChipTone, { chip: React.CSSProperties; dot: string }> = {
  idle: {
    chip: { background: 'var(--sand)', color: 'var(--darkrust)' },
    dot: 'var(--clay)',
  },
  pending: {
    chip: {
      background: 'color-mix(in srgb, var(--camel) 30%, var(--cream))',
      color: 'var(--darkrust)',
    },
    dot: 'var(--camel)',
  },
  live: {
    chip: { background: 'var(--rust)', color: 'var(--cream)' },
    dot: 'var(--cream)',
  },
  unreachable: {
    chip: {
      background: 'color-mix(in srgb, var(--peach) 65%, var(--cream))',
      color: 'var(--darkrust)',
    },
    dot: 'var(--darkrust)',
  },
  readonly: {
    chip: {
      background: 'transparent',
      color: 'color-mix(in srgb, var(--darkrust) 62%, transparent)',
      border: '1px solid var(--clay)',
    },
    dot: 'var(--clay)',
  },
  current: {
    chip: { background: 'var(--rust)', color: 'var(--cream)' },
    dot: 'var(--cream)',
  },
  aging: {
    chip: {
      background: 'color-mix(in srgb, var(--camel) 30%, var(--cream))',
      color: 'var(--darkrust)',
    },
    dot: 'var(--camel)',
  },
  stale: {
    chip: { background: 'var(--sand)', color: 'var(--darkrust)' },
    dot: 'var(--darkrust)',
  },
};

export function ConnectionStateChip({ input, className }: {
  input: ConnectionChipInput;
  className?: string;
}) {
  const model = connectionChipModel(input);
  const tone = TONE_STYLES[model.tone];
  return (
    <span
      role="status"
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--space-xs)',
        padding: 'var(--space-xs) var(--space-s)',
        borderRadius: 'var(--r-pill)',
        fontFamily: 'var(--type-label-family)',
        fontSize: 'var(--type-label-size)',
        fontWeight: 'var(--type-label-weight)',
        letterSpacing: 'var(--type-label-tracking)',
        textTransform: 'uppercase',
        ...tone.chip,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: tone.dot,
          flexShrink: 0,
        }}
      />
      {model.label}
    </span>
  );
}
