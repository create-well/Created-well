import React from 'react';
import { useNavigate } from 'react-router';
import type { ForumPost } from '../api';
import { tasteQueue, releaseCallQueue, postName, type MakingQueue } from '../../../lib/making';
import { shortDateLabel } from '../../../lib/dateLabel';

// ── Making queues (Phase 4, packet T) ───────────────────────────────────────
// The two waiting rooms above the board. Membership is the lib's
// derivation of record (src/lib/making.ts): the Taste gate for the
// first, the team's own Ready to Release? formula for the second —
// this file renders what those functions return and derives nothing
// itself. Dated members render as cards; the undated count renders
// as the honest line under them, never as dressed-up cards.

function QueueCard({ post }: { post: ForumPost }) {
  const navigate = useNavigate();
  return (
    <div style={{
      background: '#fff', border: '1px solid rgba(0,0,0,0.07)', borderRadius: 12,
      padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6,
    }}>
      <button
        onClick={() => navigate(`/making/${post.id}`)}
        style={{
          background: 'none', border: 'none', padding: 0, cursor: 'pointer',
          textAlign: 'left',
          fontFamily: 'var(--font-display)', fontSize: '0.92rem', fontWeight: 600,
          color: 'var(--cr8w-text, #2D2438)',
        }}
      >
        {postName(post)} →
      </button>
      <div style={{
        fontFamily: 'var(--font-body)', fontSize: '0.78rem',
        color: 'var(--text-secondary, #4A3F55)',
      }}>
        Content Type: {post.tag ?? 'Not filed'}
      </div>
      <div style={{
        fontFamily: 'var(--font-body)', fontSize: '0.78rem',
        color: 'var(--text-secondary, #4A3F55)',
      }}>
        Publish Date: {shortDateLabel(post.publishDate)}
      </div>
    </div>
  );
}

function QueueSection({ title, queue, emptyState }: {
  title: string;
  queue: MakingQueue;
  emptyState: string;
}) {
  const total = queue.dated.length + queue.undatedCount;
  return (
    <div>
      <div style={{
        fontFamily: 'var(--font-display)', fontSize: '1.05rem', fontWeight: 700,
        color: 'var(--cr8w-text, #2D2438)', marginBottom: 8,
      }}>
        {title} · {total}
      </div>
      {total === 0 ? (
        <div style={{
          fontFamily: 'var(--font-body)', fontSize: '0.85rem',
          color: 'var(--text-muted, #6B5F7A)',
        }}>
          {emptyState}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
            {queue.dated.map(post => <QueueCard key={post.id} post={post} />)}
          </div>
          {queue.undatedCount > 0 && (
            <div style={{
              fontFamily: 'var(--font-body)', fontSize: '0.8rem',
              color: 'var(--text-muted, #6B5F7A)',
            }}>
              {queue.undatedCount} more without a publish date filed
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function MakingQueues({ posts }: { posts: ForumPost[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginBottom: 24 }}>
      <QueueSection
        title="Waiting For Taste"
        queue={tasteQueue(posts)}
        emptyState="Nothing is at the Taste gate. When a piece's Current Gate is filed as Taste in Notion, it waits here."
      />
      <QueueSection
        title="Waiting For Release Call"
        queue={releaseCallQueue(posts)}
        emptyState="Nothing is waiting for a release call. When a piece is Final, Ready, and has its link and publish date filed in Notion, it waits here."
      />
    </div>
  );
}
