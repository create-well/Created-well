/** Server-only environment access. Never import this module from browser components. */
export function getServerEnv(name: string): string | undefined {
  return typeof process !== 'undefined' ? process.env[name] : undefined;
}

export function requireServerEnv(name: string): string {
  const value = getServerEnv(name);
  if (!value) throw new Error(`Missing required server environment variable: ${name}`);
  return value;
}

export const SERVER_ENV_KEYS = {
  NOTION_SECRET: 'NOTION_SECRET',
  SUPABASE_URL: 'SUPABASE_URL',
  SUPABASE_SERVICE_ROLE_KEY: 'SUPABASE_SERVICE_ROLE_KEY',
} as const;
