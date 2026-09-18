export const PERSONS: Record<string, Person> = {
  sunshine: {
    name: 'Sunshine', role: 'ManiGen 5/1 · Emotional Authority',
    expression: 'Lead / Internal Expression', color: '#D4A5A5', emoji: '☀️', authority: 'emotional',
    energyReminder: {
      type: 'Emotional Wave',
      text: "Remember your 72-hour decision timer. Ride the wave — don't decide at the peak or the valley. Your clarity comes through the full cycle.",
      detail: 'Triple Split: Big decisions need your full team present. All three centers need time to process.'
    }
  },
  monny: {
    name: 'Monny', fullName: 'Monica', role: 'Generator 5/1 · Sacral Authority',
    expression: 'Bridge / Embodied Expression', color: '#A9D6F8', emoji: '🌊', authority: 'sacral',
    energyReminder: {
      type: 'Sacral Check',
      text: 'Tune into your gut response today. What lights you up? What gets a full-body yes? Trust that "uh-huh" or "nuh-uh."',
      detail: '5/1 Foundation: Research and investigate before externalizing. Your depth is your power.'
    }
  },
  bingle: {
    name: 'Bingle', role: 'Projector 2/4 · Ego Authority',
    expression: 'External Expression / Distiller', color: '#D4A574', emoji: '✨', authority: 'ego',
    energyReminder: {
      type: 'Invitation Check',
      text: "Is there an invitation to respond to today? Wait for recognition before diving in. Your energy is precious — spend it where it's seen.",
      detail: 'Energy Budget: Projector energy is finite and potent. Rest isn\'t lazy — it\'s strategy.'
    }
  },
  omar: {
    name: 'Omar', fullName: 'Omar', role: 'New Member · Community Energy',
    expression: 'Fresh Perspective / Creative Collaborator', color: '#9B7FD4', emoji: '🌟', authority: 'open',
    energyReminder: {
      type: 'Welcome',
      text: 'You bring fresh eyes and new energy to the space. Your perspective matters — trust your intuition.',
      detail: 'New Member: Every contribution counts. Ask questions, explore freely, and build at your own pace.'
    }
  },
};

export interface Person {
  name: string; fullName?: string; role: string; expression: string;
  color: string; emoji: string; authority: string;
  energyReminder: { type: string; text: string; detail: string; };
}

export const WELLSHEET_PROMPTS: Record<string, string[]> = {
  sunshine: [
    "Where on your emotional wave are you right now?",
    "What download came through this morning?",
    "What's your body telling you about today's agenda?",
    "Which of your three splits needs attention today?",
    "What's one thing you want to manifest into the space today?",
    "Are you creating from overflow or depletion?",
    "What sparked you this week that you haven't shared yet?"
  ],
  monny: [
    "What's your sacral saying yes to right now?",
    "What's the bridge you're building today?",
    "Where are you in your investigation cycle?",
    "What needs embodying before it gets shared?",
    "Is your gut pulling you toward refinement or creation?",
    "What context needs your anchor energy most?",
    "What would a full-body yes feel like right now?"
  ],
  bingle: [
    "Is there an invitation waiting for your response?",
    "How's your energy budget looking today?",
    "What's ready to be distilled from the flow?",
    "Where can your 2/4 genius see what others can't?",
    "What clarity arrived during your rest time?",
    "Who in your network needs connecting today?",
    "What needs your external expression gift?"
  ]
};

export interface CalendarEvent {
  date: string; title: string; time?: string; location?: string;
  type: 'bhd' | 'cr8w' | 'personal' | 'launch'; persons: string[];
}

export const CALENDAR_EVENTS: CalendarEvent[] = [];

export const GLOSSARY = [
  { term: 'Geyser', def: 'CR8W event format & workspace tool — where creative energy erupts into form.' },
  { term: 'Decomprocess', def: 'Debrief + process — the reflective unwinding after shared experiences.' },
  { term: 'Wellsheet', def: 'Pre-meeting self-reflection across 3 levels of depth.' },
  { term: 'Titration', def: 'The funnel of idea refinement: Sunshine ideates \u2192 Monny bridges \u2192 Bingle distills \u2192 Operationalize.' },
  { term: 'Co-Hoe', def: 'Team collaborator — the people you build with, create with, and grow with.' },
  { term: 'Undercurrent', def: "The deeper point of perspective in storytelling — what's flowing beneath the surface." },
  { term: 'Hoe-flow', def: 'How each member uniquely shows up in the collective.' },
  { term: 'IndividuWell', def: 'Individual creative wellness practice — your personal well before the shared one.' },
  { term: 'Ofcoursement', def: 'Synchronicity acknowledgment — when the universe says "of course."' },
  { term: 'Monnyfesting', def: 'Monny-specific manifesting — when the sacral generator brings visions into embodied reality.' }
];

