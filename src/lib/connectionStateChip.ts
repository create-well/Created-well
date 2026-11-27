// The .ts extension is deliberate: tsconfig allows it, Vite resolves
// it, and the repo's node test loader requires it for lib-to-lib
// value imports (extensionless resolves only under the bundler).
import type { FreshnessBand } from './freshnessLabel.ts';

/**
 * Connection-state chip model (BUILDER-B3, templates/registry.json id
 * connection-state-wording, File B "Connection States" page 3:168 of the
 * CR8W CMS Template Kit). The registry entry's component was null: no
 * repo component carried either wording family. This model carries BOTH
 * kit component sets as two separate variant families that are never
 * merged into one state list:
 *
 * 1. The kit connection-state family ("Connection state chip", set
 *    3:181): five states with exact kit labels, under the kit's standing
 *    never-red rule — no state in this family takes a red or danger
 *    treatment, so the tone set below carries no danger tone.
 * 2. The dashboard freshness family ("Freshness chip", set 3:188), which
 *    mirrors the settled family in src/lib/freshnessLabel.ts: the band
 *    derives from a load timestamp at render time, never from a stored
 *    status string, and the band strings are already the labels.
 *
 * The model maps an input to its own family's label and tone and nothing
 * else: it does not translate between families, does not collapse any
 * two states into one, and does not invent a state or label for an input
 * outside the two families. Every derived wording lives here so the
 * component stays a dumb render and the node test suite can pin the
 * model.
 */
export type ConnectionState =
  | 'not-connected'
  | 'verifying'
  | 'live'
  | 'unreachable'
  | 'writes-disabled';

export const CONNECTION_STATE_LABELS: Record<ConnectionState, string> = {
  'not-connected': 'NOT CONNECTED',
  'verifying': 'VERIFYING',
  'live': 'LIVE',
  'unreachable': 'UNREACHABLE',
  'writes-disabled': 'WRITES DISABLED',
};

export type ConnectionChipInput =
  | { family: 'connection'; state: ConnectionState }
  | { family: 'freshness'; band: FreshnessBand };

/**
 * Closed tone set, one key per state across the two families. The
 * connection family's keys carry no red or danger tone, per the kit's
 * never-red rule; the component maps every key to Layer 1 token styling
 * in src/styles/tokens.css.
 */
export type ConnectionChipTone =
  | 'idle'
  | 'pending'
  | 'live'
  | 'unreachable'
  | 'readonly'
  | 'current'
  | 'aging'
  | 'stale';

export interface ConnectionChipModel {
  family: 'connection' | 'freshness';
  label: string;
  tone: ConnectionChipTone;
}

const CONNECTION_TONES: Record<ConnectionState, ConnectionChipTone> = {
  'not-connected': 'idle',
  'verifying': 'pending',
  'live': 'live',
  'unreachable': 'unreachable',
  'writes-disabled': 'readonly',
};

const FRESHNESS_TONES: Record<FreshnessBand, ConnectionChipTone> = {
  Fresh: 'current',
  Aging: 'aging',
  Stale: 'stale',
};

export function connectionChipModel(input: ConnectionChipInput): ConnectionChipModel {
  if (input.family === 'connection') {
    return {
      family: 'connection',
      label: CONNECTION_STATE_LABELS[input.state],
      tone: CONNECTION_TONES[input.state],
    };
  }
  // The band strings are already the labels; no label map is needed.
  return {
    family: 'freshness',
    label: input.band,
    tone: FRESHNESS_TONES[input.band],
  };
}
