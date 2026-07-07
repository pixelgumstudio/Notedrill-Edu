/**
 * Org API client for the NoteDrill Edu platform.
 *
 * All endpoints use `successResponse({ ... })` on the backend, which wraps
 * the payload in `{ success, data, message }`. orgFetch extracts `.data`
 * automatically so callers receive the inner payload directly.
 *
 * Base URL env var: NEXT_PUBLIC_API_URL (fallback: http://localhost:8081/api/v1)
 */

import type { OrgRegisterInput, OrgOtpRequestInput, OrgOtpVerifyInput } from '@notedrill/validation';
import type {
  OrgStudent,
  OrgDashboardMetrics,
  OrgStudentActivity,
  NoteDetail,
  AdminGeneratedQuiz,
  AdminGeneratedFlashcardSet,
} from '@/types/edu';
import {
  ORG_TOKEN_KEY,
  STUDENT_TOKEN_KEY,
  ORG_REFRESH_TOKEN_KEY,
  STUDENT_REFRESH_TOKEN_KEY,
  TOKEN_REFRESHED_EVENT,
  SESSION_EXPIRED_EVENT,
} from '@/context/AuthContext';

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8081/api/v1';

type RequestOptions = RequestInit & { token?: string };

// ── Silent token refresh ────────────────────────────────────────────────────
// Access tokens expire after 15 minutes. When an authenticated call comes
// back TOKEN_EXPIRED, we transparently exchange the stored refresh token for
// a new pair and retry once — the caller never sees the expiry. Concurrent
// 401s share a single in-flight refresh per token kind (dedup) since the
// refresh token rotates server-side and a second call with the same
// already-consumed refresh token would fail.

let orgRefreshPromise: Promise<string | null> | null = null;
let studentRefreshPromise: Promise<string | null> | null = null;

function tokenKind(token: string): 'org' | 'student' | null {
  if (typeof window === 'undefined') return null;
  if (token === localStorage.getItem(ORG_TOKEN_KEY)) return 'org';
  if (token === localStorage.getItem(STUDENT_TOKEN_KEY)) return 'student';
  return null;
}

