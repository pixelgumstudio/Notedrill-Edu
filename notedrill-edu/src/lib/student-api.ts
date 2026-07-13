/**
 * Student API client for backend.notedrill.com.
 * See org-api.ts for the shared fetch/envelope conventions.
 */

import { apiFetch, BASE_URL } from "./api-fetch";
import type { LoginResponse, PaginationMeta, StudentNoteSummary, StudentNoteDetail, StudentQuizAttempt, StudentFlashcardSet } from "@/types/edu";

async function studentFetch<T>(path: string, options: Omit<Parameters<typeof apiFetch>[1], "kind"> = {}): Promise<T> {
  return apiFetch<T>(path, { ...options, kind: "student" });
}

async function studentFetchPaginated<T>(
  path: string,
  options: Omit<Parameters<typeof apiFetch>[1], "kind"> = {},
): Promise<{ items: T[]; pagination: PaginationMeta }> {
  const { token, ...rest } = options;
  const res = await fetch(`${BASE_URL}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { message?: string }).message ?? `API error ${res.status}`);
  }
  const json = (await res.json()) as { data: T[]; meta?: { pagination: PaginationMeta } };
  return {
    items: json.data ?? [],
    pagination: json.meta?.pagination ?? { page: 1, limit: json.data?.length ?? 0, total: json.data?.length ?? 0, totalPages: 1, hasNextPage: false, hasPrevPage: false },
  };
}

export const studentApi = {
  // ── Auth (no token required) ──────────────────────────────────────────────

  /** Request a sign-in code. POST /auth/otp/request */
  requestOtp: (email: string): Promise<null> =>
    studentFetch<null>("/auth/otp/request", { method: "POST", body: JSON.stringify({ email }) }),

  /** Verify the sign-in code. POST /auth/otp/verify */
  verifyOtp: (email: string, code: string): Promise<LoginResponse> =>
    studentFetch<LoginResponse>("/auth/otp/verify", { method: "POST", body: JSON.stringify({ email, code }) }),

  // ── Notes ──────────────────────────────────────────────────────────────────

  /** GET /students/dashboard/notes */
  getFiles: (token: string, params?: { page?: number; limit?: number }): Promise<{ items: StudentNoteSummary[]; pagination: PaginationMeta }> => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set("page", String(params.page));
    if (params?.limit) qs.set("limit", String(params.limit));
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return studentFetchPaginated<StudentNoteSummary>(`/students/dashboard/notes${suffix}`, { token });
  },

  /** GET /students/dashboard/notes/:noteId */
  getFile: (token: string, noteId: string): Promise<StudentNoteDetail> =>
    studentFetch<StudentNoteDetail>(`/students/dashboard/notes/${noteId}`, { token }),

  // ── Quizzes ────────────────────────────────────────────────────────────────

  /** GET /students/dashboard/notes/:noteId/quizzes */
  getQuizHistory: (token: string, noteId: string): Promise<{ items: StudentQuizAttempt[]; pagination: PaginationMeta }> =>
    studentFetchPaginated<StudentQuizAttempt>(`/students/dashboard/notes/${noteId}/quizzes`, { token }),

  /** POST /students/dashboard/notes/:noteId/quizzes */
  generateQuiz: (token: string, noteId: string, count: number, timeLimitMinutes: number): Promise<StudentQuizAttempt> =>
    studentFetch<StudentQuizAttempt>(`/students/dashboard/notes/${noteId}/quizzes`, {
      method: "POST",
      body: JSON.stringify({ count, timeLimitMinutes }),
      token,
    }),

  // Note: there is no GET for a single attempt by id on this backend — the
  // list endpoint above only returns summary fields (no questions/review).
  // The quiz-taking and results pages carry the full payload through
  // sessionStorage from the generate/submit responses instead.

  /** POST /students/dashboard/notes/:noteId/quizzes/:attemptId/submit */
  submitQuiz: (
    token: string,
    noteId: string,
    attemptId: string,
    answers: { questionIndex: number; answer: string }[],
    timeTakenSeconds: number,
  ): Promise<StudentQuizAttempt> =>
    studentFetch<StudentQuizAttempt>(`/students/dashboard/notes/${noteId}/quizzes/${attemptId}/submit`, {
      method: "POST",
      body: JSON.stringify({ answers, timeTakenSeconds }),
      token,
    }),

  // ── Flashcards ─────────────────────────────────────────────────────────────

  /** GET /students/dashboard/notes/:noteId/flashcards */
  getFlashcardHistory: (token: string, noteId: string): Promise<{ items: StudentFlashcardSet[]; pagination: PaginationMeta }> =>
    studentFetchPaginated<StudentFlashcardSet>(`/students/dashboard/notes/${noteId}/flashcards`, { token }),

  // Note: there is no GET for a single flashcard set by id — but unlike
  // quizzes, the list endpoint above already returns full `cards[]` per
  // entry, so callers should find the set within getFlashcardHistory.

  /** POST /students/dashboard/notes/:noteId/flashcards */
  generateFlashcards: (token: string, noteId: string, count: number): Promise<StudentFlashcardSet> =>
    studentFetch<StudentFlashcardSet>(`/students/dashboard/notes/${noteId}/flashcards`, {
      method: "POST",
      body: JSON.stringify({ count }),
      token,
    }),
};
