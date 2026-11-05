// MOCK: Placeholder data for development. Replace with live DashboardContext when connected.
import type { DashboardPayload } from '../types/dashboard';

export const MOCK_PAYLOAD: DashboardPayload = {
  tasks: [],
  stations: [],
  forum: [],
  contentFlowSnapshot: { status: 'error' },
  canonicalSourceStatuses: { moves: 'unknown', people: 'unknown', flows: 'unknown', content: 'unknown', money: 'unknown' },
  messages: [],
  brainDumps: [],
  announcements: [],
  forumReplies: [],
  workshops: [],
  workshopPrograms: [],
  workshopResources: [],
  coFlowDates: [],
  coFlowCheckins: [],
  wellNotes: [],
  money: [],
  decisions: [],
  syncStatus: 'fresh',
  lastSynced: new Date(),
  syncFreshness: null,
  peopleCare: null,
  openAsksCare: null,
  permissions: {
    careConsent: false,
  },
};
