export const SECTION_LABELS = {
  HOME_HERO:        'Welcome back to the well.',
  NEXT_UP:          'Next Up',
  COMMUNITY_PULSE:  'Community Pulse',
  FEATURED:         'Featured Podyaps',
  QUICK_LINKS:      'Quick Access',
  FLOWS_EMPTY:      'No upcoming flows. Check back soon.',
  MOVES_EMPTY:      'No open moves right now.',
  MONEY_EMPTY:      'No pleasure dollar records loaded yet.',
  CARE_EMPTY:       'No care loop items pending follow-up.',
} as const;

export const EVENT_TYPE_LABELS: Record<string, string> = {
  Podyap:          'Podyap',
  'Open Studio':   'Open Studio',
  'Book Club':     'Book Club',
  Workshop:        'Workshop',
  'Pop-Up':        'Pop-Up',
  'Surprise-ment': 'Surprise-ment',
  Geyser:          'Geyser',
  Internal:        'Internal',
};

export const MOVES_STATUS_LABELS: Record<string, string> = {
  Now:     'Now',
  Next:    'Next',
  Done:    'Done',
  Dropped: 'Dropped',
};

export const MONEY_STAGE_LABELS: Record<string, string> = {
  Possible:  'Possible',
  Committed: 'Committed',
  Invoiced:  'Invoiced',
  Received:  'Received',
  Paid:      'Paid',
};

export const FALLBACK_QUOTES = [
  'The well is always full.',
  'Water finds its level.',
  'Flow, don\'t force.',
  'Creating doesn\'t have to be hard — it can be soft.',
  'Here we speak life into ourselves and into others.',
  'The well was always there. They just had to dig deep enough to find it.',
  'Accessible entry. Deeper medicine.',
] as const;

export const GLOSSARY: Record<string, string> = {
  Geyser:        'An unexpected eruption of creative energy or community event format where creative energy erupts into form.',
  Podyap:        'A pop-up podcast or community conversation container.',
  Depanty:       'The distribution & integration phase — scheduling clips, podcast host, Substack, what the water taught us, space cleared.',
  'Co-Hoe':      'Core team collaborator / co-holder of the well.',
  Titration:     'Careful, calibrated exposure — idea refinement from ideation to operational reality.',
  CoFlow:        'A shared creative session or accountability container.',
  Decomprocess:  '30-minute same-day reflective debrief ("what flowed, what flooded") led by the Flow Keeper.',
  Wellsheet:     'Pre-meeting self-reflection across 3 levels of depth.',
  Undercurrent:  'The deeper point of perspective in storytelling — what\'s flowing beneath the surface.',
  Monnyfesting:  'Sacral generator manifestation — bringing visions into grounded embodied reality.',
};
