// Class-killing pin (Phase 4 QA FAIL on 1cf7eca, fix requirement 2):
// routes.ts resolves every page by NAMED export — page(() =>
// import('<module>'), '<Name>') renders (await load())[name]. A page
// module with only a default export resolves to undefined and the
// route mounts an empty shell forever, invisible to tsc (dynamic
// lookup) and to derivation-level tests. This pin binds every page()
// name in routes.ts to a named export in its module, for all pages,
// so the class cannot recur on any route.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const routes = readFileSync(new URL('../src/app/routes.ts', import.meta.url), 'utf8');

const pageCalls = [...routes.matchAll(/page\(\(\) => import\('([^']+)'\), '([^']+)'\)/g)].map(
  (m) => ({ modulePath: m[1], name: m[2] }),
);

test('routes.ts declares page() bindings to check', () => {
  assert.ok(pageCalls.length >= 10, `expected at least 10 page bindings, found ${pageCalls.length}`);
});

test('every routes.ts page() name is a named export of its module', () => {
  const missing = [];
  for (const { modulePath, name } of pageCalls) {
    const url = new URL(`../src/app/${modulePath.replace(/^\.\//, '')}.tsx`, import.meta.url);
    let source;
    try {
      source = readFileSync(url, 'utf8');
    } catch {
      missing.push(`${name}: module ${modulePath} unreadable`);
      continue;
    }
    const namedExport = new RegExp(
      `export\\s+(?:async\\s+)?(?:function|const|class)\\s+${name}\\b|export\\s*\\{[^}]*\\b${name}\\b[^}]*\\}`,
    );
    if (!namedExport.test(source)) missing.push(`${name}: no named export in ${modulePath}`);
  }
  assert.deepEqual(missing, []);
});
