import React from 'react';
import type { GatheringDetailInput } from '../../lib/publicGatheringDetail';
import { publicGatheringDetailModel } from '../../lib/publicGatheringDetail';

/**
 * The gatherings-detail template's first rendering component
 * (templates/registry.json id gatherings-detail, File B "Gatherings
 * Detail" pattern of record: cover story slot, DATE / TIME / LOCATION
 * block, email capture row, save-my-spot CTA, RSVP-by line). There is
 * no public gatherings data leg, so the component is props-driven and
 * presentational: it renders through publicGatheringDetailModel, never
 * fetches, and never writes — the email form's submit only reports the
 * entered address to an optional onSaveSpot callback, and the RSVP
 * write path stays a parked decision outside this leg. Styling is
 * Layer 1 tokens of record only (src/styles/tokens.css).
 */

const eyebrowStyle: React.CSSProperties = {
  fontFamily: 'var(--type-eyebrow-family)',
  fontSize: 'var(--type-eyebrow-size)',
  fontWeight: 'var(--type-eyebrow-weight)',
  letterSpacing: 'var(--type-eyebrow-tracking)',
  textTransform: 'uppercase',
  color: 'var(--rust)',
};

export function PublicGatheringDetail({ detail, onSaveSpot, className }: {
  detail: GatheringDetailInput;
  onSaveSpot?: (email: string) => void;
  className?: string;
}) {
  const model = publicGatheringDetailModel(detail);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!onSaveSpot) return;
    const data = new FormData(event.currentTarget);
    onSaveSpot(String(data.get('email') ?? ''));
  };

  return (
    <article
      className={className}
      style={{
        background: 'var(--cream)',
        border: '1px solid color-mix(in srgb, var(--darkrust) 16%, transparent)',
        borderRadius: 'var(--r-card)',
        padding: 'var(--space-m)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-s)',
      }}
    >
      <h2 style={{
        margin: 0,
        fontFamily: 'var(--type-cardtitle-family)',
        fontSize: 'var(--type-cardtitle-size)',
        fontWeight: 'var(--type-cardtitle-weight)',
        lineHeight: 'var(--type-cardtitle-leading)',
        color: 'var(--darkrust)',
      }}>
        {model.title}
      </h2>

      {model.coverStory && (
        <p style={{
          margin: 0,
          fontFamily: 'var(--type-body-family)',
          fontSize: 'var(--type-body-size)',
          fontWeight: 'var(--type-body-weight)',
          lineHeight: 'var(--type-body-leading)',
          color: 'var(--darkrust)',
        }}>
          {model.coverStory}
        </p>
      )}

      {model.facts.length > 0 && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-xs)',
        }}>
          {model.facts.map((fact) => (
            <div
              key={fact.label}
              style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}
            >
              <span style={eyebrowStyle}>{fact.label}</span>
              <span style={{
                fontFamily: 'var(--type-body-family)',
                fontSize: 'var(--type-body-size)',
                fontWeight: 'var(--type-body-weight)',
                lineHeight: 'var(--type-body-leading)',
                color: 'var(--darkrust)',
              }}>
                {fact.value}
              </span>
            </div>
          ))}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        style={{ display: 'flex', gap: 'var(--space-xs)' }}
      >
        <input
          type="email"
          name="email"
          placeholder="Email address"
          style={{
            flex: 1,
            minWidth: 0,
            height: 'var(--cta-height)',
            padding: '0 var(--space-s)',
            border: '1px solid var(--clay)',
            borderRadius: 'var(--r-card)',
            background: 'var(--sand)',
            color: 'var(--darkrust)',
            fontFamily: 'var(--type-body-family)',
            fontSize: 'var(--type-body-size)',
            fontWeight: 'var(--type-body-weight)',
          }}
        />
        <button
          type="submit"
          style={{
            height: 'var(--cta-height)',
            padding: '0 var(--space-m)',
            border: 'none',
            borderRadius: 'var(--r-card)',
            background: 'var(--rust)',
            color: 'var(--cream)',
            cursor: 'pointer',
            fontFamily: 'var(--type-label-family)',
            fontSize: 'var(--type-label-size)',
            fontWeight: 'var(--type-label-weight)',
            letterSpacing: 'var(--type-label-tracking)',
            textTransform: 'uppercase',
          }}
        >
          {model.ctaLabel}
        </button>
      </form>

      {model.rsvpByLine && (
        <p style={{
          margin: 0,
          fontFamily: 'var(--type-label-family)',
          fontSize: 'var(--type-label-size)',
          fontWeight: 'var(--type-label-weight)',
          letterSpacing: 'var(--type-label-tracking)',
          textTransform: 'uppercase',
          color: 'var(--darkrust)',
        }}>
          {model.rsvpByLine}
        </p>
      )}
    </article>
  );
}
