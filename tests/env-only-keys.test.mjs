// Register 1323 — the client keys come from env only. Both literal
// fallbacks were stale-generation copies (the api.ts publishable
// literal matched only an older env generation; the AuthGate anon
// JWT matched no env entry at all), so a build that ever ran
// without the env var silently served an old key — defeating the
// rotation the api.ts comment promised. Now: env is the only
// source, and a missing var throws at module init naming itself,
// so the failure is a loud boot error, never a silently dead app.
// This test pins shapes only; it never carries a key value.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const api = readFileSync(join(root, 'src/app/components/api.ts'), 'utf8');
const gate = readFileSync(join(root, 'src/app/components/AuthGate.tsx'), 'utf8');

test('api.ts reads the publishable key from env only, failing loudly when absent', () => {
  assert.ok(!api.includes('sb_publishable'));
  assert.ok(!api.includes('publicAnonKey'));
  assert.ok(api.includes('import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY'));
  assert.ok(api.includes("throw new Error('VITE_SUPABASE_PUBLISHABLE_KEY is not set"));
});

test('AuthGate reads the anon key from env only, failing loudly when absent', () => {
  assert.ok(!/eyJ[A-Za-z0-9_-]{10,}/.test(gate));
  assert.ok(gate.includes('import.meta.env.VITE_SUPABASE_ANON_KEY'));
  assert.ok(gate.includes("throw new Error('VITE_SUPABASE_ANON_KEY is not set"));
});
