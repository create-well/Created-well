// Client-side (VITE_ prefix, safe to expose in bundle)
const getMetaEnv = (key: string): string | undefined => {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return (import.meta.env as Record<string, string>)[key];
  }
  return undefined;
};

const getProcessEnv = (key: string): string | undefined => {
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key];
  }
  return undefined;
};

export const ENV = {
  DEV_BYPASS:    getMetaEnv('VITE_DEV_BYPASS') === 'true',
  SUPABASE_URL:  getMetaEnv('VITE_SUPABASE_URL') ?? '',
  SUPABASE_ANON: getMetaEnv('VITE_SUPABASE_ANON_KEY') ?? '',
  API_BASE:      getMetaEnv('VITE_API_BASE') ?? '',
} as const;

// Server-side (no VITE_ prefix, only available in api/ and supabase/functions/)
// Import this ONLY in api/ or server-only modules — never in src/app/
export const SERVER_ENV = {
  NOTION_SECRET:        () => getProcessEnv('NOTION_SECRET') ?? '',
  SUPABASE_URL:         () => getProcessEnv('SUPABASE_URL') ?? '',
  SUPABASE_SERVICE_KEY: () => getProcessEnv('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  // Required env vars — fail loudly if missing in production
  assertRequired(): void {
    const requiredKeys = [
      'NOTION_SECRET',
      'SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
      'NOTION_DB_MOVES',
      'NOTION_DB_PEOPLE',
      'NOTION_DB_FLOWS',
      'NOTION_DB_CONTENT',
      'NOTION_DB_MONEY',
    ];
    const missing = requiredKeys.filter(k => !getProcessEnv(k));
    if (missing.length > 0 && getProcessEnv('NODE_ENV') === 'production') {
      throw new Error(`Missing required server environment variables: ${missing.join(', ')}`);
    }
  },
} as const;
