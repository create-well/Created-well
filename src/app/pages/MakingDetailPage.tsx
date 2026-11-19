import React from 'react';
import { Link, useParams } from 'react-router';
import { useDashboard } from '../../contexts/DashboardContext';
import type { ForumPost } from '../components/api';
import {
  resolvePost,
  parentEpisodeOf,
  postName,
  gateHolder,
  gateVerdict,
  readinessLegs,
  appearsInRelease,
} from '../../lib/making';
import { usePublicContent } from '../../lib/usePublicContent';
import { releasePresentable } from '../../lib/publicContent';

// ── Making detail (Phase 4 leg L4, packet S §3) ─────────────────────────────
// One CONTENT row, everything filed about it on one page: where it
// stands in production, and the release gate stated plain — three
// legs with the row's actual values, a verdict that names the unmet
// legs, readiness as its own line (readiness is not permission), and
// the public-appearance line only as a name-match (packet S A1).
// Read-only: filing happens in Notion; this page reports it.

function SectionTitle({ children }: { children: string }) {
  return (
    <div style={{
      fontFamily: 'var(--font-label)', fontSize: '0.65rem', fontWeight: 700,
      color: 'var(--text-muted, #8A7060)', textTransform: 'uppercase',
      letterSpacing: '0.06em', marginBottom: 8,
    }}>{children}</div>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{
      background: '#fff', border: '1px solid rgba(0,0,0,0.07)', borderRadius: 12,
      padding: '14px 16px',
    }}>
      <SectionTitle>{title}</SectionTitle>
      {children}
    </section>
  );
}

const bodyText: React.CSSProperties = {
  fontFamily: 'var(--font-body)', fontSize: '0.82rem',
  color: 'var(--text-secondary, #6B5F7A)', lineHeight: 1.55,
};
const linkText: React.CSSProperties = {
  fontFamily: 'var(--font-label)', fontSize: '0.72rem', fontWeight: 700,
  color: 'var(--cr8w-primary-text, #466F64)', textDecoration: 'none',
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 10, padding: '3px 0', ...bodyText }}>
      <span style={{ minWidth: 130, color: 'var(--text-muted, #8A7060)', fontWeight: 600 }}>{label}</span>
      <span>{children}</span>
    </div>
  );
}

function PostDetail({ post }: { post: ForumPost }) {
  const { data } = useDashboard();
  const release = usePublicContent();
  const verdict = gateVerdict(post);
  const readiness = readinessLegs(post);
  const holder = gateHolder(post.currentGate);
  const parent = parentEpisodeOf(post, data.forum ?? []);
  const inRelease =
    release.kind === 'ok' && releasePresentable(release)
      ? appearsInRelease(post, release.items)
      : false;
  // The recording-gathering relation rides the payload on the forum
  // row (normalizeContent's flowRelation); the type does not declare
  // it, so it is read here as the projection it is.
  const flowIds = (post as { flowRelation?: { ids: string[] } | null }).flowRelation?.ids ?? [];
  const flow = flowIds.length
    ? (data.coFlowDates ?? []).find((f) => f.notionPageId === flowIds[0])
    : undefined;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <header>
        <Link to="/making" style={linkText}>← Making</Link>
        <h1 style={{
          fontFamily: 'var(--font-display)', fontSize: '1.45rem', fontWeight: 700,
          color: 'var(--text-primary, #2A2438)', margin: '8px 0 4px', lineHeight: 1.25,
        }}>{postName(post)}</h1>
        <div style={bodyText}>
          {post.tag ?? 'Content Type: Not filed'}
          {post.status ? ` · ${post.status}` : ''}
        </div>
      </header>

      <DetailSection title="Where it stands">
        <Field label="Current Gate">
          {post.currentGate ?? 'No gate filed'}
          {holder ? ` — held by ${holder}` : ''}
        </Field>
        {post.currentGate === 'Promo' && (
          <Field label="Promo rule">
            No promo without a margin line. The margin lives in the workbook, not here.
          </Field>
        )}
        {post.topicStage && <Field label="Topic Stage">{post.topicStage}</Field>}
        {post.clipStatus && <Field label="Clip Status">{post.clipStatus}</Field>}
        {post.publishDate && <Field label="Publish Date">{post.publishDate}</Field>}
        {post.where && <Field label="Where">{post.where}</Field>}
        {post.link && (
          <Field label="Link">
            <a href={post.link} target="_blank" rel="noreferrer" style={linkText}>{post.link}</a>
          </Field>
        )}
        {parent && (
          <Field label="Parent Episode">
            <Link to={`/making/${parent.id}`} style={linkText}>{postName(parent)}</Link>
          </Field>
        )}
        {!parent && post.parentEpisodeId && (
          <Field label="Parent Episode">Filed in Notion</Field>
        )}
        {flow && (
          <Field label="Recording">
            <Link to={`/gatherings/${flow.id}`} style={linkText}>{flow.title || flow.theme || 'Gathering'}</Link>
          </Field>
        )}
      </DetailSection>

      <DetailSection title="Release gate">
        {verdict.legs.map((leg) => (
          <Field key={leg.key} label={leg.label}>
            {leg.actual} — {leg.met ? 'met' : 'not met'}
          </Field>
        ))}
        <div style={{ ...bodyText, marginTop: 8, fontWeight: 700 }}>
          {verdict.passes
            ? 'This piece passes the release gate.'
            : `This piece stays inside. Missing: ${verdict.missing.join(', ')}.`}
        </div>
        {inRelease && (
          <div style={{ ...bodyText, marginTop: 6 }}>
            Listed in the public release (name-matched).
          </div>
        )}
        <div style={{ ...bodyText, marginTop: 10 }}>
          Readiness: {post.readyToRelease ? 'Ready to release' : 'Not ready to release'} —{' '}
          {readiness.map((l) => `${l.label}: ${l.met ? 'yes' : 'no'}`).join(' · ')}
        </div>
        <div style={{ ...bodyText, color: 'var(--text-muted, #8A7060)' }}>
          Readiness is preparation, not release permission. The gate above decides.
        </div>
      </DetailSection>
    </div>
  );
}

export default function MakingDetailPage() {
  const { id } = useParams();
  const { data } = useDashboard();
  const resolution = resolvePost(data.forum, data.syncStatus, id ?? '');

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '20px 16px 40px' }}>
      {data.syncStatus === 'stale' && resolution.state === 'found' && (
        <div style={{ ...bodyText, marginBottom: 10 }}>
          Showing the last synced copy. A fresher sync has not landed yet.
        </div>
      )}
      {resolution.state === 'loading' && <div style={bodyText}>Loading…</div>}
      {resolution.state === 'not-found' && (
        <div>
          <Link to="/making" style={linkText}>← Making</Link>
          <div style={{ ...bodyText, marginTop: 10 }}>
            {data.syncStatus === 'failed'
              ? 'This piece could not be loaded. The last sync failed.'
              : 'No piece with this address rides the current payload.'}
          </div>
        </div>
      )}
      {resolution.state === 'found' && <PostDetail post={resolution.post} />}
    </div>
  );
}
