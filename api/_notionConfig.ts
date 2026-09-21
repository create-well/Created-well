import { NOTION_DB, assertNotionIdNotBlocked } from '../src/config/notion.js';

/** Canonical Notion environment-variable configuration & DB accessors. */
export const NOTION_DB_ENV = {
  tasks:          'NOTION_DB_MOVES',
  stations:       'NOTION_DB_PEOPLE',
  forum:          'NOTION_DB_CONTENT',
  'coflow-dates': 'NOTION_DB_FLOWS',
  money:          'NOTION_DB_MONEY',
} as const;

export type NotionResource = keyof typeof NOTION_DB_ENV;

export function getNotionConfig() {
  const dbMap: Record<NotionResource, string> = {
    tasks:          NOTION_DB.MOVES,
    stations:       NOTION_DB.PEOPLE,
    forum:          NOTION_DB.CONTENT,
    'coflow-dates': NOTION_DB.FLOWS,
    money:          NOTION_DB.MONEY,
  };

  for (const [resource, id] of Object.entries(dbMap)) {
    if (id) {
      assertNotionIdNotBlocked(id, `getNotionConfig:${resource}`);
    }
  }

  return {
    secret: process.env.NOTION_SECRET,
    databaseIds: dbMap,
  };
}
