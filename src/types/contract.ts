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

export interface Task {
  id: number; person: string; title: string;
  // 'dropped' exists because MOVES has a Dropped status and the Create Well
  // governance rule is that Dropped stays visible as dropped. It is not
  // collapsed into 'done' and not hidden as 'blocked'.
  status: 'todo' | 'in_progress' | 'done' | 'blocked' | 'dropped';
  priority: 'high' | 'medium' | 'low';
  due_date?: string; source?: string; category?: string; created_at?: string;
  notionPageId?: string;
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
