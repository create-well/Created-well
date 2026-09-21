/**
 * Seed mb@tablante.com as the CR8W admin / owner account.
 * Primary password: '4612cr8w'   Alternative: 'cocreatemb'
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key node scripts/seed-mb-admin.mjs
 *
 *   To use the alternate password instead:
 *   CR8W_PASSWORD=cocreatemb SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed-mb-admin.mjs
 *
 * Find the service role key at:
 *   https://supabase.com/dashboard/project/irtqcygriedvdijppntz/settings/api
 *   → "service_role" (secret) — keep it server-side only
 */

const SUPABASE_URL = 'https://irtqcygriedvdijppntz.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
  console.error('Error: SUPABASE_SERVICE_ROLE_KEY env var is required.');
  console.error('Get it from: https://supabase.com/dashboard/project/irtqcygriedvdijppntz/settings/api');
  process.exit(1);
}

const EMAIL    = 'mb@tablante.com';
const PASSWORD = process.env.CR8W_PASSWORD ?? '4612cr8w';
const PROFILE  = 'monny';
const NAME     = 'MB';

const adminHeaders = {
  'Content-Type': 'application/json',
  Authorization:  `Bearer ${SERVICE_ROLE_KEY}`,
  apikey:          SERVICE_ROLE_KEY,
};

const USER_META = {
  cr8w_profile: PROFILE,
  display_name: NAME,
  cr8w_role:    'admin',
};

console.log(`Seeding admin: ${EMAIL} (profile: ${PROFILE}, role: admin)`);

// ── Create user ────────────────────────────────────────────────────────────────
const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
  method: 'POST',
  headers: adminHeaders,
  body: JSON.stringify({
    email:         EMAIL,
    password:      PASSWORD,
    email_confirm: true,
    user_metadata: USER_META,
    app_metadata:  { role: 'admin' },
  }),
});

const data = await res.json();

if (res.ok) {
  console.log('\n✓ Admin user created successfully');
  console.log('  ID:      ', data.id);
  console.log('  Email:   ', EMAIL);
  console.log('  Password:', PASSWORD);
  console.log('  Profile: ', PROFILE);
  console.log('  Role:    ', 'admin (app_metadata.role)');
  console.log('\nSign in at the app with the above credentials.');
  process.exit(0);
}

// ── Already exists — find and update ──────────────────────────────────────────
if (data.message?.includes('already been registered') || data.code === 'email_exists') {
  console.log('User already exists — updating password, metadata, and role…');

  const listRes = await fetch(
    `${SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(EMAIL)}`,
    { headers: adminHeaders },
  );
  const listData = await listRes.json();
  const userId = listData?.users?.[0]?.id;

  if (!userId) {
    console.error('Could not find existing user. Response:', JSON.stringify(listData, null, 2));
    process.exit(1);
  }

  const updateRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    method: 'PUT',
    headers: adminHeaders,
    body: JSON.stringify({
      password:      PASSWORD,
      email_confirm: true,
      user_metadata: USER_META,
      app_metadata:  { role: 'admin' },
    }),
  });
  const updateData = await updateRes.json();

  if (updateRes.ok) {
    console.log('\n✓ Existing user updated to admin');
    console.log('  ID:      ', userId);
    console.log('  Email:   ', EMAIL);
    console.log('  Password:', PASSWORD);
    console.log('  Profile: ', PROFILE);
    console.log('  Role:    ', 'admin (app_metadata.role)');
  } else {
    console.error('Update failed:', JSON.stringify(updateData, null, 2));
    process.exit(1);
  }
} else {
  console.error('Seed failed:', JSON.stringify(data, null, 2));
  process.exit(1);
}