export const MILESTONES: { text: string; done: boolean }[] = [];

export interface Station {
  id: number; emoji: string; name: string; status: string;
  description: string; owner: string;
}

export const STATIONS_DEFAULT: Station[] = [];

export const GOOGLE_ACCOUNTS: Record<string, { calendarSrc: string }> = {
  sunshine: { calendarSrc: '' },
  monny: { calendarSrc: '' },
  bingle: { calendarSrc: '' }
};

export const GUEST_JOURNEY: { step: number; icon: string; title: string; desc: string; status: string }[] = [];

export const QUOTES = [
  "Here, is where you fall in love with the process.",
  "Flow over force.",
  "Creating doesn't have to be hard — it can be soft.",
  "We don't just tolerate the work — it's a life force in which we thrive.",
  "Here we speak life into ourselves and into others.",
  "There is more than enough room at the top.",
  "The well was always there. They just had to dig deep enough to find it.",
  "Accessible entry. Deeper medicine.",
  "Trust the response. Your body knows before your mind catches up.",
  "Emotional clarity is not the absence of feeling — it's the full ride through.",
  "The invitation is the permission slip your genius was waiting for.",
  "You weren't designed to do it all. You were designed to do what lights you up.",
  "Satisfaction is the signature of a life lived in alignment.",
  "Wait for the wave. The answer lives in the stillness after the storm.",
  "Your aura speaks louder than your words ever could.",
  "Strategy isn't limitation — it's liberation.",
  "The sacral doesn't lie. Learn its language.",
  "Rest is a Projector's most productive state."
];

export interface ActionItem {
  id: number; person: string; title: string; status: 'todo' | 'in_progress' | 'done' | 'blocked';
  priority: 'high' | 'medium' | 'low'; due_date?: string; source?: string; category?: string;
  created_at?: string;
}

export interface MomentumItem {
  id: number; person: string; content: string; item_type: string; created_at?: string;
}

export interface NoteItem {
  id: number; author: string; content: string; created_at?: string;
}

export interface BrainDump {
  id: number; author: string; content: string; tags?: string; drive_link?: string; created_at?: string;
}

export interface Announcement {
  id: number; text: string; priority: 'high' | 'medium' | 'low'; active?: number; created_at?: string;
}

export const DEFAULT_ANNOUNCEMENTS: Announcement[] = [];

