"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { notedrillApi } from "@/lib/notedrill-api";
import type { NotedrillUser } from "@/types/notedrill";
import Badge from "@/components/ui/badge/Badge";
import { Modal } from "@/components/ui/modal";
import { GroupIcon, ChevronDownIcon } from "@/icons";

// ─── onboarding option maps ───────────────────────────────────────────────────

const GOAL_OPTIONS = [
  { id: "better-grades",  label: "Study and exam prep" },
  { id: "ace-exams",      label: "Work meetings and tasks" },
  { id: "organize-notes", label: "Research and academic reading" },
  { id: "learn-faster",   label: "Podcasts or YouTube notes" },
  { id: "improve-skills", label: "Personal knowledge hub" },
];

const CONTENT_TYPE_OPTIONS = [
  { id: "textbooks-pdfs",     label: "Audio and voice recordings" },
  { id: "video-lectures",     label: "PDFs and Word documents" },
  { id: "handwritten-notes",  label: "Podcasts and YouTube notes" },
  { id: "recorded-lectures",  label: "Personal knowledge hub" },
  { id: "online-articles",    label: "YouTube and video links" },
];

const REVIEW_STYLE_OPTIONS = [
  { id: "quizzes",            label: "Quizzes" },
  { id: "flashcards",         label: "Flashcards" },
  { id: "summaries",          label: "AI Summaries" },
  { id: "practice-problems",  label: "Chat with your notes" },
];

const FRUSTRATION_OPTIONS = [
  { id: "time-consuming", label: "Takes too much time" },
  { id: "disorganized",   label: "Notes get disorganized" },
  { id: "forgetting",     label: "Forgetting what I learned" },
  { id: "finding-info",   label: "Can't find information later" },
  { id: "boring",         label: "Studying is boring" },
  { id: "overwhelmed",    label: "Too much information" },
];

const REFERRAL_OPTIONS = [
  { id: "tiktok",     label: "TikTok" },
  { id: "instagram",  label: "Instagram" },
  { id: "reddit",     label: "Reddit" },
  { id: "youtube",    label: "YouTube" },
  { id: "search",     label: "Google Search" },
  { id: "friend",     label: "Friend or Family" },
  { id: "other",      label: "Other" },
];

function labelFor(options: { id: string; label: string }[], id: string) {
  return options.find((o) => o.id === id)?.label ?? id;
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ─── sub-components ───────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="animate-pulse">
      {Array.from({ length: 10 }).map((_, i) => (
        <div
          key={i}
          className="flex gap-6 border-b border-gray-50 dark:border-gray-800 py-4 px-6"
        >
          <div className="h-3 w-4 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-3 w-44 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-3 w-20 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-3 w-28 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-3 w-10 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-3 w-24 rounded bg-gray-200 dark:bg-gray-700 ml-auto" />
        </div>
      ))}
    </div>
  );
}

