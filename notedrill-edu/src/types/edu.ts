// ── Generic UI shapes (shared display components, not tied to one endpoint) ──

/** Shape QuizCard renders — mapped from whichever quiz payload is in play. */
export interface QuizQuestion {
  id: string;
  text: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

/** Shape FlashcardFlip renders — mapped from whichever flashcard payload is in play. */
export interface FlashCard {
  id: string;
  question: string;
  answer: string;
}

// ── Auth (backend.notedrill.com) ─────────────────────────────────────────────
// Single JWT per session (no refresh token). Payload only carries
// { id, orgId, role, iat, exp } — no name/email — so the login response's
// `user` object is persisted separately (see AuthContext) for display.

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: "owner" | "student";
}

export interface Org {
  _id: string;
  name: string;
  schoolType: "primary" | "secondary" | "tertiary" | "tutorial_center" | "other";
  state: string;
  city: string;
  examFocus: string[];
  estimatedStudents: number;
  adminContact: {
    name: string;
    role: string;
    email: string;
    phone: string;
  };
  plan: string;
  amountDue: number;
  seatLimit: number;
  createdAt: string;
  updatedAt: string;
}

export interface RegisterResponse {
  token: string;
  organization: Org;
  user: AuthUser;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}

// ── Org student management ───────────────────────────────────────────────────

export interface OrgStudent {
  id: string;
  name: string;
  initials: string;
  email: string;
  phone: string;
  quizzesTaken: number;
  averageScore: number | null;
  flashcardSessions: number;
  lastActive: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface StudentQuizHistoryEntry {
  id: string;
  noteId: string;
  noteTitle: string;
  questionCount: number;
  scorePercentage: number;
  correctCount: number;
  totalQuestions: number;
  grade: string;
  timeTakenSeconds: number;
  completedAt: string;
  createdAt: string;
}

export interface StudentFlashcardHistoryEntry {
  id: string;
  noteId: string;
  noteTitle: string;
  cardCount: number;
  createdAt: string;
}

export interface OrgStudentDetail {
  student: OrgStudent;
  metrics: {
    quizzesTaken: number;
    averageScore: number | null;
    flashcardSessions: number;
    lastActive: string | null;
  };
  quizHistory: StudentQuizHistoryEntry[];
  flashcardHistory: StudentFlashcardHistoryEntry[];
}

export interface OrgDashboardStats {
  students: {
    total: number;
    seatLimit: number;
    seatsRemaining: number;
    activeThisWeek: number;
    neverLoggedIn: number;
    activeLast30Days: number;
  };
  quizzes: {
    taken: number;
    averageScore: number | null;
  };
  flashcards: {
    sessions: number;
  };
  billing: {
    plan: string;
    amountDue: number;
    seatLimit: number;
    seatsUsed: number;
    seatsRemaining: number;
  };
}

// ── File management (org/admin side, /org/files) ─────────────────────────────

export type SourceType = "pdf" | "text" | "youtube" | "image" | "audio";
export type NoteStatus = "processing" | "ready" | "failed";

/** List item from GET /org/files */
export interface OrgNoteSummary {
  id: string;
  title: string;
  sourceType: SourceType;
  status: NoteStatus;
  summaryGeneratedAt?: string;
  createdAt: string;
}

/**
 * Full note detail. GET /org/files/:id/note returns { id, title, sourceType,
 * status, summary, summaryGeneratedAt, createdAt }. POST /org/files instead
 * returns its `note` under `_id` — org-api.ts normalizes that to `id` so
 * every caller can rely on a single consistent shape.
 */
export interface OrgNoteDetail {
  id: string;
  orgId?: string;
  uploadedBy?: string;
  title: string;
  sourceType: SourceType;
  sourceUrl?: string;
  sourceMimeType?: string;
  status: NoteStatus;
  summary?: string;
  summaryGeneratedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

/** Combined list item from GET /org/files/:id/quizzes-and-flashcards */
export interface OrgGeneratedSetSummary {
  id: string;
  noteId: string;
  noteTitle: string;
  questionCount: number;
  type: "quiz" | "flashcardSet";
  createdAt: string;
}

// ── Quiz / flashcard generation (admin bypass — answers visible) ─────────────

export interface AdminQuizQuestion {
  question: string;
  /** Options are pre-labeled "A. ...", "B. ...", etc. by the backend. */
  options: string[];
  correctAnswer: string;
  explanation: string;
}

export interface AdminGeneratedQuiz {
  _id: string;
  noteId: string;
  orgId: string;
  title?: string;
  generatedByRole: "owner";
  questions: AdminQuizQuestion[];
  createdAt: string;
  updatedAt: string;
}

export interface AdminFlashcard {
  question: string;
  answer: string;
}

export interface AdminGeneratedFlashcardSet {
  _id: string;
  noteId: string;
  orgId: string;
  title?: string;
  generatedByRole: "owner";
  cards: AdminFlashcard[];
  createdAt: string;
  updatedAt: string;
}

// ── Student-facing notes/quizzes/flashcards (/students/dashboard/notes/*) ────

export interface StudentNoteSummary {
  id: string;
  orgId: string;
  uploadedBy: string;
  title: string;
  sourceType: SourceType;
  sourceUrl?: string;
  sourceMimeType?: string;
  status: NoteStatus;
  quizCount: number;
  flashcardSetCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface StudentNoteDetail {
  id: string;
  orgId: string;
  uploadedBy: string;
  title: string;
  sourceType: SourceType;
  sourceUrl?: string;
  sourceMimeType?: string;
  summary?: string;
  summaryGeneratedAt?: string;
  status: NoteStatus;
  stats: {
    quizCount: number;
    flashcardSetCount: number;
    bestScorePercentage: number | null;
  };
  createdAt: string;
  updatedAt: string;
}

export type StudentQuizStatus = "in_progress" | "completed";

export interface StudentQuizOption {
  index: number;
  question: string;
  options: string[];
}

/** A student's quiz attempt — shape is shared across list/generate/submit/get-by-id. */
export interface StudentQuizAttempt {
  id: string;
  noteId: string;
  orgId: string;
  noteTitle: string;
  questionCount: number;
  status: StudentQuizStatus;
  scorePercentage: number | null;
  correctCount: number | null;
  totalQuestions: number;
  grade: string | null;
  timeLimitMinutes: number;
  timeTakenSeconds?: number;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  /** Present while in_progress (no correct answers included) or right after generation. */
  questions?: StudentQuizOption[];
  /** Present only in the submit response. */
  review?: StudentQuizReviewItem[];
}

export interface StudentQuizReviewItem {
  questionIndex: number;
  question: string;
  selectedAnswer: string;
  correctAnswer: string;
  explanation: string;
  isCorrect: boolean;
}

export interface StudentFlashcardSet {
  id: string;
  noteId: string;
  orgId: string;
  noteTitle: string;
  cardCount: number;
  cards: { question: string; answer: string }[];
  createdAt: string;
  updatedAt: string;
}
