import test from 'node:test';
import assert from 'node:assert/strict';
import { getConfig, pageToFrontmatter, propertyValue, renderMdx } from '../scripts/notion-content-sync.mjs';

test('getConfig requires the Notion token and content data source', () => {
  assert.throws(() => getConfig({}), /NOTION_TOKEN/);
  const config = getConfig({ NOTION_TOKEN: 'token', NOTION_CONTENT_DATA_SOURCE_ID: 'collection://abc' });
  assert.equal(config.sourceId, 'abc');
  assert.equal(config.sourceKind, 'data_source');
  assert.equal(config.allowedStatuses[0], 'Published');
  assert.equal(config.dryRun, false);
});

test('legacy database configuration supports the Perplexity Space schema', () => {
  const config = getConfig({ NOTION_TOKEN: 'token', NOTION_CONTENT_DB: 'database-id' });
  assert.equal(config.sourceId, 'database-id');
  assert.equal(config.sourceKind, 'database');
  assert.equal(config.notionVersion, '2022-06-28');
  assert.equal(config.titleProperty, 'Content Title');
});

test('propertyValue normalizes common Notion property types', () => {
  assert.equal(propertyValue({ type: 'title', title: [{ plain_text: 'Create Well' }] }), 'Create Well');
  assert.equal(propertyValue({ type: 'rich_text', rich_text: [{ plain_text: 'Body' }] }), 'Body');
  assert.equal(propertyValue({ type: 'select', select: { name: 'Published' } }), 'Published');
  assert.equal(propertyValue({ type: 'multi_select', multi_select: [{ name: 'one' }, { name: 'two' }] }), 'one, two');
  assert.equal(propertyValue({ type: 'checkbox', checkbox: true }), true);
});

test('pageToFrontmatter uses an explicit slug and falls back safely to the title', () => {
  const config = getConfig({ NOTION_TOKEN: 'token', NOTION_CONTENT_DATA_SOURCE_ID: 'abc' });
  const page = {
    id: '11111111-2222-3333-4444-555555555555',
    url: 'https://notion.so/page',
    last_edited_time: '2026-08-27T00:00:00.000Z',
    properties: {
      Title: { type: 'title', title: [{ plain_text: 'Hello, Create Well!' }] },
      Status: { type: 'select', select: { name: 'Published' } },
      Type: { type: 'select', select: { name: 'essay' } },
      'Publish Date': { type: 'date', date: { start: '2026-08-27' } },
    },
  };
  const frontmatter = pageToFrontmatter(page, config);
  assert.equal(frontmatter.slug, 'hello-create-well');
  assert.equal(frontmatter.status, 'Published');
  assert.equal(frontmatter.publishDate, '2026-08-27');
  assert.equal(frontmatter.notionId, page.id);
});

test('renderMdx writes frontmatter and supported blocks', () => {
  const output = renderMdx({
    title: 'Flowing', slug: 'flowing', type: 'essay', audience: 'collective', description: 'A note',
    publishDate: '2026-08-27', status: 'Published', notionId: 'id', notionUrl: 'https://notion.so/id', lastEdited: 'now',
  }, [
    { type: 'heading_1', heading_1: { rich_text: [{ plain_text: 'Flowing > Forcing', annotations: {} }] } },
    { type: 'paragraph', paragraph: { rich_text: [
      { plain_text: 'A ', annotations: {} },
      { plain_text: 'living', annotations: { bold: true } },
      { plain_text: ' practice.', annotations: {} },
    ] } },
    { type: 'bulleted_list_item', bulleted_list_item: { rich_text: [{ plain_text: 'Arrive well', annotations: {} }] } },
  ]);
  assert.match(output, /^---\n/);
  assert.match(output, /title: "Flowing"/);
  assert.match(output, /publishDate: "2026-08-27"/);
  assert.match(output, /# Flowing > Forcing/);
  assert.match(output, /A \*\*living\*\* practice\./);
  assert.match(output, /- Arrive well/);
});
