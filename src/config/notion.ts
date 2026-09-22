import { getServerEnv } from './env.js';

export const NOTION_DB_KEYS = ['MOVES', 'PEOPLE', 'FLOWS', 'CONTENT', 'MONEY'] as const;
export type NotionDbKey = (typeof NOTION_DB_KEYS)[number];

const ENV_BY_DB: Record<NotionDbKey, string> = {
  MOVES: 'NOTION_DB_MOVES',
  PEOPLE: 'NOTION_DB_PEOPLE',
  FLOWS: 'NOTION_DB_FLOWS',
  CONTENT: 'NOTION_DB_CONTENT',
  MONEY: 'NOTION_DB_MONEY',
};

export const NOTION_DB_ENV_KEYS = ENV_BY_DB;

/** Resolve only the configured server-side database IDs; no production IDs are bundled. */
export function getNotionDb(key: NotionDbKey): string | undefined {
  return getServerEnv(ENV_BY_DB[key]);
}

export const NOTION_WRITE_POLICY: Record<NotionDbKey, 'read-write' | 'read-only'> = {
  MOVES: 'read-write',
  PEOPLE: 'read-write',
  FLOWS: 'read-write',
  CONTENT: 'read-write',
  MONEY: 'read-only',
};

export function assertWritable(dbKey: NotionDbKey, context: string): void {
  if (NOTION_WRITE_POLICY[dbKey] === 'read-only') {
    throw new Error(`[sync] ${dbKey} is configured as read-only — write blocked in ${context}.`);
  }
}
