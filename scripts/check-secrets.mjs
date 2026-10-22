import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { stat } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const tracked = execFileSync('git', ['ls-files', '-co', '--exclude-standard'], { encoding: 'utf8' })
  .split('\n')
  .map(file => file.trim())
  .filter(Boolean);

const ignored = new Set(['node_modules', 'dist', 'build', '.git']);
const findings = [];
const placeholder = /(?:your_|example|placeholder|replace_|<[^>]+>|\$\{[^}]+\}|here\b)/i;
const checks = [
  { name: 'GitHub token', pattern: /\b(?:github_pat_|gh[opsu]_[A-Za-z0-9_]{20,})\b/g },
  { name: 'Notion token', pattern: /\b(?:secret_|ntn_)[A-Za-z0-9]{20,}\b/g },
  { name: 'OpenAI or Stripe live key', pattern: /\b(?:sk-(?:live|proj)-|sk_live_)[A-Za-z0-9_-]{16,}\b/g },
  { name: 'Google OAuth client secret', pattern: /\bGOCSPX-[A-Za-z0-9_-]{20,}\b/g },
  { name: 'Private key', pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
  { name: 'Embedded remote credential', pattern: /https?:\/\/[^\s/@]+:[^\s/@]+@/g },
];

for (const file of tracked) {
  if (file === 'scripts/check-secrets.mjs') continue;
  if (file.split(path.sep).some(part => ignored.has(part))) continue;
  let fileStat;
  try { fileStat = await stat(path.join(root, file)); } catch { continue; }
  if (!fileStat.isFile() || fileStat.size > 2_000_000) continue;
  const content = await readFile(path.join(root, file), 'utf8');
  for (const check of checks) {
    for (const match of content.matchAll(check.pattern)) {
      const lineStart = content.lastIndexOf('\n', match.index) + 2;
      const lineEnd = content.indexOf('\n', match.index);
      const line = content.slice(lineStart, lineEnd === -1 ? content.length : lineEnd);
      if (!placeholder.test(line)) {
        findings.push(`${file}:${content.slice(0, match.index).split('\n').length}: ${check.name}`);
      }
    }
  }

  // Catch accidental values assigned directly to sensitive environment keys.
  for (const match of content.matchAll(/^(?:export\s+)?(?:const\s+)?(NOTION_SECRET|SUPABASE_SERVICE_ROLE_KEY|GCAL_CLIENT_SECRET|CR8W_PASSWORD)\s*=\s*(.+)$/gm)) {
    if (!placeholder.test(match[2]) && !/^process\.env\./.test(match[2].trim())) {
      findings.push(`${file}:${content.slice(0, match.index).split('\n').length}: hard-coded ${match[1]}`);
    }
  }
}

if (findings.length) {
  console.error('Secret scan failed. Remove credentials from tracked files:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exitCode = 1;
} else {
  console.log(`Secret scan passed: ${tracked.length} tracked and untracked files checked.`);
}
