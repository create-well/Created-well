// Shared data contract for the CR8W dashboard.
//
// This module has ZERO imports on purpose. Both sides of the boundary read it:
//   - the browser bundle, via src/app/components/api.ts, which re-exports it
//   - the Vercel serverless functions in api/, which cannot resolve the
//     vite-only '/utils/supabase/info' import at the top of api.ts
//
// Before this split, api/notionWriter.ts and src/lib/notionNormalizer.ts both
// imported types from api.ts, which meant every server function transitively
// referenced a module the Node runtime cannot resolve. Types belong somewhere
// neither side has to apologise for.

export interface ParkingLotItem {
  id: string;
  text: string;
  category: 'spark' | 'question' | 'resource' | 'wild card';
  author: string;
  created_at: string;
}

// ── Types ──────────────────────────────────────────────────────────────────────
export interface InviteCounts {
  confirmed: number;
  pending: number;
  declined: number;
  maybe: number;
  total: number;
  updated_at?: string;
}

/**
 * What came back from a write-through to Notion.
 *
 * Every create, update and delete response now carries this. A write that only
 * reached the KV store is not a success, and the dashboard is expected to say so
 * rather than show a green tick over nothing.
 */
export interface DroppedField {
  property: string;
  reason: string;
}

export interface NotionSyncResult {
  state: 'written' | 'partial' | 'failed' | 'skipped';
  db?: string;
  pageId?: string;
  dropped?: DroppedField[];
  message?: string;
}

/** MOVES Touchpoint. The 14-day return rhythm. */
export type Touchpoint =
  | 'Thank-you (24-48h)'
  | 'Check-in (Day 5-7)'
  | 'Next invite (Day 10-14)'
  | 'Personal invite (after 2nd)'
  | 'Other';

/** MOVES Type. */
export type MoveType = 'Prep' | 'Day-Of' | 'Follow-Up' | 'Admin' | 'Content';

export interface Task {
  id: number; person: string; title: string;
  // 'dropped' exists because MOVES has a Dropped status and the Create Well
  // governance rule is that Dropped stays visible as dropped. It is not
  // collapsed into 'done' and not hidden as 'blocked'.
  status: 'todo' | 'in_progress' | 'done' | 'blocked' | 'dropped';
  // Kept because the dashboard sorts on it. MOVES has NO priority property, so
  // this is always a local value and is never written back to Notion.
  priority: 'high' | 'medium' | 'low';
  due_date?: string; source?: string; category?: string; created_at?: string;
  notionPageId?: string;
  // ── Fields that map to real MOVES properties and are now writable ──────────
  /** MOVES `Owner`, a relation to PEOPLE. Holds a display name or a page id. */
  owner?: string;
  /** MOVES `Flow`, a relation to FLOWS. */
  flow?: string;
  /** MOVES `Touchpoint`. */
  touchpoint?: Touchpoint;
  /** MOVES `Blocked By`. A plain sentence, not a relation. */
  blockedBy?: string;
  /** MOVES `Notes`. */
  notes?: string;
  /** Result of the last write-through, when the server reported one. */
  notionSync?: NotionSyncResult;
}

export interface Station {
  id: number; emoji: string; name: string; status: string;
  description: string; owner: string; created_at?: string;
  notionPageId?: string;
}

export interface ForumPost {
  id: number; author: string; content: string; tag?: string; created_at?: string;
  notionPageId?: string;
}

export interface ForumReply {
  id: number; postId: number; author: string; content: string; created_at?: string;
}

export interface Message {
  id: number; author: string; content: string;
  tag?: 'urgent' | 'important' | 'pinned' | null;
  reactions?: Record<string, string[]>; // emoji → array of person keys who reacted
  reaction?: string; edited?: boolean; created_at?: string;
}

export interface BrainDump {
  id: number; author: string; content: string; tags?: string; drive_link?: string; created_at?: string;
}

export interface Announcement {
  id: number; text: string; priority: 'high' | 'medium' | 'low'; active?: number; created_at?: string;
}

/**
 * The six internal role keys. Must stay in sync with TASK_ROLES in data.ts.
 * Declared here rather than derived from TASK_ROLES to avoid an import cycle.
 */
export type TeamRoleKey =
  | 'monny'
  | 'sunshine'
  | 'bingle'
  | 'pia'
  | 'omar'
  | 'event-support';

/**
 * A Workshop is often led by an outside co-creator, not a team member, so a
 * free-form name is valid. `string & {}` keeps autocomplete on the six keys
 * while still accepting a guest name. Do NOT narrow this back to team keys:
 * the previous union of monny/sunshine/bingle made pia, omar, and every
 * guest co-creator unrepresentable.
 */
export type Facilitator = TeamRoleKey | (string & {});

export interface Workshop {
  id: number;
  title: string;
  description: string;
  facilitator: Facilitator;
  date: string;
  capacity: number;
  participants: number;
  location: string;
  tags: string[];
  googleDocLink?: string;
  status: 'ideation' | 'planning' | 'scheduled' | 'completed';
  created_at?: string;
}

