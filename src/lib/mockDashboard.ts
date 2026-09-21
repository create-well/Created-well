// MOCK: Placeholder data for development. Replace with live DashboardContext when connected.
import type { DashboardPayload } from '../types/dashboard';

export const MOCK_PAYLOAD: DashboardPayload = {
  tasks: [],
  stations: [],
  forum: [],
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
  syncStatus: 'fresh',
  lastSynced: new Date(),
  permissions: {
    careConsent: true,
  },
};
