import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  authorizeDashboardRequest,
  isProtectedReportRoute,
  isValidCronBearer,
  verifySupabaseUserToken,
} from '../api/_dashboard-auth.ts';

const adminEmails = ['mb@tablante.com'];
const verifiedAdmin = async () => ({ email: 'mb@tablante.com' });

function request(overrides = {}) {
  return {
    authorizationHeader: 'Bearer user-token',
    adminEmails,
    verifyUserToken: verifiedAdmin,
    ...overrides,
  };
}

test('cron authorization requires one exact Bearer token and a non-empty configured secret', () => {
  assert.equal(isValidCronBearer('Bearer cron-secret', 'cron-secret'), true);
  assert.equal(isValidCronBearer('bEaReR cron-secret', 'cron-secret'), true);
  assert.equal(isValidCronBearer('Bearer cron-secret ', 'cron-secret'), false);
  assert.equal(isValidCronBearer('Bearer cron-secret', undefined), false);
  assert.equal(isValidCronBearer('Bearer cron-secret', ''), false);
  assert.equal(isValidCronBearer(undefined, 'cron-secret'), false);
  assert.equal(isValidCronBearer(['Bearer cron-secret'], 'cron-secret'), false);
});

test('configured exact cron token is authorized without verifying a user', async () => {
  let verifierCalled = false;
  const decision = await authorizeDashboardRequest(request({
    authorizationHeader: 'Bearer cron-secret',
    cronSecret: 'cron-secret',
    verifyUserToken: async () => {
      verifierCalled = true;
      return null;
    },
  }));
  assert.deepEqual(decision, { authorized: true, via: 'cron' });
  assert.equal(verifierCalled, false);
});

test('missing cron secret never authorizes the cron bearer as cron', async () => {
  const decision = await authorizeDashboardRequest(request({
    authorizationHeader: 'Bearer cron-secret',
    cronSecret: undefined,
    verifyUserToken: async () => null,
  }));
  assert.deepEqual(decision, { authorized: false, status: 401 });
});

test('missing, non-Bearer, and array authorization headers return 401', async (t) => {
  for (const [name, authorizationHeader] of [
    ['missing', undefined],
    ['non-Bearer', 'Basic user-token'],
    ['multiple values', ['Bearer user-token', 'Bearer other-token']],
    ['comma-joined multiple values', 'Bearer user-token, Bearer other-token'],
  ]) {
    await t.test(name, async () => {
      const decision = await authorizeDashboardRequest(request({ authorizationHeader }));
      assert.deepEqual(decision, { authorized: false, status: 401 });
    });
  }
});

test('invalid and expired user tokens return 401 when verification finds no user', async (t) => {
  for (const token of ['invalid-token', 'expired-token']) {
    await t.test(token, async () => {
      const decision = await authorizeDashboardRequest(request({
        authorizationHeader: `Bearer ${token}`,
        verifyUserToken: async () => null,
      }));
      assert.deepEqual(decision, { authorized: false, status: 401 });
    });
  }
});

test('verified non-admin users and users with missing email return 403', async (t) => {
  for (const [name, user] of [
    ['non-admin', { email: 'person@example.com' }],
    ['missing email', {}],
    ['null email', { email: null }],
  ]) {
    await t.test(name, async () => {
      const decision = await authorizeDashboardRequest(request({
        verifyUserToken: async () => user,
      }));
      assert.deepEqual(decision, { authorized: false, status: 403 });
    });
  }
});

test('case-normalized allowlisted email is authorized as a user', async () => {
  const decision = await authorizeDashboardRequest(request({
    verifyUserToken: async () => ({ email: ' MB@TABLANTE.COM ' }),
  }));
  assert.deepEqual(decision, { authorized: true, via: 'user' });
});

test('verifier exceptions fail closed with 503', async () => {
  const decision = await authorizeDashboardRequest(request({
    verifyUserToken: async () => {
      throw new Error('Auth service unavailable');
    },
  }));
  assert.deepEqual(decision, { authorized: false, status: 503 });
});

test('Supabase adapter forwards the exact token and only the verified user email', async () => {
  let receivedToken;
  const decision = await authorizeDashboardRequest(request({
    verifyUserToken: (token) => verifySupabaseUserToken(async (exactToken) => {
      receivedToken = exactToken;
      return {
        data: { user: { email: 'mb@tablante.com', id: 'not-forwarded' } },
        error: null,
      };
    }, token),
  }));
  assert.equal(receivedToken, 'user-token');
  assert.deepEqual(decision, { authorized: true, via: 'user' });
});

