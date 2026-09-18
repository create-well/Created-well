/**
 * GET /api/ping
 *
 * A canary. Zero imports, zero env vars, zero network calls. Its only job is to
 * answer the question "are Vercel serverless functions running at all on this
 * deployment", so a 500 from /api/server or /api/dashboard can be attributed to
 * that function rather than to the platform, the build, or the router.
 *
 * Read it together with the other two:
 *   /api/ping   200 + /api/server/health 500 -> the server function itself
 *   /api/ping   500                          -> the build or the runtime
 *   both 200                                 -> routing and env, not code
 */
export default function handler(_req: unknown, res: {
  setHeader: (k: string, v: string) => void;
  status: (code: number) => { json: (body: unknown) => void };
}) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    ok: true,
    runtime: 'vercel',
    node: process.version,
    // Presence only. Never the values.
    env: {
      SUPABASE_URL: Boolean(process.env.SUPABASE_URL),
      SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      SUPABASE_SECRET_KEY: Boolean(process.env.SUPABASE_SECRET_KEY),
      SUPABASE_PUBLISHABLE_KEY: Boolean(process.env.SUPABASE_PUBLISHABLE_KEY),
      NOTION_SECRET: Boolean(process.env.NOTION_SECRET),
      NOTION_DB_MOVES: Boolean(process.env.NOTION_DB_MOVES),
      NOTION_DB_PEOPLE: Boolean(process.env.NOTION_DB_PEOPLE),
      NOTION_DB_FLOWS: Boolean(process.env.NOTION_DB_FLOWS),
      NOTION_DB_CONTENT: Boolean(process.env.NOTION_DB_CONTENT),
      NOTION_DB_MONEY: Boolean(process.env.NOTION_DB_MONEY),
      GCAL_CLIENT_SECRET: Boolean(process.env.GCAL_CLIENT_SECRET),
      VITE_API_BASE: Boolean(process.env.VITE_API_BASE),
    },
    at: new Date().toISOString(),
  });
}
