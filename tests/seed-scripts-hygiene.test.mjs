// Seed-script credential hygiene: the seed scripts carried hardcoded
// password literals (flagged 2026-11-05; the values are never reproduced
// here). The cleanup moves every seed password to env-only reads under
// the name the admin script already used (CR8W_PASSWORD), each with the
// missing-env refusal the service-role key already had, and retires the
// username-map script's dead KV table name for the live table.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const authUser = readFileSync(new URL('../scripts/seed-auth-user.mjs', import.meta.url), 'utf8');
const mbAdmin = readFileSync(new URL('../scripts/seed-mb-admin.mjs', import.meta.url), 'utf8');
const userMap = readFileSync(new URL('../scripts/seed-username-map.mjs', import.meta.url), 'utf8');

test('no seed script assigns a password literal or prints one in its header', () => {
  for (const src of [authUser, mbAdmin]) {
    assert.doesNotMatch(src, /PASSWORD\s*=\s*['"][^'"]+['"]/);
    assert.doesNotMatch(src, /PASSWORD\s*=\s*process\.env\.CR8W_PASSWORD\s*\?\?\s*['"]/);
    assert.doesNotMatch(src, /Primary password:/);
    assert.doesNotMatch(src, /Alternative:/);
  }
});

test('both user-seed scripts read the password from CR8W_PASSWORD and refuse without it', () => {
  for (const src of [authUser, mbAdmin]) {
    assert.match(src, /const PASSWORD = process\.env\.CR8W_PASSWORD;/);
    assert.match(src, /if \(!PASSWORD\) \{\s*\n\s*console\.error\('Error: CR8W_PASSWORD env var is required\.'\)/);
    assert.match(src, /process\.exit\(1\)/);
  }
});

test('the seed targets and behavior are unchanged by the cleanup', () => {
  assert.match(authUser, /monny@createwell\.co/);
  assert.match(mbAdmin, /mb@tablante\.com/);
  assert.match(authUser, /auth\/v1\/admin\/users/);
  assert.match(mbAdmin, /auth\/v1\/admin\/users/);
});

test('the username-map script writes to the live KV table', () => {
  assert.match(userMap, /kv_store_dabe1c74/);
  assert.doesNotMatch(userMap, /kv_store_8dcd9693/);
});