test('Supabase returned credential rejection statuses map to 401', async (t) => {
  for (const status of [400, 401, 403]) {
    await t.test(`status ${status}`, async () => {
      const decision = await authorizeDashboardRequest(request({
        verifyUserToken: (token) => verifySupabaseUserToken(async () => ({
          data: { user: null },
          error: { status },
        }), token),
      }));
      assert.deepEqual(decision, { authorized: false, status: 401 });
    });
  }
});

test('Supabase returned server, unavailable, and statusless errors map to 503', async (t) => {
  for (const error of [{ status: 500 }, { status: 503 }, new Error('network unavailable')]) {
    await t.test(error.status ? `status ${error.status}` : 'statusless error', async () => {
      const decision = await authorizeDashboardRequest(request({
        verifyUserToken: (token) => verifySupabaseUserToken(async () => ({ error }), token),
      }));
      assert.deepEqual(decision, { authorized: false, status: 503 });
    });
  }
});

test('a thrown Supabase getUser failure propagates to policy-level 503', async () => {
  const decision = await authorizeDashboardRequest(request({
    verifyUserToken: (token) => verifySupabaseUserToken(async () => {
      throw new Error('getUser rejected');
    }, token),
  }));
  assert.deepEqual(decision, { authorized: false, status: 503 });
});

test('history and CSV selectors authorize before sync and report reads', () => {
  const server = readFileSync(new URL('../api/server.ts', import.meta.url), 'utf8');
  const historyStart = server.indexOf("if (isProtectedReportRoute(resource ?? '', id ?? '') && (id === 'history' || id === 'history.csv')) {");
  const conflictsStart = server.indexOf("if (isProtectedReportRoute(resource ?? '', id ?? '') && id === 'conflicts' && method === 'GET') {");
  assert.notEqual(historyStart, -1, 'history selector includes history and history.csv');
  assert.notEqual(conflictsStart, -1, 'conflicts selector is limited to GET');
  const historyBlock = server.slice(historyStart, conflictsStart);
  const authIndex = historyBlock.indexOf('await dashboardAuth(req, res)');
  assert.notEqual(authIndex, -1);
  for (const read of [
    'await syncWorkspaceToDatabase()',
    "sb.from('well_notes').select(",
    "sb.from('care_loop_checkins').select(",
  ]) {
    assert.ok(authIndex < historyBlock.indexOf(read), `dashboardAuth must precede ${read}`);
    assert.notEqual(historyBlock.indexOf(read), -1, `expected history read ${read}`);
  }
  assert.ok(authIndex < historyBlock.indexOf('const sb = supabase()'), 'dashboardAuth must precede service-role client setup');
});

test('conflicts GET selector authorizes before the conflicts query', () => {
  const server = readFileSync(new URL('../api/server.ts', import.meta.url), 'utf8');
  const conflictsStart = server.indexOf("if (isProtectedReportRoute(resource ?? '', id ?? '') && id === 'conflicts' && method === 'GET') {");
  const conflictsEnd = server.indexOf('\n    // ── Forum replies', conflictsStart);
  assert.notEqual(conflictsStart, -1, 'conflicts selector includes GET');
  assert.notEqual(conflictsEnd, -1, 'conflicts route block has a following boundary');
  const conflictsBlock = server.slice(conflictsStart, conflictsEnd);
  const authIndex = conflictsBlock.indexOf('await dashboardAuth(req, res)');
  const queryIndex = conflictsBlock.indexOf("await supabase().from('workspace_sync_conflicts').select(");
  assert.notEqual(authIndex, -1);
  assert.notEqual(queryIndex, -1);
  assert.ok(authIndex < queryIndex, 'dashboardAuth must precede the conflicts query');
});

test('only the three specified reports routes are protected', () => {
  assert.equal(isProtectedReportRoute('reports', 'history'), true);
  assert.equal(isProtectedReportRoute('reports', 'history.csv'), true);
  assert.equal(isProtectedReportRoute('reports', 'conflicts'), true);
  assert.equal(isProtectedReportRoute('reports', 'other'), false);
  assert.equal(isProtectedReportRoute('tasks', 'history'), false);
});
