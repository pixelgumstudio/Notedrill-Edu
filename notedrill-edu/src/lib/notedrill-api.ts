/**
 * Notedrill Admin API client.
 *
 * Environment variables:
 *   NEXT_PUBLIC_NOTEDRILL_API_URL  – e.g. https://api.notedrill.com/api/v1
 *   NEXT_PUBLIC_NOTEDRILL_ADMIN_KEY – value of ADMIN_API_KEY on the Notedrill backend
 *
 * Auth: x-admin-key header (shared secret, not JWT).
 *
 * ── Implemented endpoints ──────────────────────────────────────────────────────
 *   GET   /admin/stats
 *   GET   /admin/users?page=&limit=&search=&plan=&sortBy=&goals=&contentTypes=&reviewStyle=&frustrations=&referralSource=
 *   PATCH /admin/users/:id/ban
 *   PATCH /admin/users/:id/quota
 *   PATCH /admin/users/bulk
 *   GET   /admin/content?page=&limit=&status=&sourceType=
 *   PATCH /admin/content/:id/unshare
 *   DELETE /admin/content/:id
 *   GET   /admin/feedback?page=&limit=&isPositive=&startDate=&endDate=
 *   GET   /admin/queue
 *   POST  /admin/queue/:jobId/retry
 *   GET   /admin/revenue
 */

import type {
  NotedrillStatsResponse,
  NotedrillUsersResponse,
  NotedrillUsersParams,
  NotedrillNotesResponse,
  NotedrillNotesParams,
  NotedrillFeedbackResponse,
  NotedrillFeedbackParams,
  NotedrillQueueResponse,
  NotedrillRevenueResponse,
} from '@/types/notedrill';

const BASE_URL =
  process.env.NEXT_PUBLIC_NOTEDRILL_API_URL ?? 'http://localhost:3001/api/v1';

const ADMIN_KEY = process.env.NEXT_PUBLIC_NOTEDRILL_ADMIN_KEY ?? '';

// ── Core fetch wrapper ─────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(`${BASE_URL}/admin${path}`, {
      cache: 'no-store',
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': ADMIN_KEY,
        ...(options?.headers ?? {}),
      },
    });

    if (!res.ok) {
      console.error(`[Notedrill API] /admin${path} → ${res.status} ${res.statusText}`);
    }

    // Always parse JSON so mutations can read `success`/`message` from error bodies.
    return (await res.json()) as T;
  } catch (err) {
    console.error(`[Notedrill API] /admin${path} failed:`, err);
    return null;
  }
}

// ── Public API surface ─────────────────────────────────────────────────────────

export const notedrillApi = {
  /** Platform-wide KPIs. GET /admin/stats */
  getStats: (): Promise<NotedrillStatsResponse | null> =>
    apiFetch<NotedrillStatsResponse>('/stats'),

  /** Paginated user list with onboarding filters. GET /admin/users */
  getUsers: (params: NotedrillUsersParams = {}): Promise<NotedrillUsersResponse | null> => {
    const qs = new URLSearchParams();
    if (params.page)            qs.set('page',            String(params.page));
    if (params.limit)           qs.set('limit',           String(params.limit));
    if (params.search)          qs.set('search',          params.search);
    if (params.plan)            qs.set('plan',            params.plan);
    if (params.sortBy)          qs.set('sortBy',          params.sortBy);
    if (params.goals)           qs.set('goals',           params.goals);
    if (params.contentTypes)    qs.set('contentTypes',    params.contentTypes);
    if (params.reviewStyle)     qs.set('reviewStyle',     params.reviewStyle);
    if (params.frustrations)    qs.set('frustrations',    params.frustrations);
    if (params.referralSource)  qs.set('referralSource',  params.referralSource);
    const query = qs.toString();
    return apiFetch<NotedrillUsersResponse>(`/users${query ? `?${query}` : ''}`);
  },

  /** Ban or unban a user. PATCH /admin/users/:id/ban */
  toggleBan: (
    id: string,
    banned: boolean,
  ): Promise<{ success: boolean; message?: string } | null> =>
    apiFetch(`/users/${encodeURIComponent(id)}/ban`, {
      method: 'PATCH',
      body: JSON.stringify({ banned }),
    }),

  /** Reset daily quota or grant bonus credits. PATCH /admin/users/:id/quota */
  manageQuota: (
    userId: string,
    payload: { action: 'reset_daily' | 'grant_bonus'; amount?: number },
  ): Promise<{ success: boolean; message?: string } | null> =>
    apiFetch(`/users/${encodeURIComponent(userId)}/quota`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  /** Apply an action to multiple users. PATCH /admin/users/bulk */
  bulkUserAction: (payload: {
    userIds: string[];
    action: 'upgrade_pro' | 'grant_bonus_credits';
    amount?: number;
  }): Promise<{ success: boolean; message?: string; affected?: number } | null> =>
    apiFetch('/users/bulk', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  /** Paginated notes list. GET /admin/content */
  getContent: (params: NotedrillNotesParams = {}): Promise<NotedrillNotesResponse | null> => {
    const qs = new URLSearchParams();
    if (params.page)       qs.set('page',       String(params.page));
    if (params.limit)      qs.set('limit',      String(params.limit));
    if (params.status)     qs.set('status',     params.status);
    if (params.sourceType) qs.set('sourceType', params.sourceType);
    const query = qs.toString();
    return apiFetch<NotedrillNotesResponse>(`/content${query ? `?${query}` : ''}`);
  },

  /** Remove shared access from a note. PATCH /admin/content/:id/unshare */
  unshareNote: (
    noteId: string,
  ): Promise<{ success: boolean; message?: string } | null> =>
    apiFetch(`/content/${encodeURIComponent(noteId)}/unshare`, {
      method: 'PATCH',
    }),

  /** Hard-delete a note. DELETE /admin/content/:id */
  deleteNote: (
    noteId: string,
  ): Promise<{ success: boolean; message?: string } | null> =>
    apiFetch(`/content/${encodeURIComponent(noteId)}`, {
      method: 'DELETE',
    }),

  /** Queue stats + active/waiting/failed jobs. GET /admin/queue */
  getQueue: (): Promise<NotedrillQueueResponse | null> =>
    apiFetch<NotedrillQueueResponse>('/queue'),

  /** Re-queue a failed job. POST /admin/queue/:jobId/retry */
  retryJob: (
    jobId: string,
  ): Promise<{ success: boolean; message?: string } | null> =>
    apiFetch(`/queue/${encodeURIComponent(jobId)}/retry`, {
      method: 'POST',
    }),

  /** Revenue + PRO growth data. GET /admin/revenue */
  getRevenue: (): Promise<NotedrillRevenueResponse | null> =>
    apiFetch<NotedrillRevenueResponse>('/revenue'),

  /** Paginated feedback list. GET /admin/feedback */
  getFeedback: (params: NotedrillFeedbackParams = {}): Promise<NotedrillFeedbackResponse | null> => {
    const qs = new URLSearchParams();
    if (params.page)       qs.set('page',       String(params.page));
    if (params.limit)      qs.set('limit',      String(params.limit));
    if (params.isPositive) qs.set('isPositive', params.isPositive);
    if (params.startDate)  qs.set('startDate',  params.startDate);
    if (params.endDate)    qs.set('endDate',    params.endDate);
    const query = qs.toString();
    return apiFetch<NotedrillFeedbackResponse>(`/feedback${query ? `?${query}` : ''}`);
  },
};