export interface WorkshopProgram {
  id: number;
  seriesName: string;
  description: string;
  learningObjectives: string[];
  sessionOutline: { number: number; title: string; description: string }[];
  targetAudience: string;
  materialsNeeded: string[];
  facilitator: Facilitator;
  created_at?: string;
}

export interface WorkshopResource {
  id: number;
  title: string;
  type: 'google-doc' | 'meeting-notes' | 'template' | 'recording';
  url: string;
  lastUpdated: string;
  author: string;
  created_at?: string;
}

export interface CoFlowDate {
  id: number;
  notionPageId?: string;
  date: string;
  timeRange: string;
  startTime?: string;
  endTime?: string;
  location: string;
  host?: string;
  theme?: string;
  rsvp: Record<string, string>;
  agendaItems: { id: number; text: string; lead: string; timeEstimate: number; done: boolean }[];
  agendaLocked?: boolean;
  notes: string;
  vibeCheck: string;
  sessionNotes?: string;
  attendees?: string[];
  status: 'upcoming' | 'active' | 'archived';
  created_at?: string;
  // ── Fields that map to real FLOWS properties and are now writable ──────────
  /** FLOWS title. Was missing, so every flow was named "CoFlow - <date>". */
  name?: string;
  /** FLOWS `Type`. */
  type?: 'Podyap' | 'Open Studio' | 'Book Club' | 'Workshop' | 'Pop-Up'
       | 'Surprise-ment' | 'Geyser' | 'Internal';
  /** FLOWS `Phase`. Where in the making this flow is. */
  phase?: 'Cohoe' | 'Concepting' | 'Coordinating' | 'Marketing' | 'Day of'
        | 'Decomprocessing' | 'Depanty';
  /** FLOWS `Offering Arc`. */
  offeringArc?: 'Sense' | 'Name' | 'Design' | 'Practice' | 'Integrate' | 'Sustain';
  /** FLOWS `Readiness Outcome`. */
  readinessOutcome?: 'Not yet' | 'Start here' | 'Ready for depth';
  /**
   * FLOWS `Media Cutoff`. Omar's deadline: the date raw media has to be in his
   * hands. Notion's own description reads "Omar deadline. Thursday for Podyaps."
   * Nothing in the dashboard read this field until now.
   */
  mediaCutoff?: string;
  /** FLOWS `Thank-you Due`. First touch of the 14-day return rhythm. */
  thankYouDue?: string;
  /** FLOWS `Hard Stop`. */
  hardStop?: string;
  /** FLOWS `Retro`. One paragraph, after. */
  retro?: string;
  /** FLOWS `Primary Invitation`. The one clear invitation at this stage. */
  primaryInvitation?: string;
  /** FLOWS `Desired Body-Feel`. The felt experience being designed for. */
  desiredBodyFeel?: string;
  /** FLOWS `Capacity`. */
  capacity?: number;
  /** FLOWS `Public?`. */
  isPublic?: boolean;
  /** FLOWS `Public URL`. */
  publicUrl?: string;
  /** FLOWS `Drive Folder`. */
  driveFolder?: string;
  /** FLOWS `Support`, a relation to PEOPLE. */
  support?: string[];
  /** FLOWS `Guests`, a relation to PEOPLE. */
  guests?: string[];
  /** Result of the last write-through, when the server reported one. */
  notionSync?: NotionSyncResult;
}

export interface CoFlowCheckin {
  id: number;
  weekOf: string;
  author: string;
  confirmTime: boolean;
  locationSuggestion: string;
  agendaItems: string[];
  mood?: string;
  timePreference?: string;
  notes?: string;
  created_at?: string;
}

export interface WellNote {
  id: number;
  content: string;
  landed: number;
  created_at?: string;
}

export interface SyncData {
  tasks: Task[];
  stations: Station[];
  forum: ForumPost[];
  messages: Message[];
  braindumps: BrainDump[];
  announcements: Announcement[];
  forumReplies: ForumReply[];
  workshops: Workshop[];
  workshopPrograms: WorkshopProgram[];
  workshopResources: WorkshopResource[];
  coflowDates: CoFlowDate[];
  coflowCheckins: CoFlowCheckin[];
  wellNotes: WellNote[];
  calendarEvents: CalendarEventKV[];
  /**
   * Per-section provenance. Present on /api/dashboard responses, absent on the
   * KV-only /sync response. Read `degraded` before trusting any section:
   * a 200 with empty Notion sections is not the same thing as "no rows".
   */
  meta?: SyncMeta;
}

export type SourceStatus = 'ok' | 'unconfigured' | 'error';

export interface SourceReport {
  /** Where this section came from: a Notion database, Supabase KV, or Google. */
  source: string;
  status: SourceStatus;
  rows: number;
  /** Set when status is 'error'. Set to the missing variable when 'unconfigured'. */
  detail?: string;
}

export interface SyncMeta {
  generatedAt: string;
  /** True when any section is not 'ok'. The UI must not render 'fresh' then. */
  degraded: boolean;
  sources: Record<string, SourceReport>;
}

export interface CalendarEventKV {
  id: string;
  title: string;
  start: string;
  end: string;
  location: string;
  description: string;
  creator: string;
  synced_at?: string;
}
