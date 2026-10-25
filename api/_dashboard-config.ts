const REQUIRED_DASHBOARD_ENV = [
  'NOTION_SECRET', 'NOTION_DB_MOVES', 'NOTION_DB_PEOPLE',
  'NOTION_DB_FLOWS', 'NOTION_DB_CONTENT', 'NOTION_DB_MONEY',
  'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY',
] as const;

/** Check presence only; never return configuration values to clients or logs. */
export function hasDashboardConfiguration(env: Record<string, string | undefined>): boolean {
  return REQUIRED_DASHBOARD_ENV.every(name => Boolean(env[name]?.trim()));
}
