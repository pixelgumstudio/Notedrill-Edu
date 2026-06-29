// ─── Stats ────────────────────────────────────────────────────────────────────

export interface NotedrillStats {
  users: { total: number; pro: number; free: number };
  notes: {
    total: number;
    today: number;
    thisWeek: number;
    thisMonth: number;
    failed: number;
  };
  content: { flashcardSets: number; quizzes: number; chats: number };
  queue: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  };
  charts: {
    sourceTypeBreakdown: Array<{ type: string; count: number }>;
    signupsLast30Days: Array<{ _id: string; count: number }>;
    notesLast30Days: Array<{ _id: string; count: number }>;
  };
}

export interface NotedrillStatsResponse {
  success: boolean;
  data: NotedrillStats;
}

// ─── Users ────────────────────────────────────────────────────────────────────

export interface NotedrillUser {
  _id: string;
  email: string;
  name?: string;
  username?: string;
  subscription: 'FREE' | 'PRO';
  isBanned: boolean;
  lastActiveAt?: string;
  createdAt: string;
  noteCount: number;
  // Onboarding fields
  goals?: string[];
  contentTypes?: string[];
  reviewStyle?: string;
  frustrations?: string[];
  referralSource?: string;
  authProvider?: string;
  hasCompletedSignup?: boolean;
}

export interface NotedrillUsersPagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
  hasMore: boolean;
}

export interface NotedrillUsersResponse {
  success: boolean;
  data: NotedrillUser[];
  pagination: NotedrillUsersPagination;
}

export interface NotedrillUsersParams {
  page?: number;
  limit?: number;
  search?: string;
  plan?: string;
  sortBy?: string;
  // Onboarding filters (single value; API uses $in so partial matches work)
  goals?: string;
  contentTypes?: string;
  reviewStyle?: string;
  frustrations?: string;
  referralSource?: string;
}

// ─── Queue ────────────────────────────────────────────────────────────────────

export interface NotedrillQueueJob {
  id: string;
  data: Record<string, unknown>;
  progress: number;
  attemptsMade: number;
  timestamp: number;
  processedOn?: number;
  status?: string;
}

export interface NotedrillQueueResponse {
  success: boolean;
  data: {
    counts: {
      waiting: number;
      active: number;
      completed: number;
      failed: number;
      delayed: number;
    };
    activeJobs: NotedrillQueueJob[];
    waitingJobs: NotedrillQueueJob[];
    failedJobs: NotedrillQueueJob[];
  };
}

// ─── Revenue ──────────────────────────────────────────────────────────────────

export interface NotedrillRevenueUser {
  _id: string;
  name: string;
  email: string;
  createdAt: string;
}

export interface NotedrillRevenueData {
  totalPro: number;
  totalFree: number;
  totalUsers: number;
  proByMonth: Array<{ _id: string; count: number }>;
  recentProUsers: NotedrillRevenueUser[];
}

export interface NotedrillRevenueResponse {
  success: boolean;
  data: NotedrillRevenueData;
}

// ─── Content (Notes) ──────────────────────────────────────────────────────────

export interface NotedrillNote {
  _id: string;
  title: string;
  sourceType: string;
  processingStatus: string;
  error?: string;
  isShared?: boolean;
  /** Populated: { _id, email, name } */
  userId?: { _id: string; email: string; name?: string } | null;
  createdAt: string;
}

export interface NotedrillNotesResponse {
  success: boolean;
  data: NotedrillNote[];
  pagination: NotedrillUsersPagination;
}

export interface NotedrillNotesParams {
  page?: number;
  limit?: number;
  status?: string;
  sourceType?: string;
}

// ─── Feedback ─────────────────────────────────────────────────────────────────

export interface NotedrillFeedback {
  _id: string;
  /** Populated: { _id, email, name } */
  userId?: { _id: string; email: string; name?: string } | null;
  /** Populated: { _id, title } */
  noteId?: { _id: string; title: string } | null;
  isPositive: boolean;
  comment?: string;
  createdAt: string;
}

export interface NotedrillFeedbackResponse {
  success: boolean;
  data: NotedrillFeedback[];
  pagination: NotedrillUsersPagination;
}

export interface NotedrillFeedbackParams {
  page?: number;
  limit?: number;
  isPositive?: 'true' | 'false' | '';
  startDate?: string;
  endDate?: string;
}
