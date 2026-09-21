import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('..', import.meta.url);

test('failure alert workflow covers publishing, build, and deployment failures with repository issues', async () => {
  const source = await readFile(new URL('./.github/workflows/failure-alert.yml', root), 'utf8');

  assert.match(source, /^name: Create Well failure alert/m);
  assert.match(source, /workflow_run:/);
  assert.match(source, /- Notion content to website/);
  assert.match(source, /- NodeJS build/);
  assert.match(source, /deployment_status:/);
  assert.match(source, /issues: write/);
  assert.match(source, /github\.event\.workflow_run\.conclusion == 'failure'/);
  assert.match(source, /github\.event\.deployment_status\.state == 'failure'/);
  assert.match(source, /github\.event\.deployment_status\.state == 'error'/);
  assert.match(source, /actions\/github-script@v7/);
  assert.match(source, /createwell-failure-alert/);
  assert.match(source, /github\.rest\.issues\.create/);
  assert.match(source, /github\.rest\.issues\.createComment/);
});