function SelectFilter({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { id: string; label: string }[];
}) {
  return (
    <div className="min-w-[160px]">
      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
      >
        <option value="">Any</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function OnboardingPill({ value }: { value: string }) {
  return (
    <span className="inline-block rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300">
      {value}
    </span>
  );
}

function OnboardingRow({
  label,
  values,
  options,
}: {
  label: string;
  values?: string[];
  options: { id: string; label: string }[];
}) {
  const hasValues = values && values.length > 0;
  return (
    <div>
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">{label}</p>
      {hasValues ? (
        <div className="flex flex-wrap gap-1.5">
          {values.map((v) => (
            <OnboardingPill key={v} value={labelFor(options, v)} />
          ))}
        </div>
      ) : (
        <span className="text-xs text-gray-300 dark:text-gray-600 italic">Not answered</span>
      )}
    </div>
  );
}

function UserDetailModal({
  user,
  onClose,
  onToast,
}: {
  user: NotedrillUser;
  onClose: () => void;
  onToast: (type: "success" | "error", message: string) => void;
}) {
  const [quotaLoading, setQuotaLoading] = useState<string | null>(null);

  async function handleQuotaAction(
    action: "reset_daily" | "grant_bonus",
    amount?: number
  ) {
    setQuotaLoading(action);
    const result = await notedrillApi.manageQuota(user._id, { action, amount });
    setQuotaLoading(null);
    if (result?.success) {
      onToast(
        "success",
        action === "reset_daily"
          ? "Daily quota reset successfully."
          : "+1 bonus credit granted."
      );
    } else {
      onToast("error", result?.message ?? "Action failed. Please try again.");
    }
  }

  return (
    <Modal isOpen onClose={onClose} className="max-w-lg p-6 sm:p-8">
      {/* Header */}
      <div className="mb-6">
        <h4 className="text-xl font-semibold text-gray-800 dark:text-white/90">
          User Details
        </h4>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {user.email}
        </p>
      </div>

      {/* Basic info */}
      <div className="mb-6 grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Plan</p>
          <Badge color={user.subscription === "PRO" ? "success" : "light"} size="sm">
            {user.subscription}
          </Badge>
        </div>
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Notes</p>
          <p className="text-sm font-mono text-gray-800 dark:text-white/90">{user.noteCount}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Joined</p>
          <p className="text-sm text-gray-600 dark:text-gray-300">{formatDate(user.createdAt)}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Last Active</p>
          <p className="text-sm text-gray-600 dark:text-gray-300">{formatDate(user.lastActiveAt)}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Auth</p>
          <p className="text-sm text-gray-600 dark:text-gray-300 capitalize">{user.authProvider ?? "—"}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Signup Complete</p>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {user.hasCompletedSignup ? "Yes" : "No"}
          </p>
        </div>
      </div>

      {/* Quota Management */}
      <div className="border-t border-gray-100 dark:border-gray-800 pt-5 mb-5">
        <h5 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Quota Management
        </h5>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleQuotaAction("reset_daily")}
            disabled={quotaLoading !== null}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-gray-700 dark:text-gray-400 dark:hover:bg-white/5 transition-colors"
          >
            {quotaLoading === "reset_daily" ? "Resetting…" : "Reset Daily Quota"}
          </button>
          <button
            onClick={() => handleQuotaAction("grant_bonus", 1)}
            disabled={quotaLoading !== null}
            className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-100 disabled:opacity-50 disabled:cursor-not-allowed dark:border-brand-800 dark:bg-brand-900/20 dark:text-brand-400 dark:hover:bg-brand-900/30 transition-colors"
          >
            {quotaLoading === "grant_bonus" ? "Granting…" : "Grant +1 Bonus Credit"}
          </button>
        </div>
      </div>

      {/* Onboarding answers */}
      <div className="border-t border-gray-100 dark:border-gray-800 pt-5 space-y-4">
        <h5 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Onboarding Answers
        </h5>

        <OnboardingRow
          label="Goals"
          values={user.goals}
          options={GOAL_OPTIONS}
        />
        <OnboardingRow
          label="Content Types"
          values={user.contentTypes}
          options={CONTENT_TYPE_OPTIONS}
        />
        <OnboardingRow
          label="Review Style"
          values={user.reviewStyle ? [user.reviewStyle] : undefined}
          options={REVIEW_STYLE_OPTIONS}
        />
        <OnboardingRow
          label="Frustrations"
          values={user.frustrations}
          options={FRUSTRATION_OPTIONS}
        />

        <div>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Referral Source</p>
          {user.referralSource ? (
            <OnboardingPill value={labelFor(REFERRAL_OPTIONS, user.referralSource)} />
          ) : (
            <span className="text-xs text-gray-300 dark:text-gray-600 italic">Not answered</span>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ─── filter state type ────────────────────────────────────────────────────────

interface Filters {
  search: string;
  plan: string;
  goals: string;
  contentTypes: string;
  reviewStyle: string;
  frustrations: string;
  referralSource: string;
}

const EMPTY_FILTERS: Filters = {
  search: "",
  plan: "",
  goals: "",
  contentTypes: "",
  reviewStyle: "",
  frustrations: "",
  referralSource: "",
};

const PAGE_SIZE = 20;

// ─── main component ───────────────────────────────────────────────────────────

export default function NotedrillUsersTable() {
  const [users, setUsers] = useState<NotedrillUser[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [draft, setDraft] = useState<Filters>({ ...EMPTY_FILTERS });
  const [applied, setApplied] = useState<Filters>({ ...EMPTY_FILTERS });
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Ban state
  const [banningId, setBanningId] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDropOpen, setBulkDropOpen] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const headerCheckboxRef = useRef<HTMLInputElement>(null);

  // Detail modal
  const [detailUser, setDetailUser] = useState<NotedrillUser | null>(null);

  const allSelected = users.length > 0 && users.every((u) => selectedIds.has(u._id));
  const someSelected = users.some((u) => selectedIds.has(u._id));

  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = someSelected && !allSelected;
    }
  }, [someSelected, allSelected]);

  // Clear selection when page or filters change
  useEffect(() => {
    setSelectedIds(new Set());
  }, [page, applied]);

  // ── fetch ─────────────────────────────────────────────────────────────────
  const fetchUsers = useCallback(async (p: number, f: Filters) => {
    setLoading(true);
    const result = await notedrillApi.getUsers({
      page: p,
      limit: PAGE_SIZE,
      search:         f.search         || undefined,
      plan:           f.plan           || undefined,
      goals:          f.goals          || undefined,
      contentTypes:   f.contentTypes   || undefined,
      reviewStyle:    f.reviewStyle    || undefined,
      frustrations:   f.frustrations   || undefined,
      referralSource: f.referralSource || undefined,
    });
    if (result?.data) {
      setUsers(result.data);
      setTotalUsers(result.pagination.total);
      setTotalPages(result.pagination.pages);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchUsers(page, applied);
  }, [page, applied, fetchUsers]);

  // ── submit / clear ────────────────────────────────────────────────────────
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setApplied({ ...draft });
  }

  function handleClear() {
    setDraft({ ...EMPTY_FILTERS });
    setApplied({ ...EMPTY_FILTERS });
    setPage(1);
  }

  const hasFilters = Object.values(applied).some(Boolean);
  const hasAdvancedDraft =
    draft.goals || draft.contentTypes || draft.reviewStyle ||
    draft.frustrations || draft.referralSource;

  // ── toast helper ──────────────────────────────────────────────────────────
  function showToast(type: "success" | "error", message: string) {
    setActionResult({ type, message });
    setTimeout(() => setActionResult(null), 4000);
  }

  // ── ban / unban ───────────────────────────────────────────────────────────
  async function handleToggleBan(user: NotedrillUser) {
    const next = !user.isBanned;
    if (!window.confirm(`${next ? "Ban" : "Unban"} ${user.email}?`)) return;

    setBanningId(user._id);
    const result = await notedrillApi.toggleBan(user._id, next);
    setBanningId(null);

    if (result?.success) {
      setUsers((prev) =>
        prev.map((u) => (u._id === user._id ? { ...u, isBanned: next } : u))
      );
      showToast(
        "success",
        next ? `${user.email} has been banned.` : `${user.email} has been unbanned.`
      );
    } else {
      showToast("error", "Action failed. Please try again.");
    }
  }

  // ── bulk actions ──────────────────────────────────────────────────────────
  async function handleBulkAction(
    action: "upgrade_pro" | "grant_bonus_credits"
  ) {
    const ids = Array.from(selectedIds);
    const count = ids.length;
    if (count === 0) return;

    setBulkLoading(true);
    setBulkDropOpen(false);

    const result = await notedrillApi.bulkUserAction({
      userIds: ids,
      action,
      amount: action === "grant_bonus_credits" ? 5 : undefined,
    });

    setBulkLoading(false);

    if (result?.success) {
      setSelectedIds(new Set());
      showToast(
        "success",
        action === "upgrade_pro"
          ? `${count} user(s) upgraded to PRO.`
          : `+5 bonus credits granted to ${count} user(s).`
      );
      fetchUsers(page, applied);
    } else {
      showToast("error", result?.message ?? "Bulk action failed. Please try again.");
    }
  }

  // ── selection helpers ─────────────────────────────────────────────────────
  function handleSelectAll(checked: boolean) {
    setSelectedIds(checked ? new Set(users.map((u) => u._id)) : new Set());
  }

  function handleSelectUser(userId: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(userId);
      else next.delete(userId);
      return next;
    });
  }

  // ── page numbers ──────────────────────────────────────────────────────────
  const pageNumbers = useMemo(() => {
    const start = Math.max(1, Math.min(page - 2, totalPages - 4));
    return Array.from({ length: Math.min(5, totalPages) }, (_, i) => start + i);
  }, [page, totalPages]);

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-5 md:p-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">
              Notedrill Users
            </h2>
            {!loading && (
              <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                {totalUsers.toLocaleString()} total users
              </p>
            )}
          </div>
        </div>

        {/* Filter form */}
        <form
          onSubmit={handleSubmit}
          className="border-t border-gray-100 dark:border-gray-800"
        >
          {/* Basic filters */}
          <div className="flex flex-wrap items-end gap-3 px-5 py-4 md:px-6">
            <div className="flex-1 min-w-[180px]">
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                Search
              </label>
              <input
                type="text"
                value={draft.search}
                onChange={(e) => setDraft((d) => ({ ...d, search: e.target.value }))}
                placeholder="Email or name…"
                className="h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
              />
            </div>
            <div className="min-w-[130px]">
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                Plan
              </label>
              <select
                value={draft.plan}
                onChange={(e) => setDraft((d) => ({ ...d, plan: e.target.value }))}
                className="h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
              >
                <option value="">All plans</option>
                <option value="PRO">Pro</option>
                <option value="FREE">Free</option>
              </select>
            </div>
            <button
              type="submit"
              className="h-9 rounded-lg bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-600 transition-colors"
            >
              Search
            </button>
            {hasFilters && (
              <button
                type="button"
                onClick={handleClear}
                className="h-9 rounded-lg border border-gray-200 px-3 text-sm text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-white/5"
              >
                Clear all
              </button>
            )}
            <button
              type="button"
              onClick={() => setAdvancedOpen((o) => !o)}
              className={`ml-auto h-9 inline-flex items-center gap-1.5 rounded-lg border px-3 text-sm transition-colors ${
                advancedOpen || hasAdvancedDraft
                  ? "border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-700 dark:bg-brand-900/20 dark:text-brand-300"
                  : "border-gray-200 text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-white/5"
              }`}
            >
              Advanced
              <ChevronDownIcon
                className={`h-4 w-4 transition-transform duration-200 ${advancedOpen ? "rotate-180" : ""}`}
              />
            </button>
          </div>

          {/* Advanced filters — collapsible */}
          {advancedOpen && (
            <div className="flex flex-wrap gap-3 border-t border-dashed border-gray-100 dark:border-gray-800 px-5 pb-4 pt-4 md:px-6 bg-gray-50/50 dark:bg-white/[0.01]">
              <SelectFilter
                label="Goal"
                value={draft.goals}
                onChange={(v) => setDraft((d) => ({ ...d, goals: v }))}
                options={GOAL_OPTIONS}
              />
              <SelectFilter
                label="Content Type"
                value={draft.contentTypes}
                onChange={(v) => setDraft((d) => ({ ...d, contentTypes: v }))}
                options={CONTENT_TYPE_OPTIONS}
              />
              <SelectFilter
                label="Review Style"
                value={draft.reviewStyle}
                onChange={(v) => setDraft((d) => ({ ...d, reviewStyle: v }))}
                options={REVIEW_STYLE_OPTIONS}
              />
              <SelectFilter
                label="Frustration"
                value={draft.frustrations}
                onChange={(v) => setDraft((d) => ({ ...d, frustrations: v }))}
                options={FRUSTRATION_OPTIONS}
              />
              <SelectFilter
                label="Referral Source"
                value={draft.referralSource}
                onChange={(v) => setDraft((d) => ({ ...d, referralSource: v }))}
                options={REFERRAL_OPTIONS}
              />
              <div className="flex items-end">
                <button
                  type="submit"
                  className="h-9 rounded-lg bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-600 transition-colors"
                >
                  Apply Filters
                </button>
              </div>
            </div>
          )}
        </form>

        {/* Bulk actions bar */}
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-3 border-t border-gray-100 dark:border-gray-800 px-5 py-3 md:px-6 bg-brand-50/50 dark:bg-brand-900/10">
            <span className="text-sm font-medium text-brand-700 dark:text-brand-400">
              {selectedIds.size} selected
            </span>
            <div className="relative">
              <button
                onClick={() => setBulkDropOpen((o) => !o)}
                disabled={bulkLoading}
                className="inline-flex items-center gap-1.5 rounded-lg border border-brand-300 bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-50 transition-colors"
              >
                {bulkLoading ? "Processing…" : "Bulk Actions"}
                <ChevronDownIcon
                  className={`h-3.5 w-3.5 transition-transform ${bulkDropOpen ? "rotate-180" : ""}`}
                />
              </button>
              {bulkDropOpen && (
                <>
                  <div
                    className="fixed inset-0 z-[5]"
                    onClick={() => setBulkDropOpen(false)}
                  />
                  <div className="absolute left-0 top-full mt-1 z-10 w-56 rounded-xl border border-gray-200 bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800">
                    <button
                      onClick={() => handleBulkAction("upgrade_pro")}
                      className="flex w-full items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-white/5"
                    >
                      Upgrade to PRO
                    </button>
                    <button
                      onClick={() => handleBulkAction("grant_bonus_credits")}
                      className="flex w-full items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-white/5"
                    >
                      Grant +5 Bonus Credits
                    </button>
                  </div>
                </>
              )}
            </div>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="ml-1 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              Deselect all
            </button>
          </div>
        )}

        {/* Toast */}
        {actionResult && (
          <div
            className={`mx-5 mb-3 rounded-lg px-4 py-2.5 text-sm font-medium md:mx-6 ${
              actionResult.type === "success"
                ? "bg-success-50 text-success-700 dark:bg-success-900/20 dark:text-success-400"
                : "bg-error-50 text-error-700 dark:bg-error-900/20 dark:text-error-400"
            }`}
          >
            {actionResult.message}
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-y border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-white/[0.02]">
                <th className="w-10 px-4 py-3 text-left md:px-5">
                  <input
                    ref={headerCheckboxRef}
                    type="checkbox"
                    checked={allSelected}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500 dark:border-gray-600"
                  />
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Plan
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Last Active
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Notes
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Joined
                </th>
                <th className="px-3 py-3 pr-5 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider md:pr-6">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-0">
                    <TableSkeleton />
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-sm text-gray-400 dark:text-gray-500">
                    <GroupIcon className="mx-auto mb-3 size-8 opacity-30" />
                    {hasFilters ? "No users match your filters" : "No users found"}
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr
                    key={user._id}
                    className={`border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors ${
                      selectedIds.has(user._id) ? "bg-brand-50/30 dark:bg-brand-900/10" : ""
                    }`}
                  >
                    <td className="w-10 px-4 py-4 md:px-5">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(user._id)}
                        onChange={(e) => handleSelectUser(user._id, e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500 dark:border-gray-600"
                      />
                    </td>
                    <td className="px-3 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-gray-800 dark:text-white/90">
                          {user.email}
                        </span>
                        {user.isBanned && <Badge color="error" size="sm">Banned</Badge>}
                      </div>
                      {user.name && (
                        <span className="block text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                          {user.name}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-4">
                      <Badge color={user.subscription === "PRO" ? "success" : "light"} size="sm">
                        {user.subscription}
                      </Badge>
                    </td>
                    <td className="px-3 py-4 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {formatDate(user.lastActiveAt)}
                    </td>
                    <td className="px-3 py-4 font-mono text-gray-700 dark:text-gray-300">
                      {user.noteCount}
                    </td>
                    <td className="px-3 py-4 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {formatDate(user.createdAt)}
                    </td>
                    <td className="px-3 py-4 pr-5 text-right md:pr-6">
                      <div className="inline-flex items-center gap-2">
                        <button
                          onClick={() => setDetailUser(user)}
                          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-transparent dark:text-gray-400 dark:hover:bg-white/5"
                        >
                          Details
                        </button>
                        <button
                          onClick={() => handleToggleBan(user)}
                          disabled={banningId === user._id}
                          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                            user.isBanned
                              ? "border-success-200 bg-success-50 text-success-700 hover:bg-success-100 dark:border-success-800 dark:bg-success-900/20 dark:text-success-400 dark:hover:bg-success-900/30"
                              : "border-error-200 bg-error-50 text-error-700 hover:bg-error-100 dark:border-error-800 dark:bg-error-900/20 dark:text-error-400 dark:hover:bg-error-900/30"
                          }`}
                        >
                          {banningId === user._id ? "…" : user.isBanned ? "Unban" : "Ban"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 dark:border-gray-800 px-5 py-4 md:px-6">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Page {page} of {totalPages} · {totalUsers.toLocaleString()} users
            </p>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed dark:border-gray-700 dark:text-gray-400 dark:hover:bg-white/5"
              >
                Previous
              </button>
              {pageNumbers.map((n) => (
                <button
                  key={n}
                  onClick={() => setPage(n)}
                  className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
                    n === page
                      ? "bg-brand-500 text-white border border-brand-500"
                      : "border border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-white/5"
                  }`}
                >
                  {n}
                </button>
              ))}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed dark:border-gray-700 dark:text-gray-400 dark:hover:bg-white/5"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail modal */}
      {detailUser && (
        <UserDetailModal
          user={detailUser}
          onClose={() => setDetailUser(null)}
          onToast={showToast}
        />
      )}
    </>
  );
}
