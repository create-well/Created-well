import { NOTION_DB, NOTION_WRITE_POLICY } from './notion.js';

// Order in which databases are fetched in api/dashboard.ts fan-out
export const SYNC_ORDER = ['MOVES', 'PEOPLE', 'FLOWS', 'CONTENT', 'MONEY'] as const;

export const SYNC_POLICY = {
  CACHE_TTL_MS:     55_000,  // in-process cache TTL (api/dashboard.ts)
  CDN_MAXAGE_S:     60,      // s-maxage for CDN responses
  FETCH_TIMEOUT_MS: 10_000,  // client fetchDashboard timeout (api.ts)
  REQ_TIMEOUT_MS:   8_000,   // generic req() timeout (api.ts)
  RETRY_COUNT:      1,       // GET retry on network error
} as const;

// Validate incoming DB before any write operation
export function assertWritable(dbKey: keyof typeof NOTION_DB, context: string): void {
  if (NOTION_WRITE_POLICY[dbKey] === 'read-only') {
    throw new Error(`[sync] ${dbKey} is configured as read-only — write blocked in ${context}.`);
  }
}

// Active Supabase KV store table (Project: irtqcygriedvdijppntz)
// Dead table: kv_store_8dcd9693 — DO NOT USE.
export const KV_TABLE = 'kv_store_dabe1c74' as const;

export const KV_KEYS = {
  tasks:              'cr8w_tasks',
  stations:           'cr8w_stations',
  forum:              'cr8w_forum',
  coflow_dates:       'cr8w_coflow_dates',
  money:              'cr8w_money',
  messages:           'cr8w_messages',
  braindumps:         'cr8w_braindumps',
  announcements:      'cr8w_announcements',
  forum_replies:      'cr8w_forum_replies',
  workshops:          'cr8w_workshops',
  workshop_programs:  'cr8w_workshop_programs',
  workshop_resources: 'cr8w_workshop_resources',
  coflow_checkins:    'cr8w_coflow_checkins',
  well_notes:         'cr8w_well_notes',
  calendar_events:    'cr8w_calendar_events',
  invite_counts:      'cr8w_invite_counts',
  parking_lot:        'cr8w_parking_lot',
} as const;
