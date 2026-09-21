/** Canonical Notion environment-variable configuration. */
export const NOTION_DB_ENV = {
  tasks: 'NOTION_DB_MOVES',
  stations: 'NOTION_DB_PEOPLE',
  forum: 'NOTION_DB_CONTENT',
  'coflow-dates': 'NOTION_DB_FLOWS',
  money: 'NOTION_DB_MONEY',
} as const;

export type NotionResource = keyof typeof NOTION_DB_ENV;

export function getNotionConfig() {
  return {
    secret: process.env.NOTION_SECRET,
    databaseIds: Object.fromEntries(
      Object.entries(NOTION_DB_ENV).map(([resource, envVar]) => [resource, process.env[envVar]]),
    ) as Record<NotionResource, string | undefined>,
  };
}
