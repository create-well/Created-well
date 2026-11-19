import React from 'react';
import { useSearchParams } from 'react-router';
import { useDashboard } from '../../contexts/DashboardContext';
import { ViewShell } from '../components/ViewShell';
import { resolveTabKey } from '../../lib/tabList';
import { peopleSurfaceRestricted } from '../../lib/peopleConsent';
import { EveryoneList } from '../components/people/EveryoneList';
import { FollowUpOwed } from '../components/people/FollowUpOwed';
import { TeamBoard } from '../components/people/TeamBoard';
import { VettingQueue } from '../components/people/VettingQueue';
import { InboxQueue } from '../components/people/InboxQueue';

// ── People (Phase 3, packet M) ──────────────────────────────────────────────
// The merged home of the old /care surface: PEOPLE records, the
// Playd8s vetting queue, and Open Asks counts. Replaces CarePage.
// The consent gate's application point is the A7 fork in
// src/lib/peopleConsent.ts: D1 (Monny, 2026-11-19) ships it
// CTA-scoped — the views render, and contact/scheduling actions
// suppress per person by their own consent state. The restricted
// form below remains the not-granted case (packet M §7), with the
// copy of record verbatim. Tab selection is addressable (?tab=) in
// the Gatherings pattern, so the drawer and hub deep links land on
// the named tab.

const TABS = [
  { key: 'everyone', label: 'Everyone' },
  { key: 'followups', label: 'Follow-Up Owed' },
  { key: 'team', label: 'Team' },
  { key: 'vetting', label: 'Vetting' },
  { key: 'inbox', label: 'Inbox' },
] as const;

type PeopleTab = (typeof TABS)[number]['key'];

function tabFromParam(raw: string | null): PeopleTab {
  return (TABS.some(t => t.key === raw) ? raw : 'everyone') as PeopleTab;
}

export function PeoplePage() {
  const { data, actions } = useDashboard();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = tabFromParam(searchParams.get('tab'));
  const tabRefs = React.useRef<(HTMLButtonElement | null)[]>([]);

  const selectTab = (key: PeopleTab) => {
    setSearchParams(key === 'everyone' ? {} : { tab: key }, { preventScrollReset: true });
  };

  const state =
    peopleSurfaceRestricted(data.permissions.careConsent) ? 'restricted' :
    data.syncStatus === 'loading' ? 'loading' :
    data.syncStatus === 'failed' ? 'failed' :
    data.syncStatus === 'stale' ? 'stale' :
    'fresh';

  return (
    <ViewShell
      state={state}
      restrictedTitle="People (consent required)"
      restrictedBody="Contact CTAs and scheduling are suppressed until consent is confirmed. Reach out directly to update your settings."
      onRetry={actions.retrySync}
    >
      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Tabs — ARIA tablist pattern (QA finding 2026-11-02): roving
            tabindex, arrows move and activate, Enter/Space activate
            the focused tab explicitly via src/lib/tabList. */}
        <div
          role="tablist"
          aria-label="People views"
          style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}
          onKeyDown={e => {
            const el = (e.target as HTMLElement).closest('[role="tab"]');
            if (!el) return;
            const idx = TABS.findIndex(t => `people-tab-${t.key}` === el.id);
            const result = resolveTabKey(e.key, idx, TABS.length);
            if (!result) return;
            e.preventDefault();
            selectTab(TABS[result.activateIndex].key);
            tabRefs.current[result.focusIndex]?.focus();
          }}
        >
          {TABS.map((t, i) => (
            <button
              key={t.key}
              ref={el => {
                tabRefs.current[i] = el;
              }}
              role="tab"
              id={`people-tab-${t.key}`}
              aria-selected={activeTab === t.key}
              aria-controls={`people-panel-${t.key}`}
              tabIndex={activeTab === t.key ? 0 : -1}
              onClick={() => selectTab(t.key)}
              style={{
                padding: '7px 14px',
                borderRadius: 999,
                border: '1px solid rgba(0,0,0,0.1)',
                background: activeTab === t.key ? 'var(--cr8w-primary, #7BA89D)' : '#fff',
                color: activeTab === t.key ? '#fff' : 'var(--cr8w-text, #2D2438)',
                fontFamily: 'var(--font-label)',
                fontSize: '0.75rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {activeTab === 'everyone' && (
          <div role="tabpanel" id="people-panel-everyone" aria-labelledby="people-tab-everyone">
            <EveryoneList />
          </div>
        )}
        {activeTab === 'followups' && (
          <div role="tabpanel" id="people-panel-followups" aria-labelledby="people-tab-followups">
            <FollowUpOwed />
          </div>
        )}
        {activeTab === 'team' && (
          <div role="tabpanel" id="people-panel-team" aria-labelledby="people-tab-team">
            <TeamBoard />
          </div>
        )}
        {activeTab === 'vetting' && (
          <div role="tabpanel" id="people-panel-vetting" aria-labelledby="people-tab-vetting">
            <VettingQueue />
          </div>
        )}
        {activeTab === 'inbox' && (
          <div role="tabpanel" id="people-panel-inbox" aria-labelledby="people-tab-inbox">
            <InboxQueue />
          </div>
        )}
      </div>
    </ViewShell>
  );
}
