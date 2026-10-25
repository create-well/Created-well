import test from 'node:test';
import assert from 'node:assert/strict';
// Pure mirror of BlockedByInput draft logic in GeyserView.tsx.
// No React, no live record, no network, no Notion.
class Draft {
  constructor(value) { this.value = value; this.draft = value; this.editing = false; this.saved = []; }
  sync(value) { this.value = value; if (!this.editing) this.draft = value; }
  focus() { this.editing = true; }
  change(v) { this.draft = v; }
  blur() { this.editing = false; if (this.draft !== this.value) { this.saved.push(this.draft); this.value = this.draft; } }
  escape() { this.draft = this.value; this.editing = false; }
}
test('syncs external update when not editing', () => {
  const d = new Draft('A'); d.sync('B'); assert.equal(d.draft, 'B'); assert.deepEqual(d.saved, []);
});
test('does not overwrite draft while editing', () => {
  const d = new Draft('A'); d.focus(); d.change('A edited'); d.sync('B'); assert.equal(d.draft, 'A edited');
});
test('blur saves changed value', () => {
  const d = new Draft('A'); d.focus(); d.change('C'); d.blur(); assert.deepEqual(d.saved, ['C']);
});
test('blur with no change saves nothing', () => {
  const d = new Draft('A'); d.focus(); d.blur(); assert.deepEqual(d.saved, []);
});
test('blur with empty draft saves empty string, clear preserved', () => {
  const d = new Draft('A'); d.focus(); d.change(''); d.blur(); assert.deepEqual(d.saved, ['']);
});
test('escape restores value and saves nothing', () => {
  const d = new Draft('A'); d.focus(); d.change('X'); d.escape(); assert.equal(d.draft, 'A'); assert.deepEqual(d.saved, []);
});
test('stale text cannot overwrite refreshed data after blur', () => {
  const d = new Draft('A'); d.sync('B'); d.focus(); d.blur(); assert.deepEqual(d.saved, []);
});
test('external update after blur syncs again', () => {
  const d = new Draft('A'); d.focus(); d.change('C'); d.blur(); d.sync('D'); assert.equal(d.draft, 'D');
});
