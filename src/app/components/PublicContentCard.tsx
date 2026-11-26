import React from 'react';
import type { PublicContentItem } from '../../lib/publicContent';
import { publicCardModel, type PublicCardStatus } from '../../lib/publicContentCard';

/**
 * The gatherings-card template's first rendering component
 * (templates/registry.json id gatherings-card), over the
 * /api/public-content projection. Status is a presentational
 * variant, never a projection field: the route's gate guarantees
 * every item is Published, so 'published' is the default and the
 * only state real data carries today. The cancelled variant carries
 * a darkrust banner and drops the link call to action (the File B
 * rule); the projection carries no capacity field, so no capacity
 * row renders in any variant. Styling is Layer 1 tokens of record
 * only (src/styles/tokens.css).
 */

const chipStyle: React.CSSProperties = {
  fontFamily: 'var(--type-label-family)',
  fontSize: 'var(--type-label-size)',
  fontWeight: 'var(--type-label-weight)',
  letterSpacing: 'var(--type-label-tracking)',
  textTransform: 'uppercase',
  color: 'var(--darkrust)',
  background: 'color-mix(in srgb, var(--clay) 38%, var(--cream))',
  borderRadius: 'var(--r-card)',
  padding: 'var(--space-xs) var(--space-s)',
};

export function PublicContentCard({ item, status = 'published', className }: {
  item: PublicContentItem;
  status?: PublicCardStatus;
  className?: string;
}) {
  const model = publicCardModel(item, status);
  return (
    <article
      className={className}
      style={{
        background: 'var(--cream)',
        border: '1px solid color-mix(in srgb, var(--darkrust) 16%, transparent)',
        borderRadius: 'var(--r-card)',
        overflow: 'hidden',
      }}
    >
      {model.bannerText && (
        <div style={{
          background: 'var(--darkrust)',
          color: 'var(--cream)',
          fontFamily: 'var(--type-label-family)',
          fontSize: 'var(--type-label-size)',
          fontWeight: 'var(--type-label-weight)',
          letterSpacing: 'var(--type-label-tracking)',
          textTransform: 'uppercase',
          padding: 'var(--space-xs) var(--space-m)',
        }}>
          {model.bannerText}
        </div>
      )}

      <div style={{
        padding: 'var(--space-s) var(--space-m) var(--space-m)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-xs)',
      }}>
        <h3 style={{
          margin: 0,
          fontFamily: 'var(--type-cardtitle-family)',
          fontSize: 'var(--type-cardtitle-size)',
          fontWeight: 'var(--type-cardtitle-weight)',
          lineHeight: 'var(--type-cardtitle-leading)',
          color: 'var(--darkrust)',
        }}>
          {model.title}
        </h3>

        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 'var(--space-xs)',
          fontFamily: 'var(--type-small-family)',
          fontSize: 'var(--type-small-size)',
          lineHeight: 'var(--type-small-leading)',
          color: 'color-mix(in srgb, var(--darkrust) 72%, transparent)',
        }}>
          <span>{model.dateLabel}</span>
          {model.where && <span>{model.where}</span>}
        </div>

        {(model.contentType || model.tag || model.chipText) && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-xs)' }}>
            {model.contentType && <span style={chipStyle}>{model.contentType}</span>}
            {model.tag && <span style={chipStyle}>{model.tag}</span>}
            {model.chipText && (
              <span style={{ ...chipStyle, background: 'var(--rust)', color: 'var(--cream)' }}>
                {model.chipText}
              </span>
            )}
          </div>
        )}

        {model.showLink && model.link && (
          <div>
            <a
              href={model.link}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontFamily: 'var(--type-label-family)',
                fontSize: 'var(--type-label-size)',
                fontWeight: 'var(--type-label-weight)',
                letterSpacing: 'var(--type-label-tracking)',
                textTransform: 'uppercase',
                color: 'var(--darkrust)',
                textDecoration: 'none',
                borderBottom: '1px solid var(--rust)',
              }}
            >
              RSVP
            </a>
          </div>
        )}
      </div>
    </article>
  );
}
