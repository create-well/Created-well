import type {
  Task, Station, ForumPost, ForumReply, Message, BrainDump,
  Announcement, Workshop, WorkshopProgram, WorkshopResource,
  CoFlowDate, CoFlowCheckin, WellNote,
} from '../app/components/api';

export type {
  Task, Station, ForumPost, ForumReply, Message, BrainDump,
  Announcement, Workshop, WorkshopProgram, WorkshopResource,
  CoFlowDate, CoFlowCheckin, WellNote,
};

export type SyncStatus = 'loading' | 'fresh' | 'stale' | 'failed';

export interface DashboardPermissions {
  careConsent: boolean;
}

export interface DashboardPayload {
  tasks: Task[];
  stations: Station[];
  forum: ForumPost[];
  messages: Message[];
  brainDumps: BrainDump[];
  announcements: Announcement[];
  forumReplies: ForumReply[];
  workshops: Workshop[];
  workshopPrograms: WorkshopProgram[];
  workshopResources: WorkshopResource[];
  coFlowDates: CoFlowDate[];
  coFlowCheckins: CoFlowCheckin[];
  wellNotes: WellNote[];
  syncStatus: SyncStatus;
  lastSynced: Date | null;
  permissions: DashboardPermissions;
}

export interface DashboardActions {
  addTask: (t: Omit<Task, 'id' | 'created_at'>) => Promise<void>;
  updateTask: (id: number, updates: Partial<Task>) => Promise<void>;
  updateTaskStatus: (id: number, status: Task['status']) => Promise<void>;
  deleteTask: (id: number) => Promise<void>;

  addStation: (s: Omit<Station, 'id' | 'created_at'>) => Promise<void>;
  updateStationStatus: (id: number, status: string) => Promise<void>;
  updateStationOwner: (id: number, owner: string) => Promise<void>;
  updateStationField: (id: number, updates: Partial<Station>) => Promise<void>;
  deleteStation: (id: number) => Promise<void>;

  addForumPost: (p: Omit<ForumPost, 'id' | 'created_at'>) => Promise<void>;
  updateForumPost: (id: number, updates: Partial<ForumPost>) => Promise<void>;
  deleteForumPost: (id: number) => Promise<void>;

  addForumReply: (postId: number, r: { author: string; content: string }) => Promise<void>;
  deleteForumReply: (id: number) => Promise<void>;

  sendMessage: (m: Omit<Message, 'id' | 'created_at'>) => Promise<void>;
  updateMessage: (id: number, content: string) => Promise<void>;
  updateMessageFields: (id: number, fields: Partial<Message>) => Promise<void>;
  deleteMessage: (id: number) => Promise<void>;

  addBrainDump: (d: Omit<BrainDump, 'id' | 'created_at'>) => Promise<void>;
  deleteBrainDump: (id: number) => Promise<void>;

  dismissAnnouncement: (id: number) => Promise<void>;
  addAnnouncement: () => Promise<void>;

  addWorkshop: (w: Omit<Workshop, 'id' | 'created_at'>) => Promise<void>;
  updateWorkshop: (id: number, updates: Partial<Workshop>) => Promise<void>;
  deleteWorkshop: (id: number) => Promise<void>;
  addWorkshopProgram: (p: Omit<WorkshopProgram, 'id' | 'created_at'>) => Promise<void>;
  updateWorkshopProgram: (id: number, updates: Partial<WorkshopProgram>) => Promise<void>;
  deleteWorkshopProgram: (id: number) => Promise<void>;
  addWorkshopResource: (r: Omit<WorkshopResource, 'id' | 'created_at'>) => Promise<void>;
  deleteWorkshopResource: (id: number) => Promise<void>;

  addCoFlowDate: (d: Omit<CoFlowDate, 'id' | 'created_at'>) => Promise<void>;
  updateCoFlowDate: (id: number, updates: Partial<CoFlowDate>) => Promise<void>;
  deleteCoFlowDate: (id: number) => Promise<void>;
  addCoFlowCheckin: (c: Omit<CoFlowCheckin, 'id' | 'created_at'>) => Promise<void>;
  deleteCoFlowCheckin: (id: number) => Promise<void>;

  addWellNote: (content: string) => Promise<void>;
  landWellNote: (id: number) => Promise<void>;

  retrySync: () => void;
  signOut: () => Promise<void>;
}

export interface DashboardUI {
  chatActiveUser: string;
  setChatActiveUser: (user: string) => void;
  activePerson: string | null;
  setActivePerson: (person: string | null) => void;
  showWelcome: boolean;
  setShowWelcome: (v: boolean) => void;
  movesDefaultTab: 'overview' | 'stations' | 'forum';
  setMovesDefaultTab: (tab: 'overview' | 'stations' | 'forum') => void;
}

export interface DashboardContextValue {
  data: DashboardPayload;
  actions: DashboardActions;
  ui: DashboardUI;
}