async function doRefresh(kind: 'org' | 'student'): Promise<string | null> {
  const accessKey = kind === 'org' ? ORG_TOKEN_KEY : STUDENT_TOKEN_KEY;
  const refreshKey = kind === 'org' ? ORG_REFRESH_TOKEN_KEY : STUDENT_REFRESH_TOKEN_KEY;
  const refreshToken = localStorage.getItem(refreshKey);

  if (!refreshToken) {
    window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT, { detail: { kind } }));
    return null;
  }

  try {
    const res = await fetch(`${BASE_URL}/auth/refresh-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) throw new Error('Refresh failed');

    const json = await res.json();
    const tokens = json?.data?.tokens as { accessToken?: string; refreshToken?: string } | undefined;
    if (!tokens?.accessToken || !tokens?.refreshToken) throw new Error('Malformed refresh response');

    localStorage.setItem(accessKey, tokens.accessToken);
    localStorage.setItem(refreshKey, tokens.refreshToken);
    window.dispatchEvent(new CustomEvent(TOKEN_REFRESHED_EVENT, { detail: { kind, accessToken: tokens.accessToken } }));
    return tokens.accessToken;
  } catch {
    localStorage.removeItem(accessKey);
    localStorage.removeItem(refreshKey);
    window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT, { detail: { kind } }));
    return null;
  }
}

function refreshAccessToken(expiredToken: string): Promise<string | null> {
  const kind = tokenKind(expiredToken);
  if (!kind) return Promise.resolve(null);

  if (kind === 'org') {
    if (!orgRefreshPromise) {
      orgRefreshPromise = doRefresh('org').finally(() => { orgRefreshPromise = null; });
    }
    return orgRefreshPromise;
  }
  if (!studentRefreshPromise) {
    studentRefreshPromise = doRefresh('student').finally(() => { studentRefreshPromise = null; });
  }
  return studentRefreshPromise;
}

/**
 * Runs `makeRequest` with the given token; on a 401 TOKEN_EXPIRED response,
 * silently refreshes and retries once with the new token.
 */
async function fetchWithAuthRetry(
  makeRequest: (token: string | undefined) => Promise<Response>,
  token: string | undefined,
): Promise<Response> {
  const res = await makeRequest(token);
  if (res.status !== 401 || !token) return res;

  const body = await res.clone().json().catch(() => null);
  if (body?.code !== 'TOKEN_EXPIRED') return res;

  const newToken = await refreshAccessToken(token);
  if (!newToken) return res;

  return makeRequest(newToken);
}

/** Fetch from /api/v1/org/* and unwrap the `.data` field from successResponse. */
async function orgFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { token, ...fetchOptions } = options;

  const res = await fetchWithAuthRetry(
    (tok) =>
      fetch(`${BASE_URL}/org${path}`, {
        ...fetchOptions,
        headers: {
          'Content-Type': 'application/json',
          ...(tok ? { Authorization: `Bearer ${tok}` } : {}),
          ...(fetchOptions.headers ?? {}),
        },
      }),
    token,
  );

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { message?: string }).message ?? `API error ${res.status}`);
  }

  const json = await res.json();
  // Unwrap { success, data, message } envelope produced by successResponse()
  return (json?.data ?? json) as T;
}

/** Fetch from /api/v1/* directly (no /org prefix) — used for notes, quizzes, flashcards. */
async function baseFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { token, ...fetchOptions } = options;

  const res = await fetchWithAuthRetry(
    (tok) =>
      fetch(`${BASE_URL}${path}`, {
        ...fetchOptions,
        headers: {
          'Content-Type': 'application/json',
          ...(tok ? { Authorization: `Bearer ${tok}` } : {}),
          ...(fetchOptions.headers ?? {}),
        },
      }),
    token,
  );

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { message?: string }).message ?? `API error ${res.status}`);
  }

  const json = await res.json();
  return (json?.data ?? json) as T;
}

/** Multipart POST — does NOT set Content-Type (browser sets multipart boundary). */
async function uploadFetch<T>(path: string, token: string | undefined, body: FormData): Promise<T> {
  const res = await fetchWithAuthRetry(
    (tok) =>
      fetch(`${BASE_URL}${path}`, {
        method: 'POST',
        headers: tok ? { Authorization: `Bearer ${tok}` } : {},
        body,
      }),
    token,
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? `API error ${res.status}`);
  }

  const json = await res.json();
  return (json?.data ?? json) as T;
}

// ── Response types (shaped after the backend controllers) ─────────────────────

/** Returned by GET /notes/jobs/:jobId */
export type JobStatus = {
  jobId: string;
  status: 'processing' | 'completed' | 'failed';
  result: (NoteDetail & { id: string; noteId: string }) | null;
  error: string | null;
};

/** Returned by POST /org/register — inside successResponse.data */
export type OrgRegisterResponse = { orgId: string; schoolId: string };

/** Returned by POST /org/login/request (OTP send) — message-only */
export type OtpRequestResponse = { email: string; schoolId: string; expiresIn: number };

/** Returned by POST /org/login/verify — inside successResponse.data */
export type OtpVerifyResponse = {
  user: {
    id: string;
    email: string;
    name: string;
    username: string;
    orgId: string;
    role: string;
  };
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
};

/** Returned by POST /org/student/login/verify */
export type StudentVerifyResponse = OtpVerifyResponse;

/** Returned by POST /org/students/bulk */
export type BulkStudentUploadResult = {
  successCount: number;
  failureCount: number;
  errors: { email: string; reason: string }[];
};

export type StudentLoginRequest = { email: string };
export type StudentLoginResponse = { email: string; orgId: string; expiresIn: number };

// ── API surface ───────────────────────────────────────────────────────────────

export const orgApi = {
  // ── Auth (no token required) ──────────────────────────────────────────────

  /** Register a new organisation. POST /org/register */
  register: (data: OrgRegisterInput): Promise<OrgRegisterResponse> =>
    orgFetch<OrgRegisterResponse>('/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /** "Forgot your School ID" — always resolves with a generic message. POST /org/recover-school-id */
  recoverSchoolId: (adminEmail: string): Promise<null> =>
    orgFetch<null>('/recover-school-id', {
      method: 'POST',
      body: JSON.stringify({ adminEmail }),
    }),

  /** Request an OTP for org admin login. POST /org/login/request */
  requestOtp: (data: OrgOtpRequestInput): Promise<OtpRequestResponse> =>
    orgFetch<OtpRequestResponse>('/login/request', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /** Verify OTP and receive a JWT. POST /org/login/verify */
  verifyOtp: (data: OrgOtpVerifyInput): Promise<OtpVerifyResponse> =>
    orgFetch<OtpVerifyResponse>('/login/verify', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /** Request OTP for student login. POST /org/student/login/request */
  studentRequestOtp: (data: StudentLoginRequest): Promise<StudentLoginResponse> =>
    orgFetch<StudentLoginResponse>('/student/login/request', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /** Verify student OTP and receive a JWT. POST /org/student/login/verify */
  studentVerifyOtp: (
    data: { email: string; otp: string },
  ): Promise<StudentVerifyResponse> =>
    orgFetch<StudentVerifyResponse>('/student/login/verify', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // ── Org admin — authenticated ─────────────────────────────────────────────

  /** Dashboard metrics. GET /org/dashboard */
  getDashboardMetrics: (token: string): Promise<OrgDashboardMetrics> =>
    orgFetch<OrgDashboardMetrics>('/dashboard', { token }),

  /**
   * Start a subscription checkout — routed server-side to Paystack or Polar
   * based on the org's registered country. POST /org/billing/checkout
   */
  createBillingCheckout: (token: string): Promise<{ checkoutUrl: string }> =>
    orgFetch<{ checkoutUrl: string }>('/billing/checkout', { method: 'POST', token }),

  /** All students for this org. GET /org/students?filter= */
  getOrgStudents: (token: string, filter?: string): Promise<OrgStudent[]> =>
    orgFetch<OrgStudent[]>(`/students${filter ? `?filter=${filter}` : ''}`, { token }),

  /** Single student detail. GET /org/students/:id */
  getOrgStudent: (token: string, id: string): Promise<OrgStudent> =>
    orgFetch<OrgStudent>(`/students/${id}`, { token }),

  /** Student quiz + flashcard activity. GET /org/students/:id/activity */
  getOrgStudentActivity: (token: string, id: string): Promise<OrgStudentActivity> =>
    orgFetch<OrgStudentActivity>(`/students/${id}/activity`, { token }),

  /** Invite/add a student. POST /org/students */
  addOrgStudent: (
    token: string,
    data: { email: string; firstName: string; lastName?: string },
  ): Promise<{ email: string; expiresIn: number }> =>
    orgFetch<{ email: string; expiresIn: number }>('/students', {
      method: 'POST',
      body: JSON.stringify(data),
      token,
    }),

  /** Remove a student. DELETE /org/students/:id */
  removeOrgStudent: (token: string, id: string): Promise<null> =>
    orgFetch<null>(`/students/${id}`, { method: 'DELETE', token }),

  /**
   * Bulk-invite students from a CSV file (columns: email, firstName, lastName?).
   * POST /org/students/bulk
   */
  addOrgStudentsBulk: (token: string, file: File): Promise<BulkStudentUploadResult> => {
    const fd = new FormData();
    fd.append('file', file);
    return uploadFetch<BulkStudentUploadResult>('/org/students/bulk', token, fd);
  },

  // ── Note ingestion & retrieval ────────────────────────────────────────────

  /**
   * Upload file or text content and generate a note.
   * POST /notes/generate (multipart for files, JSON for text/youtube)
   */
  uploadContent: (
    token: string,
    payload: {
      source: 'pdf' | 'image' | 'text' | 'youtube';
      file?: File | null;
      text?: string;
    },
  ): Promise<NoteDetail | { jobId: string }> => {
    if (payload.source === 'pdf' || payload.source === 'image') {
      const fd = new FormData();
      if (payload.file) fd.append('file', payload.file);
      fd.append('sourceType', payload.source);
      return uploadFetch<NoteDetail>('/notes/generate', token, fd);
    }
    return baseFetch<NoteDetail>('/notes/generate', {
      method: 'POST',
      token,
      body: JSON.stringify(
        payload.source === 'youtube'
          ? { content: payload.text, sourceType: 'youtube' }
          : { content: payload.text, sourceType: 'text' },
      ),
    });
  },

  /** List org admin's uploaded notes. GET /notes */
  getNotes: (token: string): Promise<NoteDetail[]> =>
    baseFetch<NoteDetail[]>('/notes', { token }),

  /** Get single note detail + summary. GET /notes/:noteId */
  getNoteById: (token: string, noteId: string): Promise<NoteDetail> =>
    baseFetch<NoteDetail>(`/notes/${noteId}`, { token }),

  /** Poll background note-generation job. GET /notes/jobs/:jobId */
  getJobStatus: (token: string, jobId: string): Promise<JobStatus> =>
    baseFetch<JobStatus>(`/notes/jobs/${jobId}`, { token }),

  /**
   * Append more AI-generated questions or cards to an existing set.
   * POST /notes/:noteId/generate-more
   */
  generateMore: (
    token: string,
    noteId: string,
    payload: {
      type: 'quiz' | 'flashcards';
      count: number;
      quizId?: string | null;
      flashcardSetId?: string | null;
    },
  ): Promise<
    | { type: 'quiz'; quizId: string | null; questions: import('@/types/edu').AdminQuizQuestion[] }
    | { type: 'flashcards'; flashcardSetId: string | null; cards: import('@/types/edu').AdminFlashcard[] }
  > =>
    baseFetch(`/notes/${noteId}/generate-more`, {
      method: 'POST',
      token,
      body: JSON.stringify(payload),
    }),

  /**
   * Update a single quiz question by index. PATCH /quizzes/:quizId/questions/:questionIndex
   */
  updateQuizQuestion: (
    token: string,
    quizId: string,
    questionIndex: number,
    data: { questionText?: string; options?: string[]; correctAnswer?: number | string; explanation?: string },
  ): Promise<{ index: number; question: import('@/types/edu').AdminQuizQuestion }> =>
    baseFetch(`/quizzes/${quizId}/questions/${questionIndex}`, {
      method: 'PATCH',
      token,
      body: JSON.stringify(data),
    }),

  /**
   * Update a flashcard front/back. PUT /flashcards/:setId/cards/:cardId
   */
  updateFlashcard: (
    token: string,
    setId: string,
    cardId: string,
    data: { front?: string; back?: string },
  ): Promise<unknown> =>
    baseFetch(`/flashcards/${setId}/cards/${cardId}`, {
      method: 'PUT',
      token,
      body: JSON.stringify(data),
    }),

  // ── Admin content generation (answers visible immediately) ────────────────

  /**
   * Generate a quiz for a note. POST /quizzes/generate
   * Admin bypass: full questions + correctAnswer returned immediately — no quiz submission required.
   */
  generateAdminQuiz: (
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
   * Generate flashcards for a note. POST /flashcards/generate
   * Admin bypass: both front + back visible immediately.
   */
  generateAdminFlashcards: (
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

  /**
   * Get previously-generated quizzes for a note. GET /quizzes/note/:noteId
   * Used to restore the Assessments tab when re-visiting a file workspace.
   */
  getQuizzesByNote: (token: string, noteId: string): Promise<AdminGeneratedQuiz[]> =>
    baseFetch<AdminGeneratedQuiz[]>(`/quizzes/note/${noteId}`, { token }),

  /**
   * Get previously-generated flashcard sets for a note. GET /flashcards?noteId=...
   * Used to restore the Assessments tab when re-visiting a file workspace.
   */
  getFlashcardSetsByNote: (token: string, noteId: string): Promise<AdminGeneratedFlashcardSet[]> =>
    baseFetch<AdminGeneratedFlashcardSet[]>(`/flashcards?noteId=${noteId}`, { token }),

  /** Delete a quiz. DELETE /quizzes/:id */
  deleteQuiz: (token: string, quizId: string): Promise<{ success: boolean; message: string }> =>
    baseFetch(`/quizzes/${quizId}`, { method: 'DELETE', token }),

  /** Delete a flashcard set. DELETE /flashcards/:setId */
  deleteFlashcardSet: (token: string, setId: string): Promise<{ success: boolean; message: string }> =>
    baseFetch(`/flashcards/${setId}`, { method: 'DELETE', token }),

  /**
   * Export quiz with full answers. GET /quizzes/:id/export/answers
   * Returns a download URL or triggers file download.
   */
  getQuizExportUrl: (quizId: string, type: 'questions' | 'answers', format: 'pdf' | 'docx' = 'pdf'): string =>
    `${BASE_URL}/quizzes/${quizId}/export/${type}?format=${format}`,

  /**
   * Export flashcard set. GET /flashcards/:id/export/answers
   */
  getFlashcardExportUrl: (setId: string, type: 'questions' | 'answers', format: 'pdf' | 'docx' = 'pdf'): string =>
    `${BASE_URL}/flashcards/${setId}/export/${type}?format=${format}`,
};
