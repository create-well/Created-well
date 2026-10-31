import test from 'node:test';
import assert from 'node:assert/strict';
// Pure mirror of BlockedByInput draft logic in GeyserView.tsx, after the
// Copilot fixes for discussions r4372965864 and r4372965885.
// No React, no live record, no network, no Notion.
// Baseline is the focus-time value. Blur saves only draft !== baseline.
// Escape resets draft and baseline to the latest value, and keeps
// editing active until the actual blur event.
class Draft {
  constructor(value) { this.value = value; this.draft = value; this.baseline = value; this.editing = false; this.saved = []; }
  sync(value) { this.value = value; if (!this.editing) { this.draft = value; this.baseline = value; } }
  focus() { this.editing = true; this.baseline = this.value; this.draft = this.value; }
  change(v) { this.draft = v; }
  blur() { this.editing = false; if (this.draft !== this.baseline) { this.saved.push(this.draft); this.value = this.draft; this.baseline = this.draft; } else { this.draft = this.value; this.baseline = this.value; } }
  escape() { this.draft = this.value; this.baseline = this.value; }
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
test('Escape then type then refresh does not erase the new draft', () => {
  const d = new Draft('A'); d.focus(); d.change('C'); d.escape(); assert.equal(d.draft, 'A'); assert.equal(d.editing, true);
  d.change('D'); d.sync('B'); assert.equal(d.draft, 'D'); d.blur(); assert.deepEqual(d.saved, ['D']);
});
test('focus without type then refresh then blur saves nothing and adopts refreshed value', () => {
  const d = new Draft('A'); d.focus(); d.sync('B'); d.blur(); assert.deepEqual(d.saved, []); assert.equal(d.draft, 'B'); assert.equal(d.value, 'B');
});
test('Escape resets the baseline', () => {
  const d = new Draft('A'); d.focus(); d.change('C'); d.escape(); assert.equal(d.baseline, 'A'); d.blur(); assert.deepEqual(d.saved, []);
  const e = new Draft('A'); e.focus(); e.sync('B'); e.change('C'); e.escape(); assert.equal(e.baseline, 'B'); assert.equal(e.draft, 'B'); e.blur(); assert.deepEqual(e.saved, []);
});
test('Escape alone saves nothing on blur', () => {
  const d = new Draft('A'); d.focus(); d.change('X'); d.escape(); d.blur(); assert.deepEqual(d.saved, []);
});
test('stale text cannot overwrite refreshed data after blur', () => {
  const d = new Draft('A'); d.sync('B'); d.focus(); d.blur(); assert.deepEqual(d.saved, []); assert.equal(d.draft, 'B');
});
