export const KV_TABLE = 'kv_store_dabe1c74' as const;

export const KV_KEYS = {
  tasks: 'cr8w_tasks',
  stations: 'cr8w_stations',
  forum: 'cr8w_forum',
  messages: 'cr8w_messages',
  braindumps: 'cr8w_braindumps',
  announcements: 'cr8w_announcements',
  forum_replies: 'cr8w_forum_replies',
  workshops: 'cr8w_workshops',
  workshop_programs: 'cr8w_workshop_programs',
  workshop_resources: 'cr8w_workshop_resources',
  coflow_dates: 'cr8w_coflow_dates',
  coflow_checkins: 'cr8w_coflow_checkins',
  well_notes: 'cr8w_well_notes',
  calendar_events: 'cr8w_calendar_events',
} as const;

export const SYNC_POLICY = {
  CACHE_TTL_MS: 55_000,
  CDN_MAXAGE_S: 60,
  FETCH_TIMEOUT_MS: 10_000,
  REQUEST_TIMEOUT_MS: 8_000,
  RETRY_COUNT: 1,
} as const;
