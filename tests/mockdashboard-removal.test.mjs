// Kimi Fix 4: src/lib/mockDashboard.ts was dead code — a full fake
// DashboardPayload with zero importers in src/, api/, or tests
// (grep-verified at every check since the support pass). The D-1
// composition was the last thing that touched it (a type-completeness
// line), which is why the removal waited for that landing. This guard
// keeps it from quietly returning: the file stays gone and nothing
// imports the module path.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

test('mockDashboard module is gone', () => {
  assert.equal(existsSync(join(root, 'src/lib/mockDashboard.ts')), false);
});

test('nothing imports the mockDashboard module', () => {
  const offenders = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p); }
      else if (/\.(ts|tsx|mjs)$/.test(e.name)) {
        if (readFileSync(p, 'utf8').includes('mockDashboard')) offenders.push(p);
      }
    }
  };
  walk(join(root, 'src')); walk(join(root, 'api'));
  assert.deepEqual(offenders, []);
});
