import React from 'react';
import { Link } from 'react-router';
import { useDashboard } from '../../contexts/DashboardContext';
import {
  nextUpFlow,
  isEmergenceDay,
  nextUpDateLabel,
  homeTasks,
  taskDueLabel,
  startingSoon,
  contentReadyCounts,
  syncCareCount,
  peopleCareValue,
} from '../../lib/homePanels';
import { shortDateLabel } from '../../lib/dateLabel';

/**
 * FE-5 — the settled Home (design diff §4, D9–D15). Five panels in
 * the fixed order, each with a short source-only depth tag (D12 as
 * amended) and one primary action. Counts only where §4 says counts
 * only; money never appears here (D15). Derivations live in
 * lib/homePanels.ts; a source the payload does not carry renders
 * "no records yet," never a zero that reads as all-clear.
 */

function DepthTag({ children }: { children: React.ReactNode }) {
  return <span className="home-depth-tag">{children}</span>;
}

function Panel({
  title,
  tag,
  action,
  children,
}: {
  title: string;
  tag?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="home-panel" aria-label={title}>
      <div className="home-panel-head">
        <h2 className="home-panel-title">{title}</h2>
        {tag ? <DepthTag>{tag}</DepthTag> : null}
      </div>
      <div className="home-panel-body">{children}</div>
      {action ? <div className="home-panel-action">{action}</div> : null}
    </section>
  );
}

function flowTitle(f: { theme?: string; flowType?: string }): string {
  return f.theme || f.flowType || 'Co-flow session';
}

export function HomePanels({
  onNavigate,
}: {
  onNavigate: (view: string) => void;
}) {
  const { data } = useDashboard();
  const now = new Date();

  const next = nextUpFlow(data.coFlowDates, now);
  const tasks = homeTasks(data.tasks);
  const soon = startingSoon(data.coFlowDates, now);
  const content = contentReadyCounts(data.forum);
  const syncCare = syncCareCount(data.syncFreshness);
  const peopleCare = peopleCareValue(data.peopleCare);

  return (
    <div className="home-panels">
      <Panel
        title="Next up"
        tag="FLOWS"
        action={
          <button type="button" className="home-action-link" onClick={() => onNavigate('community-events')}>
            See all gatherings →
          </button>
        }
      >
        {next ? (
          <>
            <div className="home-next-title">{flowTitle(next)}</div>
            <div className="home-next-date">{nextUpDateLabel(next)}</div>
            {isEmergenceDay(next, now) ? (
              <div className="home-geyser-marker">
                <span aria-hidden="true">⛲</span> Today — geyser day. This one emerges today.
              </div>
            ) : null}
          </>
        ) : (
          <p className="home-empty">Nothing coming up yet.</p>
        )}
      </Panel>

      <Panel
        title="Tasks"
        tag="MOVES"
        action={
          <Link className="home-action-link" to="/moves">
            Open Tasks →
          </Link>
        }
      >
        {tasks.length > 0 ? (
          <>
            <div className="home-metric-row">
              <span className="home-metric">{tasks.length}</span>
              <span className="home-metric-label">open</span>
            </div>
            <ul className="home-task-list">
              {tasks.slice(0, 5).map((t) => (
                <li key={t.id} className="home-task-row">
                  <span className="home-task-title">{t.title}</span>
                  <span className="home-task-due">{taskDueLabel(t)}</span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="home-empty">No open tasks.</p>
        )}
      </Panel>

      <Panel
        title="Starting soon"
        tag="FLOWS"
        action={
          <button type="button" className="home-action-link" onClick={() => onNavigate('community-events')}>
            See the calendar →
          </button>
        }
      >
        {soon.length > 0 ? (
          <ul className="home-soon-list">
            {soon.slice(0, 4).map((f) => (
              <li key={f.id} className="home-soon-row">
                <span className="home-soon-title">{flowTitle(f)}</span>
                <span className="home-soon-date">{shortDateLabel(f.date)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="home-empty">Nothing starting in the next 14 days.</p>
        )}
      </Panel>

      <Panel
        title="Needs care"
        action={
          <Link className="home-action-link" to="/system">
            Open System →
          </Link>
        }
      >
        <ul className="home-care-list">
          <li className="home-care-row">
            <span className="home-care-name">Consent gaps</span>
            {peopleCare ? (
              <span className="home-care-value">
                <span className="home-metric-sm">{peopleCare.gaps}</span> of {peopleCare.total}
              </span>
            ) : (
              <span className="home-care-value">no records yet</span>
            )}
            <DepthTag>PEOPLE</DepthTag>
          </li>
          <li className="home-care-row">
            <span className="home-care-name">Sources not flowing</span>
            {syncCare ? (
              <span className="home-care-value">
                <span className="home-metric-sm">{syncCare.notFlowing}</span> of {syncCare.total}
              </span>
            ) : (
              <span className="home-care-value">no records yet</span>
            )}
            <DepthTag>SYNC</DepthTag>
          </li>
          <li className="home-care-row">
            <span className="home-care-name">Unanswered asks</span>
            <span className="home-care-value">no records yet</span>
            <DepthTag>OPEN ASKS</DepthTag>
          </li>
        </ul>
      </Panel>

      <Panel
        title="Content ready"
        tag="CONTENT"
        action={
          <Link className="home-action-link" to="/system">
            See release status →
          </Link>
        }
      >
        <div className="home-metric-row">
          <span className="home-metric">{content.ready}</span>
          <span className="home-metric-label">ready</span>
          <span className="home-metric">{content.published}</span>
          <span className="home-metric-label">published</span>
        </div>
        {content.unmarked > 0 ? (
          <p className="home-note">{content.unmarked} rows carry no release status yet.</p>
        ) : null}
      </Panel>
    </div>
  );
}
