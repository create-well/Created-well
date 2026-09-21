export interface RouteConfig {
  path: string;
  label: string;
  notionDb?: 'MOVES' | 'PEOPLE' | 'CONTENT' | 'FLOWS' | 'MONEY';
  requiredPermission: 'read' | 'write' | 'admin';
  featureFlag?: string; // if set, feature flag must be enabled to render
}

export const ROUTES: RouteConfig[] = [
  { path: '/',          label: 'Home',      notionDb: 'FLOWS',   requiredPermission: 'read' },
  { path: '/moves',     label: 'Moves',     notionDb: 'MOVES',   requiredPermission: 'read' },
  { path: '/care',      label: 'Care',      notionDb: 'PEOPLE',  requiredPermission: 'read' },
  { path: '/flows',     label: 'Flows',     notionDb: 'FLOWS',   requiredPermission: 'read' },
  { path: '/money',     label: 'Money',     notionDb: 'MONEY',   requiredPermission: 'write' },
  { path: '/decisions', label: 'Decisions',                      requiredPermission: 'write' },
  { path: '/system',    label: 'System',                         requiredPermission: 'admin' },
  { path: '/team',      label: 'Team',      notionDb: 'PEOPLE',  requiredPermission: 'read', featureFlag: 'team_page' },
] as const;

// Primary navigation tabs for header/nav bar
export const NAV_TABS = ROUTES.filter(r => !['/', '/system', '/team'].includes(r.path));
