// The .ts extension is deliberate: tsconfig allows it, Vite resolves
// it, and the repo's node test loader requires it for lib-to-lib
// value imports (extensionless resolves only under the bundler).
import { itemDateLabel, type PublicContentItem } from './publicContent.ts';

/**
 * Public-payload card model (BUILDER leg 1, templates/registry.json
 * id gatherings-card). The /api/public-content projection carries
 * exactly six fields and the route's gate guarantees every item
 * passed Status = Published, Final? checked, Audience = Public, so
 * the projection itself has no status to render. The card's status
 * is a presentational variant prop, not a data field: 'published'
 * is the plain card (the only state the gate guarantees), 'waitlist'
 * adds the Waitlist chip, and 'cancelled' carries the Cancelled
 * banner and drops the link call to action (the File B rule — the
 * projection carries no capacity field, so there is no capacity
 * row to drop). Every derived wording lives here so the component
 * stays a dumb render and the node test suite can pin the model.
 */
export type PublicCardStatus = 'published' | 'waitlist' | 'cancelled';

export interface PublicCardModel {
  title: string;
  dateLabel: string;
  where: string | null;
  tag: string | null;
  contentType: string | null;
  link: string | null;
  status: PublicCardStatus;
  bannerText: string | null;
  chipText: string | null;
  showLink: boolean;
}

export function publicCardModel(
  item: PublicContentItem,
  status: PublicCardStatus = 'published',
): PublicCardModel {
  // The client type says string | null; the server projection emits
  // a string that may be empty. An empty link is no link.
  const link = item.link === '' ? null : item.link;
  return {
    // No placeholder title: an empty name stays empty.
    title: item.name,
    dateLabel: itemDateLabel(item.publishDate),
    where: item.where,
    tag: item.tag,
    contentType: item.contentType,
    link,
    status,
    bannerText: status === 'cancelled' ? 'Cancelled' : null,
    chipText: status === 'waitlist' ? 'Waitlist' : null,
    showLink: link !== null && status !== 'cancelled',
  };
}
