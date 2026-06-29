import type {
  StudentFile,
  StudentQuizAttempt,
  StudentFlashcardSession,
  FlashCard,
  StudentQuizResult,
} from '@/types/edu';
import type { AdminGeneratedQuiz, AdminGeneratedFlashcardSet } from '@/types/edu';

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8081/api/v1';

/** Fetch from /api/v1/* and unwrap the `.data` field from successResponse. */
async function baseFetch<T>(path: string, options: RequestInit & { token?: string } = {}): Promise<T> {
  const { token, ...fetchOptions } = options;

  const res = await fetch(`${BASE_URL}${path}`, {
    ...fetchOptions,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(fetchOptions.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { message?: string }).message ?? `API error ${res.status}`);
  }

  const json = await res.json();
  return (json?.data ?? json) as T;
}

// ── Response shapes from the backend ─────────────────────────────────────────

/** Raw note shape returned by GET /notes */
interface RawNote {
  _id: string;
  title: string;
  sourceType?: string;
  type?: string;
  summary?: string;
  createdAt: string;
  orgId?: string;
}

/** Raw quiz shape returned by GET /quizzes/note/:noteId */
interface RawQuizAttempt {
  _id: string;
  totalQuestions: number;
  averageScore?: number;
  createdAt: string;
  lastAttemptAt?: string;
}

/** Raw flashcard set shape returned by GET /flashcards */
interface RawFlashcardSet {
  _id: string;
  totalCards: number;
  masteredCards?: number;
  createdAt: string;
}

/** Quiz submit result from POST /quizzes/:id/submit */
export interface QuizSubmitResult {
  score: number;
  correctCount: number;
  totalQuestions: number;
  percentage: number;
  results: Array<{
    questionIndex: number;
    questionText: string;
    userAnswer: string;
    correctAnswer: string;
    isCorrect: boolean;
    explanation: string;
  }>;
}

// ── Mappers ───────────────────────────────────────────────────────────────────

function mapNote(n: RawNote): StudentFile {
  return {
    id: n._id,
    title: n.title,
    type: (n.sourceType ?? n.type ?? 'pdf') as StudentFile['type'],
    uploadedBy: '',
    uploadedAt: new Date(n.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    quizCount: 0,
    flashcardSetCount: 0,
    summary: n.summary,
    summaryTitle: n.title,
  };
}

function mapQuizAttempt(q: RawQuizAttempt): StudentQuizAttempt {
  const d = new Date(q.lastAttemptAt ?? q.createdAt);
  return {
    id: q._id,
    questionCount: q.totalQuestions,
    score: q.averageScore ?? 0,
    date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    time: d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
  };
}

function mapFlashcardSession(s: RawFlashcardSet): StudentFlashcardSession {
  return {
    id: s._id,
    cardCount: s.totalCards,
    date: new Date(s.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    reviewedAll: (s.masteredCards ?? 0) >= s.totalCards,
  };
}

// ── API surface ───────────────────────────────────────────────────────────────

export const studentApi = {
  /** All notes visible to this student (own + org). GET /notes */
  getFiles: async (token: string): Promise<StudentFile[]> => {
    const data = await baseFetch<RawNote[] | RawNote>('/notes', { token });
    const notes = Array.isArray(data) ? data : [];
    return notes.map(mapNote);
  },

  /** Single note detail. GET /notes/:noteId */
  getFile: async (token: string, id: string): Promise<StudentFile> => {
    const note = await baseFetch<RawNote>(`/notes/${id}`, { token });
    return mapNote(note);
  },

  /** Quiz attempts for a note. GET /quizzes/note/:noteId */
  getQuizHistory: async (token: string, fileId: string): Promise<StudentQuizAttempt[]> => {
    const data = await baseFetch<RawQuizAttempt[]>(`/quizzes/note/${fileId}`, { token });
    const quizzes = Array.isArray(data) ? data : [];
    return quizzes.map(mapQuizAttempt);
  },

  /** Flashcard sets for a note. GET /flashcards?noteId=... */
  getFlashcardHistory: async (token: string, fileId: string): Promise<StudentFlashcardSession[]> => {
    const data = await baseFetch<RawFlashcardSet[]>(`/flashcards?noteId=${fileId}`, { token });
    const sets = Array.isArray(data) ? data : [];
    return sets.map(mapFlashcardSession);
  },

  /**
   * Generate a new quiz. POST /quizzes/generate
   * Returns the full quiz (with correctAnswer) — used to cache questions locally.
   */
  generateQuiz: (
    token: string,
    noteId: string,
    opts: { questionCount: number; difficulty?: string },
  ): Promise<AdminGeneratedQuiz> =>
    baseFetch<AdminGeneratedQuiz>('/quizzes/generate', {
      method: 'POST',
      token,
      body: JSON.stringify({
        noteId,
        questionCount: opts.questionCount,
        difficulty: opts.difficulty ?? 'medium',
      }),
    }),

  /**
   * Fetch a quiz by ID. GET /quizzes/:quizId
   * Returns questions without revealing correct answers to the UI (page responsible for hiding them).
   */
  getQuizById: (token: string, quizId: string): Promise<AdminGeneratedQuiz> =>
    baseFetch<AdminGeneratedQuiz>(`/quizzes/${quizId}`, { token }),

  /**
   * Submit quiz answers. POST /quizzes/:quizId/submit
   * answers: array of letter strings indexed by question — e.g. ["A", "B", "C", "A"]
   */
  submitQuiz: (token: string, quizId: string, answers: string[]): Promise<QuizSubmitResult> =>
    baseFetch<QuizSubmitResult>(`/quizzes/${quizId}/submit`, {
      method: 'POST',
      token,
      body: JSON.stringify({ answers }),
    }),

  /** Generate new flashcards. POST /flashcards/generate */
  generateFlashcards: (
    token: string,
    noteId: string,
    opts: { cardCount: number; difficulty?: string },
  ): Promise<AdminGeneratedFlashcardSet> =>
    baseFetch<AdminGeneratedFlashcardSet>('/flashcards/generate', {
      method: 'POST',
      token,
      body: JSON.stringify({
        noteId,
        cardCount: opts.cardCount,
        difficulty: opts.difficulty ?? 'medium',
      }),
    }),

  /** Get a flashcard set by ID. GET /flashcards/:setId */
  getFlashcardSet: (token: string, setId: string): Promise<AdminGeneratedFlashcardSet> =>
    baseFetch<AdminGeneratedFlashcardSet>(`/flashcards/${setId}`, { token }),
};
