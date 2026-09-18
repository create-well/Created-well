/**
 * Seed the CR8W username → email map in the Supabase KV store.
 *
 * After running this script, users can sign in using a username instead of
 * their email address.  The mapping is stored server-side only (Supabase KV)
 * and is never included in any client bundle.
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=<key> node scripts/seed-username-map.mjs
 *
 * The script is idempotent: existing mappings for the same username are
 * overwritten; mappings for other usernames are preserved.
 *
 * Service role key:
 *   https://supabase.com/dashboard/project/irtqcygriedvdijppntz/settings/api
 *   → "service_role" (secret) — keep it server-side only
 */

const SUPABASE_URL      = 'https://irtqcygriedvdijppntz.supabase.co';
const SERVICE_ROLE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const KV_TABLE          = 'kv_store_dabe1c74';
const KV_KEY            = 'cr8w_username_map';

if (!SERVICE_ROLE_KEY) {
  console.error('Error: SUPABASE_SERVICE_ROLE_KEY env var is required.');
  process.exit(1);
}

const adminHeaders = {
  'Content-Type': 'application/json',
  Authorization:  `Bearer ${SERVICE_ROLE_KEY}`,
  apikey:          SERVICE_ROLE_KEY,
};

// ── Fetch existing map ────────────────────────────────────────────────────────
const selectRes = await fetch(
  `${SUPABASE_URL}/rest/v1/${KV_TABLE}?key=eq.${KV_KEY}&select=value`,
  { headers: adminHeaders },
);
const rows = await selectRes.json();
let map = {};
if (Array.isArray(rows) && rows[0]?.value) {
  try { map = typeof rows[0].value === 'string' ? JSON.parse(rows[0].value) : rows[0].value; }
  catch { map = {}; }
}
console.log('Current username map:', map);

// ── Apply mappings ────────────────────────────────────────────────────────────
// Add entries here.  Keep this file server-side only — do not commit to a
// public repo if it contains credentials.
const additions = {
  monny: 'mb@tablante.com',
};

const updated = { ...map, ...additions };
console.log('Updated username map:', updated);

// ── Upsert into KV ────────────────────────────────────────────────────────────
const upsertRes = await fetch(
  `${SUPABASE_URL}/rest/v1/${KV_TABLE}?on_conflict=key`,
  {
    method: 'POST',
    headers: { ...adminHeaders, Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({ key: KV_KEY, value: JSON.stringify(updated) }),
  },
);

if (!upsertRes.ok) {
  const txt = await upsertRes.text();
  console.error('KV upsert failed:', txt);
  process.exit(1);
}

console.log('\n✓ Username map saved to KV');
Object.entries(additions).forEach(([u, e]) =>
  console.log(`  username "${u}" → ${e}`)
);
console.log('\nUsers can now sign in with their username instead of email.');
