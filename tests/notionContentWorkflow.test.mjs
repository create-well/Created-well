import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const workflow = new URL('../.github/workflows/notion-content-sync.yml', import.meta.url);

test('live Notion sync stages newly generated content before checking for changes', async () => {
  const source = await readFile(workflow, 'utf8');

  assert.match(source, /git add --all -- content/);
  assert.match(source, /git diff --cached --quiet -- content/);
  assert.equal(source.includes('git diff --quiet -- content'), false);
});