export const HD_PROFILES: Record<string, HDProfile> = {
  sunshine: {
    type: 'Manifesting Generator', typeShort: 'ManiGen', profile: '5/1', profileName: 'Heretic / Investigator',
    authority: 'Emotional (Solar Plexus)', strategy: 'To Respond + Inform',
    signature: 'Satisfaction + Peace', notSelf: 'Frustration + Anger', definition: 'Triple Split',
    sacralDefined: true, auraType: 'Open & Enveloping',
    centers: { defined: ['Sacral', 'Solar Plexus', 'Throat', 'G Center'], undefined: ['Head', 'Ajna', 'Will/Heart', 'Spleen', 'Root'] },
    typeDescription: "Manifesting Generators are multi-passionate powerhouses. You have the sustainable sacral energy of a Generator PLUS the manifesting capacity to initiate and move fast. You're designed to juggle, skip steps (efficiently), and follow your gut response to multiple interests at once.",
    strategyDetail: "Wait to respond to something in your environment, THEN inform those affected before you act. Your emotional authority means you ride the full wave before committing. Never make major decisions at the peak (excitement) or valley (doubt) — wait for neutral clarity.",
    authorityDetail: "Your Solar Plexus authority means there is no truth in the now for you. Every decision needs to pass through your full emotional wave — highs, lows, and the calm in between. The 72-hour rule is your friend. Sleep on it. Feel into it over days, not minutes.",
    profileDetail: {
      line5: "The Heretic — You're projected upon as someone who can solve practical problems. People see you as a savior figure. This can be a gift (leadership) or a burden (unrealistic expectations). Your transpersonal karma means your work affects the collective.",
      line1: "The Investigator — You have a deep need for a solid foundation of knowledge. You research, study, and dig until you feel secure in your understanding. This is your power base — never skip the investigation phase."
    },
    definitionDetail: "Triple Split means your defined centers form three separate groups that don't connect to each other internally. You literally need other people's energy to bridge your circuits. Group settings, collaboration, and having your full team present is essential for major decisions.",
    livingYourDesign: [
      'Track your emotional wave for a week — note highs, lows, and neutral points',
      'Practice saying "let me sleep on it" before any commitment over $100 or 1 hour',
      'Follow what lights up your sacral — the "mmhmm" sound or body pull',
      'Inform your team before pivoting (even if it feels like slowing down)',
      'Schedule Triple Split alignment: bring Monny and Bingle in for big decisions',
      "Give yourself permission to have 5+ projects at once — that's your design"
    ],
    hdQuotes: [
      "Your emotional wave is not a flaw — it's your superpower for depth.",
      "The world sees you as the solution. Make sure you see yourself that way too.",
      "Multi-passionate isn't scattered. It's your design working perfectly.",
      "Inform, don't ask permission. The world needs to know where you're headed."
    ]
  },
  monny: {
    type: 'Generator', typeShort: 'Generator', profile: '5/1', profileName: 'Heretic / Investigator',
    authority: 'Sacral', strategy: 'To Respond', signature: 'Satisfaction', notSelf: 'Frustration',
    definition: 'Single Definition', sacralDefined: true, auraType: 'Open & Enveloping',
    centers: { defined: ['Sacral', 'Throat', 'G Center', 'Spleen'], undefined: ['Head', 'Ajna', 'Solar Plexus', 'Will/Heart', 'Root'] },
    typeDescription: "Pure Generators are the life force of the planet. You have deep, sustainable sacral energy — the most powerful motor in the bodygraph. Your design is to master what you love through response. When you're lit up, you can work tirelessly. When you're not, everything feels like slogging through mud.",
    strategyDetail: "Wait to respond. Don't initiate from the mind — let life come to you and check your sacral response. The sacral speaks in sounds (uh-huh / nuh-uh) and body sensations (leaning in / pulling back). Your Sacral authority means your gut response IS the answer — no waiting needed.",
    authorityDetail: "Sacral Authority is the most embodied of all authorities. Your gut knows instantly. The key is learning to hear it. Practice with yes/no questions. Notice the physical sensation — expansion (yes) or contraction (no). The sacral doesn't do \"maybe\" — that's your mind interfering.",
    profileDetail: {
      line5: "The Heretic — Like Sunshine, you carry the 5th line gift of practical solutions. People project their needs onto you and expect universalized fixes. Your work naturally serves the collective. The shadow: burnout from taking on everyone's problems.",
      line1: "The Investigator — Your foundation needs to be rock solid. You're the researcher, the one who goes deep before going wide. \"Bridge / Embodied Expression\" means you investigate thoroughly, then translate that into something others can feel and use."
    },
    definitionDetail: "Single Definition means all your defined centers connect in one continuous circuit. You don't need anyone else to feel whole — you process and integrate information independently. This gives you a self-contained reliability that the team counts on.",
    livingYourDesign: [
      'Practice sacral check-ins: Ask yourself yes/no questions and listen for the gut sound',
      'Keep a "sacral log" — what got a full-body yes this week? What got a no?',
      'Stop initiating. Wait for something to respond TO (conversation, request, idea)',
      "When frustrated, it's a signal you're doing work that's not yours",
      "Your 5/1 bridge role: research deeply, then share practical wisdom",
      "Honor the plateau — mastery takes sustained commitment, not quick pivots"
    ],
    hdQuotes: [
      "Your sacral is a truth machine. Learn to trust it over your mind.",
      "Frustration isn't failure — it's redirection toward what's truly yours.",
      "You are the bridge. Investigate, embody, then share.",
      "Satisfaction comes from responding to what lights you up — not what you think you should do."
    ]
  },
  bingle: {
    type: 'Projector', typeShort: 'Projector', profile: '2/4', profileName: 'Hermit / Opportunist',
    authority: 'Ego (Will/Heart)', strategy: 'Wait for the Invitation',
    signature: 'Success (Recognition)', notSelf: 'Bitterness',
    definition: 'Single Definition', sacralDefined: false, auraType: 'Focused & Absorbing',
    centers: { defined: ['Will/Heart', 'G Center', 'Throat'], undefined: ['Head', 'Ajna', 'Solar Plexus', 'Sacral', 'Spleen', 'Root'] },
    typeDescription: "Projectors are the guides, managers, and seers of the world. Only ~20% of the population, and Ego Projectors are roughly 0.5% — extremely rare. You don't have consistent sacral energy, so you're NOT designed to work 8-hour days. Your gift is seeing deeply into others and systems, and guiding energy where it should go.",
    strategyDetail: "Wait for the invitation for the big things in life — career, relationships, where to live, major projects. Recognition must come first. When people SEE you and invite your input, that's when your genius flows. Unsolicited advice, no matter how brilliant, lands flat.",
    authorityDetail: 'Ego/Willpower Authority means you check in with your willpower center: "Is this something I have the will for? What\'s in it for me?" This isn\'t selfish — it\'s essential. If your heart isn\'t in it, your energy won\'t sustain it. You need to genuinely want something to commit.',
    profileDetail: {
      line2: "The Hermit — You have a natural genius that comes effortlessly, often without you knowing it. You need alone time to recharge and let your gifts percolate. Others see your talent before you do. Your \"cave time\" is not avoidance — it's where your magic incubates.",
      line4: "The Opportunist — Your network IS your net worth. Opportunities come through people you know, not cold outreach. You're designed for warm connections and community building. Your influence ripples through relationships, not broadcasting."
    },
    definitionDetail: "Single Definition with an undefined Sacral means you feel others' energy intensely but it's not yours to keep. You amplify and read sacral energy from Sunshine and Monny. This makes you the perfect guide — you can see their energy patterns more clearly than they can.",
    livingYourDesign: [
      "Schedule real rest into every day — not \"productive rest\", actual rest",
      'Practice: "Is this an invitation or am I inserting myself?"',
      'Ask the ego check: "Do I genuinely have the will/desire for this?"',
      'Honor your hermit time — genius needs solitude to incubate',
      'Your network is everything — nurture warm connections intentionally',
      "Track your energy: when do you feel amplified vs. drained? That's data."
    ],
    hdQuotes: [
      "You are the rarest of the rare. Your perspective is the gift.",
      "Bitterness is the alarm that says: \"I gave my genius away for free.\"",
      "Wait for the recognition. When they see you, magic happens.",
      "Rest is not the opposite of productivity for you — it IS productivity."
    ]
  }
};

