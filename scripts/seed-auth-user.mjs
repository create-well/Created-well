/**
 * Seed one CR8W test user via the Supabase Admin API.
 * Uses email_confirm: true to bypass email confirmation.
 *
 * Usage:
 *   CR8W_PASSWORD='<secure password>' SUPABASE_SERVICE_ROLE_KEY='<service key>' node scripts/seed-auth-user.mjs
 *
 * Find the service role key at:
 *   https://supabase.com/dashboard/project/irtqcygriedvdijppntz/settings/api
 *   → "service_role" (secret) — keep it server-side only
 */

const SUPABASE_URL = 'https://irtqcygriedvdijppntz.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PASSWORD = process.env.CR8W_PASSWORD;

if (!SERVICE_ROLE_KEY) {
  console.error('Error: SUPABASE_SERVICE_ROLE_KEY env var is required.');
  console.error('Get it from: https://supabase.com/dashboard/project/irtqcygriedvdijppntz/settings/api');
  process.exit(1);
}

if (!PASSWORD) {
  console.error('Error: CR8W_PASSWORD env var is required; no password fallback is stored in this script.');
  process.exit(1);
}

const EMAIL   = 'monny@createwell.co';
const PROFILE = 'monny';
const NAME    = 'Monica (Monny)';

console.log(`Seeding user: ${EMAIL} (profile: ${PROFILE})`);

const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    apikey: SERVICE_ROLE_KEY,
  },
  body: JSON.stringify({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: {
      cr8w_profile: PROFILE,
      display_name: NAME,
    },
  }),
});

const data = await res.json();

if (res.ok) {
  console.log('\n✓ User created successfully');
  console.log('  ID:      ', data.id);
  console.log('  Email:   ', EMAIL);
  console.log('  Profile: ', PROFILE);
  console.log('\nTest user ready. Retrieve the password from the secure secret source used for this run.');
} else if (data.message?.includes('already been registered') || data.code === 'email_exists') {
  console.log('User already exists — fetching user to update password...');

  const listRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(EMAIL)}`, {
    headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, apikey: SERVICE_ROLE_KEY },
  });
  const listData = await listRes.json();
  const userId = listData?.users?.[0]?.id;

  if (!userId) {
    console.error('Could not find existing user. Response:', JSON.stringify(listData, null, 2));
    process.exit(1);
  }

  const updateRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      apikey: SERVICE_ROLE_KEY,
    },
    body: JSON.stringify({
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { cr8w_profile: PROFILE, display_name: NAME },
    }),
  });
  const updateData = await updateRes.json();

  if (updateRes.ok) {
    console.log('\n✓ Existing user updated');
    console.log('  Email:   ', EMAIL);
    console.log('  Profile: ', PROFILE);
  } else {
    console.error('Update failed:', JSON.stringify(updateData, null, 2));
    process.exit(1);
  }
} else {
  console.error('Seed failed:', JSON.stringify(data, null, 2));
  process.exit(1);
}
