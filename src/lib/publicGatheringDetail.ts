/**
 * Public gatherings detail model (BUILDER-B2, templates/registry.json id
 * gatherings-detail, File B "Gatherings Detail" pattern of record). There
 * is no public gatherings data leg: no API route, projection, or payload
 * carries a public gathering detail, so this model takes display strings
 * exactly as a future caller shapes them. It never formats raw data and
 * never invents a placeholder title, date, time, place, or RSVP line. A
 * field that is null, empty, or whitespace-only is absent: facts drop it,
 * coverStory and rsvpByLine become null. The facts block carries only the
 * present fields, always in DATE, TIME, LOCATION order, and every derived
 * wording lives here so the component stays a dumb render the node test
 * suite can pin.
 */
export interface GatheringDetailInput {
  title: string;
  date: string | null;
  time: string | null;
  location: string | null;
  rsvpBy: string | null;
  coverStory: string | null;
}

export interface GatheringDetailFact {
  label: 'DATE' | 'TIME' | 'LOCATION';
  value: string;
}

export interface PublicGatheringDetailModel {
  title: string;
  coverStory: string | null;
  facts: GatheringDetailFact[];
  rsvpByLine: string | null;
  ctaLabel: 'Save my spot';
}

const SAVE_MY_SPOT_LABEL = 'Save my spot';

function present(value: string | null): string | null {
  if (value === null) return null;
  return value.trim() === '' ? null : value;
}

export function publicGatheringDetailModel(
  input: GatheringDetailInput,
): PublicGatheringDetailModel {
  const facts: GatheringDetailFact[] = [];
  const date = present(input.date);
  const time = present(input.time);
  const location = present(input.location);
  if (date !== null) facts.push({ label: 'DATE', value: date });
  if (time !== null) facts.push({ label: 'TIME', value: time });
  if (location !== null) facts.push({ label: 'LOCATION', value: location });

  return {
    // No placeholder title: an empty title stays empty.
    title: input.title,
    coverStory: present(input.coverStory),
    facts,
    rsvpByLine: present(input.rsvpBy),
    ctaLabel: SAVE_MY_SPOT_LABEL,
  };
}
