// Restructure Phase 0 (spec D, amended 2026-11-14): the seven names.
// Pins the route change set, the redirect matrix, the label surfaces,
// the watched tab parameter, the waiting anchor, and the Kimi
// cross-check pin — the workshops tab's workshops-proper filter never
// renders an SLO Create series row (SLO Create is the core monthly
// offering, model of record 2026-11-14).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  isWorkshop,
  isBookClub,
  isSloCreateSeries,
} from '../src/lib/flows.ts';

const read = (rel) => readFile(new URL(rel, import.meta.url), 'utf8');

const routes = await read('../src/app/routes.ts');
const topNav = await read('../src/app/components/TopNav.tsx');
const rootLayout = await read('../src/app/RootLayout.tsx');
const systemPage = await read('../src/app/pages/SystemPage.tsx');
const community = await read('../src/app/components/CommunityEventsView.tsx');
const flowsPage = await read('../src/app/pages/FlowsPage.tsx');
const podyapsPage = await read('../src/app/pages/PodyapsPage.tsx');
const carePage = await read('../src/app/pages/PeoplePage.tsx');
const moneyPage = await read('../src/app/pages/MoneyPage.tsx');
const decisionsPage = await read('../src/app/pages/DecisionsPage.tsx');
const thisWeekPage = await read('../src/app/pages/ThisWeekPage.tsx');
const homePanels = await read('../src/app/components/HomePanels.tsx');

// ── Routes: seven live pages, five redirects, nothing else ──────────

test('routes: the seven section pages mount at the new paths', () => {
  const flat = routes.replace(/\s+/g, ' ');
  for (const [path, page] of [
    ['gatherings', 'FlowsPage'],
    ['making', 'PodyapsPage'],
    ['people', 'PeoplePage'],
    ['money', 'MoneyPage'],
    ['decisions', 'DecisionsPage'],
    ['system', 'SystemPage'],
  ]) {
    assert.ok(
      flat.includes(`path: '${path}', ...page(() => import('./pages/${page}'), '${page}')`),
      `${path} mounts ${page}`,
    );
  }
  assert.ok(flat.includes(`index: true, ...page(() => import('./pages/ThisWeekPage'), 'ThisWeekPage')`));
});

test('routes: old paths are redirect children with the specced targets', () => {
  const found = {};
  for (const m of routes.matchAll(/path: '(flows|workshops|podyaps|moves|care)',\s+\.\.\.redirect\('([^']+)'\)/g)) {
    found[m[1]] = m[2];
  }
  assert.deepEqual(found, {
    flows: '/gatherings',
    workshops: '/gatherings?tab=workshops',
    podyaps: '/making',
    moves: '/#waiting',
    care: '/people',
  });
  // No old path still mounts a page.
  assert.doesNotMatch(routes, /path: '(moves|care|flows|podyaps|workshops)',\s+\.\.\.page/);
  // The redirect rides Navigate with replace, per spec.
  assert.match(routes, /import \{ createBrowserRouter, Navigate \} from 'react-router'/);
  assert.match(routes, /createElement\(Navigate, \{ to, replace: true \}\)/);
});

// ── Nav and announcer: one name everywhere ──────────────────────────

