export type ProfileKey = 'sunshine' | 'monny' | 'bingle' | 'omar' | 'pia' | 'event-support';
export type ProfilePermission = 'read' | 'write' | 'admin';

export interface Profile {
  key: ProfileKey;
  display: string;
  displayName: string;
  emoji: string;
  role: string;
  desc: string;
  bio?: string;
  color: string;
  bg: string;
  border: string;
  permission: ProfilePermission;
  hdType?: string;
  hdAuthority?: string;
  email?: string;
}

export const PROFILES: Record<ProfileKey, Profile> = {
  sunshine: {
    key: 'sunshine',
    display: 'Sunshine',
    displayName: 'Sunshine',
    emoji: '☀️',
    role: 'Remote · Co-Founder / Host',
    desc: 'Advance building · Content · Sponsor comms',
    bio: 'Lead / Internal Expression. ManiGen 5/1 · Emotional Authority.',
    color: '#C25B38',
    bg: '#FFF0EB',
    border: '#F2B49B',
    permission: 'admin',
    hdType: 'Manifesting Generator 5/1',
    hdAuthority: 'Emotional (Solar Plexus)',
  },
  monny: {
    key: 'monny',
    display: 'Monica (Monny)',
    displayName: 'Monny',
    emoji: '🌊',
    role: 'Open Invitation · Co-Founder / Ops',
    desc: 'Outreach · Systems · Bridge building',
    bio: 'Bridge / Embodied Expression. Generator 5/1 · Sacral Authority.',
    color: '#7BA89D',
    bg: '#EAF4FC',
    border: '#A9D6F8',
    permission: 'admin',
    hdType: 'Generator 5/1',
    hdAuthority: 'Sacral',
    email: 'mb@tablante.com',
  },
  bingle: {
    key: 'bingle',
    display: 'Bingle',
    displayName: 'Bingle',
    emoji: '✨',
    role: 'In-Person · Community Lead',
    desc: 'Space-holding · Community · Workshops',
    bio: 'External Expression / Distiller. Projector 2/4 · Ego Authority.',
    color: '#B8A9D4',
    bg: '#FFF8EC',
    border: '#D4A771',
    permission: 'write',
    hdType: 'Projector 2/4',
    hdAuthority: 'Ego (Will/Heart)',
  },
  omar: {
    key: 'omar',
    display: 'Omar',
    displayName: 'Omar',
    emoji: '🌟',
    role: 'New Member · Content / Tech',
    desc: 'Community · Creative collaboration · Fresh energy',
    bio: 'Fresh Perspective / Creative Collaborator. Content & production pacing.',
    color: '#2D2438',
    bg: '#F0ECFB',
    border: '#B8A9D4',
    permission: 'write',
    hdType: 'Generator',
    hdAuthority: 'Open',
  },
  pia: {
    key: 'pia',
    display: 'Pia',
    displayName: 'Pia',
    emoji: '🌸',
    role: 'Community · Reflective Support',
    desc: 'Feedback · Community health · Space-reading',
    bio: 'Mirror / Emergent Expression. Reflector 1/3 · Lunar Authority.',
    color: '#9B3A5A',
    bg: '#FDF0F5',
    border: '#E8A8C0',
    permission: 'write',
    hdType: 'Reflector 1/3',
    hdAuthority: 'Lunar',
  },
  'event-support': {
    key: 'event-support',
    display: 'Event Support',
    displayName: 'Event Support',
    emoji: '🎪',
    role: 'Day-Of · Logistics & Setup',
    desc: 'Setup · Cleanup · Engagement',
    bio: 'All-hands event flow, space clearing, and live support.',
    color: '#7A4A20',
    bg: '#FFF5EE',
    border: '#E8AF93',
    permission: 'read',
  },
} as const;

export const PROFILES_LIST: Profile[] = Object.values(PROFILES);

// Admin / owner access (full controls & panel privileges)
export const ADMIN_EMAILS = new Set(['mb@tablante.com']);

export function isAdmin(email?: string | null): boolean {
  return !!email && ADMIN_EMAILS.has(email.trim().toLowerCase());
}

// Dev-bypass default profile key
export const DEV_DEFAULT_PROFILE: ProfileKey = 'monny';
