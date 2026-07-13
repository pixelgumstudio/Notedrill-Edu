/**
 * Org (admin) API client for backend.notedrill.com.
 *
 * All endpoints use `{ success, message, data, meta? }`; apiFetch unwraps
 * `.data` automatically so callers receive the inner payload directly.
 *
 * Base URL env var: NEXT_PUBLIC_API_URL (fallback: https://backend.notedrill.com)
 * No `/api/v1` prefix — routes are mounted directly off the root.
 */

import { apiFetch, BASE_URL } from "./api-fetch";
import type {
  RegisterResponse,
  LoginResponse,
  OrgStudent,
  OrgStudentDetail,
  OrgDashboardStats,
  PaginationMeta,
  OrgNoteSummary,
  OrgNoteDetail,
  OrgGeneratedSetSummary,
  AdminGeneratedQuiz,
  AdminGeneratedFlashcardSet,
} from "@/types/edu";

type Paginated<T> = { data: T[]; meta: { pagination: PaginationMeta } };

async function orgFetch<T>(path: string, options: Omit<Parameters<typeof apiFetch>[1], "kind"> = {}): Promise<T> {
  return apiFetch<T>(path, { ...options, kind: "org" });
}

/** Fetch a paginated list, returning both the items and the pagination meta. */
async function orgFetchPaginated<T>(
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

export type RegisterInput = {
  schoolName: string;
  schoolType: "primary" | "secondary" | "tertiary" | "tutorial_center" | "other";
  state: string;
  city: string;
  examFocus: string[];
  estimatedStudents: number;
  adminName: string;
  adminRole: string;
  adminEmail: string;
  adminPhone: string;
  password: string;
};

export const orgApi = {
  // ── Auth (no token required) ──────────────────────────────────────────────

  /** Register a new organisation + its owner. POST /org/register */
  register: (data: RegisterInput): Promise<RegisterResponse> =>
    orgFetch<RegisterResponse>("/org/register", { method: "POST", body: JSON.stringify(data) }),

  /** Org admin login (email + password). POST /auth/login */
  login: (data: { email: string; password: string }): Promise<LoginResponse> =>
    orgFetch<LoginResponse>("/auth/login", { method: "POST", body: JSON.stringify(data) }),

  // ── Student management — authenticated ────────────────────────────────────

  /** GET /org/students */
  getOrgStudents: (
    token: string,
    params?: { page?: number; limit?: number; search?: string; filter?: "active_this_week" | "never_logged_in" },
  ): Promise<{ items: OrgStudent[]; pagination: PaginationMeta }> => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set("page", String(params.page));
    if (params?.limit) qs.set("limit", String(params.limit));
    if (params?.search) qs.set("search", params.search);
    if (params?.filter) qs.set("filter", params.filter);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return orgFetchPaginated<OrgStudent>(`/org/students${suffix}`, { token });
  },

  /** GET /org/students/:id */
  getOrgStudent: (token: string, id: string): Promise<OrgStudentDetail> =>
    orgFetch<OrgStudentDetail>(`/org/students/${id}`, { token }),

  /** Add a student — created immediately, no invite step. POST /org/students */
  addOrgStudent: (
    token: string,
    data: { name: string; email: string; phone: string },
  ): Promise<{ id: string; name: string; email: string; phone: string }> =>
    orgFetch(`/org/students`, { method: "POST", body: JSON.stringify(data), token }),

  /** DELETE /org/students/:id */
  removeOrgStudent: (token: string, id: string): Promise<null> =>
    orgFetch<null>(`/org/students/${id}`, { method: "DELETE", token }),

  /** Invalidates the student's active session. POST /org/students/:id/reset-access */
  resetStudentAccess: (token: string, id: string): Promise<null> =>
    orgFetch<null>(`/org/students/${id}/reset-access`, { method: "POST", token }),

  /** GET /org/students/stats */
  getDashboardStats: (token: string): Promise<OrgDashboardStats> =>
    orgFetch<OrgDashboardStats>(`/org/students/stats`, { token }),

  // ── File management ───────────────────────────────────────────────────────

  /** GET /org/files */
  getNotes: (token: string, params?: { page?: number; limit?: number }): Promise<{ items: OrgNoteSummary[]; pagination: PaginationMeta }> => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set("page", String(params.page));
    if (params?.limit) qs.set("limit", String(params.limit));
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return orgFetchPaginated<OrgNoteSummary>(`/org/files${suffix}`, { token });
  },

  /** GET /org/files/:id/note */
  getNoteById: (token: string, id: string): Promise<OrgNoteDetail> =>
    orgFetch<OrgNoteDetail>(`/org/files/${id}/note`, { token }),

  /**
   * Upload/create a note. POST /org/files
   * text/youtube: JSON body. pdf/image: multipart form-data.
   * The create response's `note` comes back keyed by `_id` (unlike every
   * other note endpoint, which uses `id`) — normalized here so callers
   * never have to care which endpoint they hit.
   */
  uploadContent: (
    token: string,
    payload: { source: "pdf" | "image" | "text" | "youtube"; title: string; file?: File | null; text?: string },
  ): Promise<OrgNoteDetail> => {
    const normalize = (note: OrgNoteDetail & { _id?: string }): OrgNoteDetail =>
      note.id ? note : { ...note, id: note._id! };

    if (payload.source === "pdf" || payload.source === "image") {
      const fd = new FormData();
      fd.append("sourceType", payload.source);
      fd.append("title", payload.title);
      if (payload.file) fd.append("file", payload.file);
      return orgFetch<{ note: OrgNoteDetail }>(`/org/files`, { method: "POST", body: fd, token }).then((r) => normalize(r.note));
    }
    const body =
      payload.source === "youtube"
        ? { sourceType: "youtube", title: payload.title, youtubeUrl: payload.text }
        : { sourceType: "text", title: payload.title, content: payload.text };
    return orgFetch<{ note: OrgNoteDetail }>(`/org/files`, { method: "POST", body: JSON.stringify(body), token }).then((r) => normalize(r.note));
  },

  /** POST /org/files/:noteId/quiz */
  generateAdminQuiz: (token: string, noteId: string, count: number): Promise<AdminGeneratedQuiz> =>
    orgFetch<AdminGeneratedQuiz>(`/org/files/${noteId}/quiz`, { method: "POST", body: JSON.stringify({ count }), token }),

  /** POST /org/files/:noteId/flashcards */
  generateAdminFlashcards: (token: string, noteId: string, count: number): Promise<AdminGeneratedFlashcardSet> =>
    orgFetch<AdminGeneratedFlashcardSet>(`/org/files/${noteId}/flashcards`, { method: "POST", body: JSON.stringify({ count }), token }),

  /** GET /org/files/:id/quizzes-and-flashcards — combined list restoring the Assessments tab. */
  getQuizzesAndFlashcards: (token: string, noteId: string): Promise<OrgGeneratedSetSummary[]> =>
    orgFetch<OrgGeneratedSetSummary[]>(`/org/files/${noteId}/quizzes-and-flashcards`, { token }),

  /** GET /quiz/:id */
  getQuizById: (token: string, id: string): Promise<AdminGeneratedQuiz> =>
    orgFetch<AdminGeneratedQuiz>(`/quiz/${id}`, { token }),

  /** GET /flashcards/:id */
  getFlashcardSetById: (token: string, id: string): Promise<AdminGeneratedFlashcardSet> =>
    orgFetch<AdminGeneratedFlashcardSet>(`/flashcards/${id}`, { token }),

  /** DELETE /quiz/:id */
  deleteQuiz: (token: string, id: string): Promise<null> =>
    orgFetch<null>(`/quiz/${id}`, { method: "DELETE", token }),

  /** DELETE /flashcards/:id */
  deleteFlashcardSet: (token: string, id: string): Promise<null> =>
    orgFetch<null>(`/flashcards/${id}`, { method: "DELETE", token }),

  /** GET /quiz/:id/export?format=pdf|docx&includeAnswers=true|false */
  getQuizExportUrl: (id: string, includeAnswers: boolean, format: "pdf" | "docx" = "pdf"): string =>
    `${BASE_URL}/quiz/${id}/export?format=${format}&includeAnswers=${includeAnswers}`,

  /** GET /flashcards/:id/export?format=pdf|docx&includeAnswers=true|false */
  getFlashcardExportUrl: (id: string, includeAnswers: boolean, format: "pdf" | "docx" = "pdf"): string =>
    `${BASE_URL}/flashcards/${id}/export?format=${format}&includeAnswers=${includeAnswers}`,
};