test('TopNav: exactly the seven entries, in order, with the seven names', () => {
  const block = topNav.slice(topNav.indexOf('const NAV_ITEMS'), topNav.indexOf('];', topNav.indexOf('const NAV_ITEMS')));
  const pairs = [...block.matchAll(/\{ path: '([^']+)',\s+label: '([^']+)'/g)].map(m => [m[1], m[2]]);
  assert.deepEqual(pairs, [
    ['/', 'Today'],
    ['/gatherings', 'Gatherings'],
    ['/making', 'Making'],
    ['/people', 'People'],
    ['/money', 'Money'],
    ['/decisions', 'Decisions'],
    ['/system', 'System'],
  ]);
  // The Moves geyser dot went with Moves as a place; it is not retargeted.
  assert.doesNotMatch(topNav, /geyser-pulse-dot|mobile-menu-link-geyser/);
});

test('RootLayout: the announcer carries exactly the seven names', () => {
  const block = rootLayout.slice(rootLayout.indexOf('const VIEW_NAMES'), rootLayout.indexOf('};', rootLayout.indexOf('const VIEW_NAMES')));
  const pairs = [...block.matchAll(/'(\/[^']*)': '([^']+)'/g)].map(m => [m[1], m[2]]);
  assert.deepEqual(pairs, [
    ['/', 'Today'],
    ['/gatherings', 'Gatherings'],
    ['/making', 'Making'],
    ['/people', 'People'],
    ['/money', 'Money'],
    ['/decisions', 'Decisions'],
    ['/system', 'System'],
  ]);
});

test('RootLayout: MessageDrawer doors land on the new names', () => {
  assert.match(rootLayout, /onNavigateToForum=\{\(\) => \{ navigate\('\/\#waiting'\); \}\}/);
  assert.match(rootLayout, /onNavigateToGeyser=\{\(\) => \{ navigate\('\/\#waiting'\); \}\}/);
  // Packet CC leg 4: the movesDefaultTab setter is gone (dead state);
  // the door still lands on '/#waiting'.
  assert.match(rootLayout, /onNavigateToStations=\{\(\) => \{ navigate\('\/\#waiting'\); \}\}/);
  // Phase 3 (packet M §4, A6): the PlayD8s door split into the
  // vetting and team tabs; the prop is tab-parameterized now.
  assert.match(rootLayout, /onNavigateToPeople=\{\(tab\) => \{ navigate\(tab === 'vetting' \? '\/people\?tab=vetting' : '\/people\?tab=team'\); \}\}/);
});

// ── System page: architecture rows and inventory doors ──────────────

test('SystemPage: ROUTE_ARCHITECTURE is the seven rows with sources carried over', () => {
  const block = systemPage.slice(systemPage.indexOf('const ROUTE_ARCHITECTURE'), systemPage.indexOf('];', systemPage.indexOf('const ROUTE_ARCHITECTURE')));
  const pairs = [...block.matchAll(/\{ path: '([^']+)',\s+label: '([^']+)'/g)].map(m => [m[1], m[2]]);
  assert.deepEqual(pairs, [
    ['/', 'Today'],
    ['/gatherings', 'Gatherings'],
    ['/making', 'Making'],
    ['/people', 'People'],
    ['/money', 'Money'],
    ['/decisions', 'Decisions'],
    ['/system', 'System'],
  ]);
  assert.match(block, /'FLOWS hub — all Types · workshops'/);
  assert.match(block, /'PEOPLE hub \(messages, check-ins, well notes\)'/);
});

test('SystemPage: DataCountRow doors ride no redirect', () => {
  for (const [label, target] of [
    ['Tasks', '/#waiting'],
    ['Stations', '/#waiting'],
    ['Forum posts', '/'],
    ['Messages', '/people'],
    ['Workshops', '/gatherings'],
    ['CoFlow dates', '/gatherings'],
    ['Check-ins', '/people'],
  ]) {
    assert.match(systemPage, new RegExp(`label="${label}"[^>]*internalPath="${target.replace('/', '\\/')}"`), `${label} -> ${target}`);
  }
});

// ── Page titles ─────────────────────────────────────────────────────

test('page titles carry the new names', () => {
  assert.match(community, />\s*Gatherings\s*</);
  assert.doesNotMatch(community, />\s*Community Events\s*</);
  assert.match(podyapsPage, /Making 🎙️/);
  assert.match(podyapsPage, /Episodes and pieces, from topic to release\./);
  assert.match(podyapsPage, /← All gatherings/);
  assert.match(carePage, /restrictedTitle="People \(consent required\)"/);
  assert.doesNotMatch(moneyPage, /Money, Real Only/);
  assert.doesNotMatch(decisionsPage, /Monica's Decision Queue/);
  assert.doesNotMatch(systemPage, />\s*System Health\s*</);
});

test('PodyapsPage doors: backlink to Gatherings, CoFlow buttons to People', () => {
  assert.match(podyapsPage, /navigate\('\/gatherings'\)/);
  // Phase 3 (packet M §4): the CoFlow buttons land on the Team board
  // tab of the People surface. Phase 4 (packet S §4): the hero and
  // fallback sections that carried the two buttons retired in the
  // /making rebuild; the door survives once, beside the sessions
  // strip, and this pin now guards the single surviving door.
  assert.equal([...podyapsPage.matchAll(/navigate\('\/people\?tab=team'\)/g)].length, 1);
  assert.doesNotMatch(podyapsPage, /navigate\('\/(flows|care|podyaps)'\)/);
});

// ── The tab parameter: addressable, watched, with a fallback ───────

test('FlowsPage reads the tab parameter; only workshops is addressable', () => {
  assert.match(flowsPage, /useSearchParams/);
  assert.match(flowsPage, /searchParams\.get\('tab'\)/);
  assert.match(flowsPage, /defaultTab=\{tabParam === 'workshops' \? 'workshops' : undefined\}/);
});

test('CommunityEventsView watches its tab input, not only seeds it', () => {
  assert.match(community, /useEffect\(\(\) => \{\s+setActiveTab\(defaultTab\);\s+\}, \[defaultTab\]\)/);
});

test('CommunityEventsView tab buttons: Making door in, Workshops door out', () => {
  assert.match(community, /navigate\('\/making'\)/);
  assert.match(community, /Full Making view &amp; preflight/);
  assert.doesNotMatch(community, /navigate\('\/workshops'\)/);
  assert.doesNotMatch(community, /Full Workshops view/);
  assert.doesNotMatch(community, /navigate\('\/podyaps'\)/);
});

// ── The waiting anchor ──────────────────────────────────────────────

test('HomePanels: the Waiting On Us panel is the waiting anchor', () => {
  // Pin locator flipped by Phase 1 (packet H): the panel title is now
  // "Waiting On Us"; the anchor assertions below are unchanged.
  assert.match(homePanels, /id\?: string/);
  assert.match(homePanels, /<section className="home-panel" aria-label=\{title\} id=\{id\}>/);
  const tasksPanel = homePanels.slice(homePanels.indexOf('title="Waiting On Us"'), homePanels.indexOf('title="Waiting On Us"') + 320);
  assert.match(tasksPanel, /tag="WAITING"/);
  assert.match(tasksPanel, /id="waiting"/);
  assert.match(tasksPanel, /to="\/#waiting"/);
});

test('RootLayout: scroll-to-top skips hash-carrying arrivals (Phase 1 fix 2)', () => {
  // QA's trace on fix head 07eb8756: the settle-scroll landed, then
  // RootLayout's smooth scroll-to-top on the same /moves to /
  // navigation animated the page back to 0 and won. The guard gives
  // the anchor sole ownership of hash-carrying arrivals.
  assert.match(rootLayout, /if \(location\.hash\) return;\n    window\.scrollTo\(\{ top: 0, behavior: 'smooth' \}\)/);
});

test('HomePanels: the waiting panel scrolls into view on settle under #waiting (Phase 1 fix)', () => {
  // QA's 375px leg failed on head 5cb71fdd: the panel renders after
  // the fragment's scroll moment, so nothing brought it into view.
  // The fix scrolls on settle, gated on the hash and a settled
  // syncStatus, once per hash arrival.
  assert.match(homePanels, /location\.hash !== '#waiting'/);
  assert.match(homePanels, /data\.syncStatus === 'loading' \|\| data\.syncStatus === 'failed'/);
  assert.match(homePanels, /getElementById\('waiting'\)\?\.scrollIntoView\(\{ block: 'start' \}\)/);
});

test('ThisWeekPage: view targets are the new names, keys unchanged', () => {
  const block = thisWeekPage.slice(thisWeekPage.indexOf('const VIEW_ROUTE_MAP'), thisWeekPage.indexOf('};', thisWeekPage.indexOf('const VIEW_ROUTE_MAP')));
  const pairs = [...block.matchAll(/'?([\w-]+)'?: '([^']+)'/g)].map(m => [m[1], m[2]]);
  assert.deepEqual(pairs, [
    ['hub', '/'],
    ['geyser', '/#waiting'],
    ['community-events', '/gatherings'],
    ['podyaps', '/making'],
    ['workshops', '/gatherings?tab=workshops'],
    // Phase 3 (packet M §4.2): the coflow key renamed 'team' and
    // its target deepened to the Team board tab.
    ['team', '/people?tab=team'],
    ['playground', '/'],
  ]);
  // Packet CC leg 4: the movesDefaultTab setter is gone (dead state);
  // the handler still routes to '/#waiting'.
  assert.match(thisWeekPage, /handleNavigateGeyserStations\(\) \{\s+navigate\('\/\#waiting'\);/);
});

// ── The Kimi pin: SLO Create never renders inside the workshops tab ─

const flow = (extra) => ({
  id: 1, date: '2026-11-18', timeRange: '', location: '', rsvp: {},
  agendaItems: [], notes: '', vibeCheck: '', status: 'scheduled', ...extra,
});
// The exact composition WorkshopsTab applies (pinned to source below).
const workshopsShown = (flows) => flows.filter(f => isWorkshop(f) && !isSloCreateSeries(f));
const bookClubShown = (flows) => flows.filter(f => isBookClub(f) && !isSloCreateSeries(f));

test('SLO Create series rows are recognised by their filed name', () => {
  assert.equal(isSloCreateSeries(flow({ title: 'SLO Create (11/18)' })), true);
  assert.equal(isSloCreateSeries(flow({ title: 'SLO Create' })), true);
  assert.equal(isSloCreateSeries(flow({ title: 'Posing Workshop' })), false);
  assert.equal(isSloCreateSeries(flow({ theme: 'Workshop' })), false);
});

test('a workshop-typed SLO Create row never enters the workshops tab', () => {
  const slo = flow({ title: 'SLO Create (11/18)', flowType: 'Workshop' });
  const posing = flow({ title: 'Posing Workshop', flowType: 'Workshop' });
  assert.deepEqual(workshopsShown([slo, posing]), [posing]);
  const sloClub = flow({ title: 'SLO Create (12/16)', flowType: 'Book Club' });
  const club = flow({ title: 'The Artist\u2019s Way, Week 9', flowType: 'Book Club' });
  assert.deepEqual(bookClubShown([sloClub, club]), [club]);
});

test('the tab source carries the composed workshops-proper filter', () => {
  // Phase 2a locator flip (packet K §3): the exclusion is
  // field-first — seriesOf reads the projected Series field with
  // the name guard as its fallback — so the composed strings name
  // seriesOf, not isSloCreateSeries. The behavioral assertions
  // above are unchanged.
  assert.match(community, /flows\.filter\(f => isWorkshop\(f\) && seriesOf\(f\) !== 'SLO Create'\)/);
  assert.match(community, /flows\.filter\(f => isBookClub\(f\) && seriesOf\(f\) !== 'SLO Create'\)/);
});
