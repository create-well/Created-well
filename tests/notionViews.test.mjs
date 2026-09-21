import test from 'node:test';
import assert from 'node:assert/strict';
import { privateTemplate, collaboratorTemplate } from '../templates/notionViews.mjs';

const links = (s) => [...s.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)].map((m) => m[1]);
const structure = (s) => s.split('\n').filter((line) => /^(#|##|<callout|<table|\t<tr>|\t\t<td>|- \[)/.test(line)).join('\n');

test('private template exposes internal controls and boundaries', () => {
  assert.match(privateTemplate, /^# CR8W Internal Operations Hub/m);
  assert.match(privateTemplate, /yellow_bg/);
  assert.match(privateTemplate, /Release and rollback/);
  assert.equal(links(privateTemplate).includes('https://cr8w.com'), true);
  assert.equal(privateTemplate.includes('credentials'), false);
});

test('collaborator template exposes shared entry points only', () => {
  assert.match(collaboratorTemplate, /^# CR8W Co-Creator Workspace/m);
  assert.match(collaboratorTemplate, /green_bg/);
  assert.match(collaboratorTemplate, /Collaboration rules/);
  assert.equal(links(collaboratorTemplate).includes('https://cr8w.com'), true);
  assert.equal(collaboratorTemplate.includes('Backup_Log'), false);
  assert.equal(collaboratorTemplate.includes('CRON_SECRET'), false);
});

test('template visual structure remains stable', () => {
  assert.match(structure(privateTemplate), /## Health snapshot/);
  assert.match(structure(privateTemplate), /## Release and rollback/);
  assert.match(structure(collaboratorTemplate), /## This week/);
  assert.match(structure(collaboratorTemplate), /## Collaboration rules/);
});
