import React from 'react';
import { useNavigate } from 'react-router';
import type { ForumPost } from '../api';
import { boardGroups, postName, gateHolder, type MakingBoardGroup } from '../../../lib/making';
import { shortDateLabel } from '../../../lib/dateLabel';

// ── Making board (Phase 4, packet T) ────────────────────────────────────────
// The CONTENT production board. Grouping, ordering, mirror/archived
// accounting are boardGroups()'s derivations of record
// (src/lib/making.ts) — this file renders its result: the episodes
// board first (every gate group, empty groups header-only), then the
// pieces board (non-empty status groups only). The footer names the
// registry mirrors and archived rows the board does not show.

function BoardCard({ post, variant }: { post: ForumPost; variant: 'episode' | 'piece' }) {
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
        {variant === 'piece' && post.currentGate && <> · Gate: {post.currentGate}</>}
      </div>
      {post.publishDate && (
        <div style={{
          fontFamily: 'var(--font-body)', fontSize: '0.78rem',
          color: 'var(--text-secondary, #4A3F55)',
        }}>
          Publish Date: {shortDateLabel(post.publishDate)}
        </div>
      )}
    </div>
  );
}

function EpisodeGroup({ group }: { group: MakingBoardGroup }) {
  const holder = gateHolder(group.label);
  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap',
        marginBottom: 8,
      }}>
        <span style={{
          fontFamily: 'var(--font-display)', fontSize: '0.95rem', fontWeight: 700,
          color: 'var(--cr8w-text, #2D2438)',
        }}>
          {group.label} · {group.posts.length}
        </span>
        {holder && (
          <span style={{
            fontFamily: 'var(--font-label)', fontSize: '0.66rem',
            color: 'var(--text-muted)',
          }}>
            {holder}
          </span>
        )}
      </div>
      {group.posts.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
          {group.posts.map(post => <BoardCard key={post.id} post={post} variant="episode" />)}
        </div>
      )}
    </div>
  );
}

function PieceGroup({ group }: { group: MakingBoardGroup }) {
  return (
    <div>
      <div style={{
        fontFamily: 'var(--font-display)', fontSize: '0.95rem', fontWeight: 700,
        color: 'var(--cr8w-text, #2D2438)', marginBottom: 8,
      }}>
        {group.label} · {group.posts.length}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
        {group.posts.map(post => <BoardCard key={post.id} post={post} variant="piece" />)}
      </div>
    </div>
  );
}

export function MakingBoard({ posts }: { posts: ForumPost[] }) {
  const board = boardGroups(posts);
  const shownPieces = board.pieceGroups.filter(g => g.posts.length > 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginBottom: 24 }}>
      <div>
        <div style={{
          fontFamily: 'var(--font-display)', fontSize: '1.05rem', fontWeight: 700,
          color: 'var(--cr8w-text, #2D2438)', marginBottom: 12,
        }}>
          Episodes
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {board.episodeGroups.map(group => <EpisodeGroup key={group.label} group={group} />)}
        </div>
      </div>

      {shownPieces.length > 0 && (
        <div>
          <div style={{
            fontFamily: 'var(--font-display)', fontSize: '1.05rem', fontWeight: 700,
            color: 'var(--cr8w-text, #2D2438)', marginBottom: 12,
          }}>
            Pieces
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {shownPieces.map(group => <PieceGroup key={group.label} group={group} />)}
          </div>
        </div>
      )}

      {(board.mirrorCount > 0 || board.archivedCount > 0) && (
        <div style={{
          fontFamily: 'var(--font-label)', fontSize: '0.68rem',
          color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: 3,
        }}>
          {board.mirrorCount > 0 && (
            <span>{board.mirrorCount} registry entries are not shown here.</span>
          )}
          {board.archivedCount > 0 && (
            <span>{board.archivedCount} archived pieces are not shown here.</span>
          )}
        </div>
      )}
    </div>
  );
}
