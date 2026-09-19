# Created-well

Vite + React SPA with Vercel Node Functions. Deployed to Vercel project
`createdwell`, team `monnylog`. Production domains: www.cr8w.com and
dash.cr8w.com. Data layer is Supabase plus Notion.

## Structure
- `src/**` — React SPA, bundled by Vite
- `api/**` — Vercel Node Functions, compiled separately by Vercel
- `api/server/[[...path]].ts` — optional catch-all for /api/server/*
- `src/lib/**` — shared; some files are imported by BOTH Vite and api/

## Hard rules
- Relative imports in `api/` and any `src/` file reachable from `api/`
  MUST carry a `.js` extension. Node ESM throws ERR_MODULE_NOT_FOUND
  without it. This has broken production twice.
- Never create both `api/x.ts` and `api/x/` — they collide on the same
  route and the flat file wins unpredictably.
- Files in `api/` prefixed with `_` are NOT deployed as Functions. Use
  that for shared logic.
- Never modify `vercel.json` rewrites without explicit instruction. The
  SPA fallback uses `/((?!api/).*)` to exempt /api/.

## Build and validate
- `npm run build` runs Vite only. It proves NOTHING about Function
  runtime behavior. A green build with broken APIs is the normal
  failure mode here.
- There is no test runner, no TypeScript compiler, no tsconfig. Do not
  assume `npm test` or `tsc` exists.
- Validate API changes against the PR's Vercel preview URL. Never
  against www.cr8w.com.
- Diagnose by status code: HTML 404 = routing, 500 = function crashed,
  JSON error body = function ran and routed wrong.

## PR instructions
- One concern per PR. Do not bundle a bug fix with tooling additions.
- In the PR body, include literal status codes and response bodies from
  the preview deployment for every endpoint touched.
- Quote diff lines as evidence. Do not report conclusions without them.
