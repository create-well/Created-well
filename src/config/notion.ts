// Hub CMS four — the only approved write targets for the dashboard
const getEnv = (key: string): string | undefined => {
  if (typeof process !== 'undefined' && process?.env) {
    return process.env[key];
  }
  return undefined;
};

export const NOTION_DB = {
  MOVES:   getEnv('NOTION_DB_MOVES')   ?? '49faf1111bbe43458c3e6a4dcec63b5c',
  PEOPLE:  getEnv('NOTION_DB_PEOPLE')  ?? '81fc482da44d43cb9c426952654944ab',
  CONTENT: getEnv('NOTION_DB_CONTENT') ?? '08a0e011142a4512a3dc8075800db7db',
  FLOWS:   getEnv('NOTION_DB_FLOWS')   ?? '8d9ebf0c04cb47219ca2e3942cee6212',
  MONEY:   getEnv('NOTION_DB_MONEY')   ?? 'acc5fe2fdeca4f8989e179e32ddbc24d',
} as const;

// Write policy — MONEY is read-only until Phase 2
export const NOTION_WRITE_POLICY = {
  MOVES:   'read-write',
  PEOPLE:  'read-write',
  CONTENT: 'read-write',
  FLOWS:   'read-write',
  MONEY:   'read-only', // Phase 2
} as const;

// Blocked IDs — operational five; never write these from the dashboard
export const NOTION_BLOCKED_IDS = {
  // These are the operational five under Backend Hub, used only by edge sync scripts.
  // If you see these in api/ code, it is a bug.
  MOVES_OPS:   '3da8c56469e948e489836ea8773d6354',
  PEOPLE_OPS:  'ea53d1eddde243adb0344582cbeaf4c5',
  FLOWS_OPS:   '17d69cdfab1f4bb78ba197ec0a829ff5',
  CONTENT_OPS: 'bffdc8056b984515935b9496524198f8',
} as const;

export const NOTION_PAGES = {
  OS:                '9eea1136406942b389dffbaf66a64535',
  MASTER:            '7b4774c7e9ad4333841dd757a4b1c1df',
  BACKEND_HUB:       '3c324acf799d81f58671deedd964af1b',
  API_REGISTRY:      'd540a31113ed4b5db64d534c5910f020',
  SKILL_ENGINEERING: 'f233b9d2bce943a1a11f95eec52d7292',
  SKILL_OPS_TRIAGE:  'fe425fadb1734a81a80c8bc409a66365',
  VIEW_CONTRACTS:    'ad57b157668e4dbfa4c3f48823c0fa24',
} as const;

// Validation: call this at server startup / query execution to guard against wrong DB set
export function assertNotionIdNotBlocked(id: string, context: string): void {
  const blocked = Object.values(NOTION_BLOCKED_IDS);
  if (blocked.includes(id as any)) {
    throw new Error(`[notion] Blocked operational DB ID (${id}) used in ${context}. Use hub CMS IDs only.`);
  }
}
