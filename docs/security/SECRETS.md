# Created Well Secret Management

## Scope

This repository contains configuration contracts and secret-consuming code, but it must never contain live credentials. Provider credentials are created in the provider’s own dashboard, stored in the deployment platform’s encrypted environment-variable store, and supplied locally through an ignored `.env.local` file or an approved local secret manager.

Authentication must not be bypassed. If access is missing, request the minimum required role from the repository or service owner. Do not paste tokens into chat, commit them, place them in URLs, or add them to `VITE_*` variables unless the provider explicitly documents the value as public.

## Classification

| Variable group | Classification | Allowed location |
| --- | --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY`, `NOTION_SECRET`, `GCAL_CLIENT_SECRET`, `CR8W_PASSWORD` | Secret | Vercel/server environment, local `.env.local`, or approved secret manager only |
| `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_GCAL_CLIENT_ID`, `VITE_APP_PASSWORD_HASH` | Browser-visible configuration | Source only if intentionally public; otherwise environment configuration; never treat as a secret boundary |
| `SUPABASE_URL`, Notion database IDs, iCal URLs | Configuration; sensitivity depends on provider | Sanitized example files and deployment configuration; validate access controls separately |
| GitHub, npm, Figma registry, and provider access tokens | Secret | GitHub/developer account secret store or deployment secret store only |

## Provisioning procedure

1. Create or rotate the credential in the provider’s official dashboard while signed into the authorized account. Select the narrowest scopes and shortest practical expiration.
2. Store the value immediately in the deployment platform’s encrypted environment-variable settings and, for local work, in `.env.local` or a platform-approved secret manager. Never add the value to `.env.local.example`.
3. Verify the application using a health check or least-privilege read operation. Do not print the credential, include it in logs, or echo the environment.
4. Run `npm run check:secrets`, `npm test`, and `npm run check` before committing. Use `git diff --cached` to inspect staged content.
5. Record only the provider, variable name, scope, owner, and rotation date in the team’s private operations record. Do not record the credential itself.

## Rotation and incident response

Rotate immediately if a credential is pasted into chat, appears in a commit, is included in a URL, or is exposed in logs. Revoke the old credential first when the provider supports immediate revocation, create a replacement with equivalent or narrower scope, update deployment and local stores, verify health, and then remove the exposed value from working files. If it entered Git history, rewrite history only through the repository owner’s approved process; deleting the current file is not sufficient.

The GitHub token previously pasted in this project conversation must be considered compromised and revoked by its owner. This repository does not use it, and no replacement token should be generated automatically by an agent.

## Local checks

The repository includes a dependency-free scanner:

```bash
npm run check:secrets
```

The scanner checks tracked and untracked non-ignored files for common GitHub, Notion, OAuth, private-key, embedded-credential, and hard-coded server-secret patterns. It intentionally allows sanitized placeholders such as `your_service_role_key_here`.