export interface HDProfile {
  type: string; typeShort: string; profile: string; profileName: string;
  authority: string; strategy: string; signature: string; notSelf: string;
  definition: string; sacralDefined: boolean; auraType: string;
  centers: { defined: string[]; undefined: string[]; };
  typeDescription: string; strategyDetail: string; authorityDetail: string;
  profileDetail: Record<string, string>;
  definitionDetail: string; livingYourDesign: string[]; hdQuotes: string[];
}

export const MBODY_PRACTICES = [
  { category: 'Somatic', title: 'Body Scan', desc: 'Close your eyes. Starting from the top of your head, slowly scan down through your body. Notice any areas of tension, warmth, or tingling. Stay with each sensation for 3 breaths.' },
  { category: 'Somatic', title: 'Shake It Out', desc: 'Stand up and shake your hands, arms, legs — your whole body for 60 seconds. Let whatever wants to move, move. Then stop and notice the buzz.' },
  { category: 'Somatic', title: 'Butterfly Hug', desc: 'Cross your arms over your chest, hands resting on opposite shoulders. Gently alternate tapping, left then right, for 2 minutes. Breathe slowly.' },
  { category: 'Writing', title: 'Stream of Consciousness', desc: 'Set a 5-minute timer. Write without stopping, without editing, without lifting your pen. Let whatever comes, come. No judgment.' },
  { category: 'Writing', title: 'Letter to Future Self', desc: 'Write a letter to yourself one year from now. What do you want them to know? What are you proud of right now? What are you working toward?' },
  { category: 'Writing', title: 'Gratitude Dump', desc: "List 10 things you're grateful for right now. Include at least 3 body sensations and 2 people. Don't overthink — just flow." },
  { category: 'Breathwork', title: '4-7-8 Reset', desc: 'Inhale through your nose for 4 counts. Hold for 7 counts. Exhale slowly through your mouth for 8 counts. Repeat 4 cycles.' },
  { category: 'Breathwork', title: 'Box Breathing', desc: 'Inhale 4 counts. Hold 4 counts. Exhale 4 counts. Hold empty 4 counts. Repeat 6 times. Feel the square shape of your breath.' },
  { category: 'Breathwork', title: 'Sighing Breath', desc: 'Take a deep breath in through your nose, then add a second smaller inhale on top. Exhale with a long audible sigh through your mouth. Repeat 5 times.' },
  { category: 'Sound', title: 'Hum Meditation', desc: 'Close your eyes and hum at a comfortable pitch for 5 minutes. Feel the vibration in your chest and throat. Let the sound ground you.' },
  { category: 'Sound', title: 'Nature Sounds', desc: 'Find a nature soundscape (rain, ocean, forest). Close your eyes and listen for 3 minutes. Count how many distinct sounds you can identify.' },
  { category: 'Sound', title: 'Vocal Toning', desc: 'Pick a vowel sound (Ah, Oh, Mm). Sustain it on a single tone for one full exhale. Repeat 7 times, letting each one deepen.' }
];

