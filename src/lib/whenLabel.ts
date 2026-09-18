// One rule for every date the dashboard shows.
//
// The question was countdown or absolute. The answer is both, decided by
// distance, because those two formats answer different questions:
//
//   "in 3 days"   tells you how hard to breathe.
//   "Oct 8"       tells you when to be somewhere.
//
// Close dates are felt, so they count down. Far dates are planned, so they
// show the date. The cut is 14 days, which is the length of the return rhythm
// the MOVES Touchpoint field already uses.
//
// The absolute date is ALWAYS carried alongside the label, never replaced by
// it. A countdown that hides the real date forces a second lookup, and the
// whole point of this dashboard is that nobody has to go ask Notion.
//
// Zero imports. Both the browser bundle and the Vercel functions read this.

export type WhenTone =
  | 'none'      // no date set
  | 'late'      // the date has passed
  | 'today'
  | 'tomorrow'
  | 'soon'      // 2 to 6 days
  | 'near'      // 7 to 13 days
  | 'far';      // 14 days or more

export interface WhenLabel {
  /** What to render. Countdown inside two weeks, absolute beyond it. */
  text: string;
  /** The full date, always. Put this in a title attribute so nothing is hidden. */
  absolute: string;
  /** Weekday plus date, for when there is room for both. */
  long: string;
  /** Clock time if the source had one, otherwise empty. */
  time: string;
  tone: WhenTone;
  /** Whole calendar days from today. Negative means overdue. Null means no date. */
  days: number | null;
  /** True when the date is in the past and the thing is not finished. */
  overdue: boolean;
}

const EMPTY: WhenLabel = {
  text: 'no date set',
  absolute: '',
  long: '',
  time: '',
  tone: 'none',
  days: null,
  overdue: false,
};

/**
 * Parse a Notion date string without letting the timezone move the day.
 *
 * Notion hands back either a date ('2026-09-24') or a datetime
 * ('2026-09-24T18:00:00.000-07:00'). `new Date('2026-09-24')` is parsed as UTC
 * midnight, which in Las Vegas is 5pm the day BEFORE. Every date-only value
 * would render one day early. So date-only strings are built field by field in
 * local time instead.
 */
function parseLocal(value: string): { date: Date; hasTime: boolean } | null {
  if (!value) return null;
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (dateOnly) {
    const [, y, m, d] = dateOnly;
    return { date: new Date(Number(y), Number(m) - 1, Number(d)), hasTime: false };
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return { date: parsed, hasTime: true };
}

/** Whole calendar days between two instants, ignoring the clock. */
function calendarDaysBetween(from: Date, to: Date): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

export interface WhenOptions {
  /** Treat the date as settled, so a past date reads as a date and not as late. */
  done?: boolean;
  /** Override "now". Tests pass this. Nothing else should. */
  now?: Date;
}

/**
 * Turn a date string into something a tired person can read at a glance.
 *
 * Inside two weeks it counts down. Beyond that it states the date. Overdue
 * counts up, because "4 days late" is the number that actually changes
 * behaviour. Finished things never read as late.
 */
export function whenLabel(
  value: string | null | undefined,
  options: WhenOptions = {},
): WhenLabel {
  const parsed = parseLocal(value ?? '');
  if (!parsed) return { ...EMPTY };

  const { date, hasTime } = parsed;
  const now = options.now ?? new Date();
  const days = calendarDaysBetween(now, date);

  const absolute = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const long = date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  const time = hasTime
    ? date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    : '';
  const withYear = date.toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });

  const base = { absolute: time ? `${withYear}, ${time}` : withYear, long, time };

  // Finished work keeps its date and loses its urgency.
  if (options.done) {
    return { ...base, text: absolute, tone: 'far', days, overdue: false };
  }

  if (days < 0) {
    const late = Math.abs(days);
    return {
      ...base,
      text: late === 1 ? 'yesterday' : `${plural(late, 'day')} late`,
      tone: 'late',
      days,
      overdue: true,
    };
  }

  if (days === 0) return { ...base, text: 'today', tone: 'today', days, overdue: false };
  if (days === 1) return { ...base, text: 'tomorrow', tone: 'tomorrow', days, overdue: false };

  // Two to six days out: the countdown is the useful number.
  if (days <= 6) {
    return { ...base, text: `in ${plural(days, 'day')}`, tone: 'soon', days, overdue: false };
  }

  // One to two weeks: name the weekday, because that is how people plan a week.
  if (days <= 13) {
    return { ...base, text: `${long} · in ${plural(days, 'day')}`, tone: 'near', days, overdue: false };
  }

  // Beyond two weeks a countdown stops meaning anything. State the date.
  return { ...base, text: absolute, tone: 'far', days, overdue: false };
}

/** Tone to colour, so every date in the dashboard reads the same way. */
export const WHEN_TONE_COLOR: Record<WhenTone, string> = {
  none:     '#8A8A8A',
  late:     '#C4453D',
  today:    '#C4453D',
  tomorrow: '#C97A2E',
  soon:     '#C9A22E',
  near:     '#5C4A9A',
  far:      '#6B6B6B',
};
