// Delegates all /api/server/* routes to api/_server.ts, which is the single
// source of truth for route logic, the TABLE constant, and the Supabase client.
// No route logic, no TABLE, no createClient here — api/_server.ts handles all of it.
export { default } from '../_server.js';
