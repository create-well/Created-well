import assert from 'node:assert/strict';
import test from 'node:test';
import { headersForApiRequest } from '../src/app/components/reportAuth.ts';

const baseHeaders = {
  'Content-Type': 'application/json',
  Authorization: 'Bearer public-publishable-key',
};

function storageWith(value) {
  return { getItem: (key) => key === 'cr8w_supabase_auth' ? value : null };
}

test('report requests use the top-level persisted access token', () => {
  const headers = headersForApiRequest(
    '/reports/history?from=2026-01-01',
    baseHeaders,
    storageWith(JSON.stringify({ access_token: 'user-access-token' })),
  );

  assert.equal(headers.Authorization, 'Bearer user-access-token');
  assert.equal(headers['Content-Type'], baseHeaders['Content-Type']);
});

test('report requests support the legacy currentSession access token', () => {
  const headers = headersForApiRequest(
    '/reports/conflicts',
    baseHeaders,
    storageWith(JSON.stringify({ currentSession: { access_token: 'legacy-user-token' } })),
  );

  assert.equal(headers.Authorization, 'Bearer legacy-user-token');
});

test('report requests omit Authorization when storage is missing', () => {
  for (const storage of [null, undefined]) {
    const headers = headersForApiRequest('/reports/history', baseHeaders, storage);
    assert.equal(Object.hasOwn(headers, 'Authorization'), false);
    assert.equal(headers['Content-Type'], baseHeaders['Content-Type']);
  }
});

test('report requests omit Authorization when stored JSON is malformed', () => {
  const headers = headersForApiRequest('/reports/history', baseHeaders, storageWith('{not json'));

  assert.equal(Object.hasOwn(headers, 'Authorization'), false);
});

test('report requests omit Authorization when storage access throws', () => {
  const storage = { getItem: () => { throw new Error('storage unavailable'); } };
  const headers = headersForApiRequest('/reports/history', baseHeaders, storage);

  assert.equal(Object.hasOwn(headers, 'Authorization'), false);
});

test('report requests omit Authorization when no access token exists', () => {
  const headers = headersForApiRequest('/reports/history', baseHeaders, storageWith(JSON.stringify({ user: {} })));

  assert.equal(Object.hasOwn(headers, 'Authorization'), false);
});

test('ordinary /tasks requests retain their base headers unchanged', () => {
  const headers = headersForApiRequest('/tasks', baseHeaders, storageWith(JSON.stringify({ access_token: 'user-token' })));

  assert.deepEqual(headers, baseHeaders);
});