// Helpers
export function formatDate(dateStr: string) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
export function formatEventDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
export function formatTimestamp(ts?: string) {
  if (!ts) return '';
  const d = new Date(ts);
  if (isNaN(d.getTime())) return ts;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
export function truncate(str: string, len: number) {
  return str.length > len ? str.substring(0, len) + '\u2026' : str;
}
export function capitalize(str: string) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}
export function getEventColor(type: string, personColor?: string) {
  const colors: Record<string, string> = { bhd: '#6B5344', cr8w: '#7BA89D', personal: personColor || '#D4A5A5', launch: '#D46B6B' };
  return colors[type] || '#A89888';
}
export function getDaysToLaunch() {
  const launch = new Date('2026-04-15T00:00:00');
  const now = new Date();
  return Math.ceil((launch.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}
export function getDayOfYear(date: Date) {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

export const WELL_GREETINGS: string[] = [
  'wellcome back.',
  'well, well, well... look who showed up.',
  'hope you\'ve been well.',
  'you\'re doing well. (we can tell.)',
  'the well missed you.',
  'back at the well, right where you belong.',
  'well rested? let\'s create.',
  'all is well. especially now.',
  'dwelling in the well again.',
  'well aware you\'d be back.',
  'wellness check: you\'re here. that\'s enough.',
  'the well is always flowing. so are you.',
  'well, hello.',
  'creating well starts now.',
  'you showed up. that\'s the whole assignment.',
  'the well runs deep today.',
  'well met, creator.',
];

export const GCAL_CLIENT_ID = '411548888468-3volgsnl2spba4gcfgik620o0al7pq1v.apps.googleusercontent.com';

// ── How We Flow operational constants ─────────────────────────────────────────
// 7-phase event lifecycle for forum thread categories
export const PHASE_TAGS = [
  'cohoe',
  'concepting',
  'coordinating',
  'marketing',
  'day-of',
  'decompressing',
  'depanty',
] as const;
export type PhaseTag = typeof PHASE_TAGS[number];

export const PHASE_META: Record<string, { emoji: string; label: string; desc: string; color: string }> = {
  cohoe:         { emoji: '🌱', label: 'Cohoe',         desc: 'Batch planning — one Cohoe sets the whole month',    color: '#7BA89D' },
  concepting:    { emoji: '💡', label: 'Concepting',    desc: 'Ideas open, anything goes, no editing yet',          color: '#D4A771' },
  coordinating:  { emoji: '🔧', label: 'Coordinating',  desc: 'Logistics locked, roles confirmed, timeline set',    color: '#A9D6F8' },
  marketing:     { emoji: '📣', label: 'Marketing',     desc: 'Outreach live, content scheduled, invites sent',     color: '#B8A9D4' },
  'day-of':      { emoji: '⚡', label: 'Day-Of',        desc: 'All hands present — flow in real time',             color: '#E8AF93' },
  decompressing: { emoji: '🌿', label: 'Decompressing', desc: 'Post-event processing, team feelings + data',        color: '#B8D4A8' },
  depanty:       { emoji: '✨', label: 'Depanty',       desc: 'Wrap-up complete, learnings captured, space cleared', color: '#EAE3DB' },
};

// Role ownership for tasks (4 roles: the 3 team members + Event Support)
export const TASK_ROLES: Record<string, { name: string; emoji: string; color: string; short: string; sub: string }> = {
  sunshine: {
    name: 'Sunshine', emoji: '☀️', color: '#C25B38',
    short: 'Remote', sub: 'advance building · content · sponsor comms',
  },
  monny: {
    name: 'Monica', emoji: '🌊', color: '#7AB8DC',
    short: 'Open Invitation', sub: 'outreach · systems (never assumed)',
  },
  bingle: {
    name: 'Bingle', emoji: '✨', color: '#D4A771',
    short: 'In-Person', sub: 'space-holding · community · workshops',
  },
  'event-support': {
    name: 'Event Support', emoji: '🎪', color: '#E8AF93',
    short: 'Day-Of', sub: 'setup · cleanup · engagement',
  },
};
