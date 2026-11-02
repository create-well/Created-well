import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeContent, normalizeEvent } from '../src/lib/notionNormalizer.ts';
import { readContentFlowRelation, flowPageUrl, workingContentRows } from '../src/lib/contentFlowRelation.ts';

// All page identifiers and labels are synthetic. Two independent Events
// share a Flow and timestamp; they are not deduplicated or joined to content.
const flow = '11111111-1111-4111-8111-111111111111';
const contentIds = ['22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333'];
const eventIds = ['44444444-4444-4444-8444-444444444444', '55555555-5555-4555-8555-555555555555'];
const rel = (ids, has_more = false) => ({type:'relation', relation: ids.map(id => ({id})), has_more});
const page = (id, props) => ({ id, created_time:'2026-01-01T00:00:00Z', last_edited_time:'2026-01-01T00:00:00Z', properties:props });
const title = t => ({type:'title', title:[{plain_text:t, href:null}]});

test('many-to-one: two content rows and two independent same-time Events remain distinct', () => {
  const contents = contentIds.map((id, i) => normalizeContent(page(id, { Name:title(`[ ] content ${i}`), Flow:rel([flow]) })));
  const events = eventIds.map((id, i) => normalizeEvent(page(id, { Event:title(`[ ] event ${i}`), Date:{type:'date', date:{start:'2026-01-01T00:00:00Z'}}, Flow:rel([flow]) })));
  const renderedRows = workingContentRows(contents);
  assert.equal(renderedRows.length, 2);
  assert.deepEqual(renderedRows.map(c => c.notionPageId), contentIds);
  assert.deepEqual(workingContentRows([...contents].reverse()).map(c => c.notionPageId), [...contentIds].reverse());
  assert.equal(contents.length, 2);
  assert.deepEqual(contents.map(c => c.notionPageId), contentIds);
  assert.deepEqual(contents.map(c => c.flowRelation), [{ids:[flow], complete:true}, {ids:[flow], complete:true}]);
  assert.deepEqual(events.map(e => e.notionPageId), eventIds);
  assert.equal(events[0].date, events[1].date);
  assert.ok(events.every(e => !('flowId' in e) && !('flowRelation' in e)));
});

test('full identifiers are preserved and links never use truncated IDs', () => {
  const second='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const r=readContentFlowRelation(rel([flow,second]));
  assert.deepEqual(r, {ids:[flow,second], complete:true});
  assert.equal(flowPageUrl(flow), 'https://app.notion.com/p/11111111111141118111111111111111');
  assert.equal(flowPageUrl('1111111'), null);
});

test('missing and wrong types are unknown; only an explicitly complete empty relation is empty', () => {
  assert.equal(readContentFlowRelation(undefined),null);
  assert.equal(readContentFlowRelation({type:'select',select:null}),null);
  assert.deepEqual(readContentFlowRelation(rel([])),{ids:[],complete:true});
  assert.deepEqual(readContentFlowRelation({type:'relation',relation:[]}),{ids:[],complete:false});
});

test('truncated and invalid relation items are explicitly incomplete', () => {
  assert.deepEqual(readContentFlowRelation(rel([flow],true)),{ids:[flow],complete:false});
  assert.deepEqual(readContentFlowRelation(rel([flow,'short'])),{ids:[flow],complete:false});
  assert.deepEqual(readContentFlowRelation(rel([flow,flow.replaceAll('-','')])),{ids:[flow],complete:true});
});
