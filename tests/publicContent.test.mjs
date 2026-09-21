import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('..', import.meta.url);
const readSource = (path) => readFile(new URL(path, root), 'utf8');

test('public content loader understands current and legacy sync metadata', async () => {
  const source = await readSource('./src/lib/content.ts');

  assert.match(source, /notionId \|\| frontmatter\.notion_page_id/);
  assert.match(source, /lastEdited \|\| frontmatter\.synced_at/);
  assert.match(source, /publishDate \|\| frontmatter\.published_at/);
  assert.match(source, /filter\(\(item\) => item\.audience\.trim\(\)\.toLowerCase\(\) === 'public'\)/);
});

test('public content routes bypass dashboard authentication only for content paths', async () => {
  const source = await readSource('./src/App.tsx');

  assert.match(source, /<Route path="\/content" element=\{<PublicContentIndex \/>\} \/>/);
  assert.match(source, /<Route path="\/content\/:slug" element=\{<PublicContentRoute \/>\} \/>/);
  assert.match(source, /<Route path="\*" element=\{<DashboardApp \/>\} \/>/);
});

test('public content rendering is dependency-free and uses the restricted local Markdown renderer', async () => {
  const [view, renderer] = await Promise.all([
    readSource('./src/views/PublicContent.tsx'),
    readSource('./src/components/MarkdownContent.tsx'),
  ]);

  assert.match(view, /<MarkdownContent markdown=\{item\.body \|\| item\.description\} \/>/);
  assert.match(view, /item\.publishedAt \|\| item\.syncedAt/);
  assert.match(view, /item\.publishedAt \? 'Published' : 'Updated'/);
  assert.equal(view.includes('dangerouslySetInnerHTML'), false);
  assert.equal(renderer.includes('dangerouslySetInnerHTML'), false);
  assert.match(renderer, /function safeUrl/);
});
