"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { notedrillApi } from "@/lib/notedrill-api";
import type { NotedrillNote } from "@/types/notedrill";
import Badge from "@/components/ui/badge/Badge";
import { ListIcon } from "@/icons";

// ─── helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function statusBadgeColor(
  status: string
): "success" | "error" | "warning" | "light" {
  if (status === "completed") return "success";
  if (status === "failed")    return "error";
  if (status === "processing" || status === "pending") return "warning";
  return "light";
}

function sourceTypeLabel(raw: string) {
  const map: Record<string, string> = {
    youtube: "YouTube",
    audio:   "Audio",
    pdf:     "PDF",
    image:   "Image",
    text:    "Text",
  };
  return map[raw?.toLowerCase()] ?? raw ?? "—";
}

// ─── skeleton ─────────────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="animate-pulse">
      {Array.from({ length: 10 }).map((_, i) => (
        <div
          key={i}
          className="flex gap-6 border-b border-gray-50 dark:border-gray-800 py-4 px-6"
        >
          <div className="h-3 w-48 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-3 w-36 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-3 w-20 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-3 w-20 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-3 w-24 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-3 w-24 rounded bg-gray-200 dark:bg-gray-700 ml-auto" />
        </div>
      ))}
    </div>
  );
}

// ─── constants ────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = ["completed", "failed", "processing", "pending"];
const SOURCE_TYPE_OPTIONS = ["youtube", "audio", "pdf", "image", "text"];
const PAGE_SIZE = 20;

// ─── main component ───────────────────────────────────────────────────────────

export default function NotedrillNotesTable() {
  const [notes, setNotes] = useState<NotedrillNote[]>([]);
  const [totalNotes, setTotalNotes] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("");
  const [sourceTypeFilter, setSourceTypeFilter] = useState("");

  // Action state
  const [unsharingId, setUnsharingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  function showToast(type: "success" | "error", message: string) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }

  // ── fetch ─────────────────────────────────────────────────────────────────
  const fetchNotes = useCallback(
    async (p: number, status: string, sourceType: string) => {
      setLoading(true);
      const result = await notedrillApi.getContent({
        page: p,
        limit: PAGE_SIZE,
        status: status || undefined,
        sourceType: sourceType || undefined,
      });
      if (result?.data) {
        setNotes(result.data);
        setTotalNotes(result.pagination.total);
        setTotalPages(result.pagination.pages);
      }
      setLoading(false);
    },
    []
  );

  useEffect(() => {
    fetchNotes(page, statusFilter, sourceTypeFilter);
  }, [page, statusFilter, sourceTypeFilter, fetchNotes]);

  // ── filter change helpers ─────────────────────────────────────────────────
  function handleStatusChange(value: string) {
    setPage(1);
    setStatusFilter(value);
  }

  function handleSourceTypeChange(value: string) {
    setPage(1);
    setSourceTypeFilter(value);
  }

  function clearFilters() {
    setPage(1);
    setStatusFilter("");
    setSourceTypeFilter("");
  }

  const hasFilters = !!(statusFilter || sourceTypeFilter);

  // ── content actions ───────────────────────────────────────────────────────
  async function handleUnshare(note: NotedrillNote) {
    setUnsharingId(note._id);
    const result = await notedrillApi.unshareNote(note._id);
    setUnsharingId(null);

    if (result?.success) {
      setNotes((prev) =>
        prev.map((n) => (n._id === note._id ? { ...n, isShared: false } : n))
      );
      showToast("success", `"${note.title || "Note"}" is no longer shared.`);
    } else {
      showToast("error", result?.message ?? "Failed to unshare note.");
    }
  }

  async function handleDelete(note: NotedrillNote) {
    if (
      !window.confirm(
        `Permanently delete "${note.title || "this note"}"?\n\nThis action cannot be undone.`
      )
    )
      return;

    setDeletingId(note._id);
    const result = await notedrillApi.deleteNote(note._id);
    setDeletingId(null);

    if (result?.success) {
      setNotes((prev) => prev.filter((n) => n._id !== note._id));
      setTotalNotes((prev) => prev - 1);
      showToast("success", `"${note.title || "Note"}" permanently deleted.`);
    } else {
      showToast("error", result?.message ?? "Failed to delete note.");
    }
  }

  // ── page numbers ──────────────────────────────────────────────────────────
  const pageNumbers = useMemo(() => {
    const start = Math.max(1, Math.min(page - 2, totalPages - 4));
    return Array.from({ length: Math.min(5, totalPages) }, (_, i) => start + i);
  }, [page, totalPages]);

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-5 md:p-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">
            Notes
          </h2>
          {!loading && (
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
              {totalNotes.toLocaleString()} total notes
            </p>
          )}
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-3 border-t border-gray-100 dark:border-gray-800 px-5 py-4 md:px-6">
        {/* Status */}
        <div className="min-w-[150px]">
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
            Status
          </label>
          <select
            value={statusFilter}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
        </div>

        {/* Source type */}
        <div className="min-w-[150px]">
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
            Source Type
          </label>
          <select
            value={sourceTypeFilter}
            onChange={(e) => handleSourceTypeChange(e.target.value)}
            className="h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
          >
            <option value="">All types</option>
            {SOURCE_TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {sourceTypeLabel(t)}
              </option>
            ))}
          </select>
        </div>

        {hasFilters && (
          <button
            onClick={clearFilters}
            className="h-9 rounded-lg border border-gray-200 px-3 text-sm text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-white/5"
          >
            Clear
          </button>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`mx-5 mb-3 rounded-lg px-4 py-2.5 text-sm font-medium md:mx-6 ${
            toast.type === "success"
              ? "bg-success-50 text-success-700 dark:bg-success-900/20 dark:text-success-400"
              : "bg-error-50 text-error-700 dark:bg-error-900/20 dark:text-error-400"
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-y border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-white/[0.02]">
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider md:px-6">
                Title
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Owner
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Source
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Status
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Created
              </th>
              <th className="px-3 py-3 pr-5 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider md:pr-6">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="p-0">
                  <TableSkeleton />
                </td>
              </tr>
            ) : notes.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="py-16 text-center text-sm text-gray-400 dark:text-gray-500"
                >
                  <ListIcon className="mx-auto mb-3 size-8 opacity-30" />
                  {hasFilters ? "No notes match your filters" : "No notes found"}
                </td>
              </tr>
            ) : (
              notes.map((note) => (
                <tr
                  key={note._id}
                  className="border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors"
                >
                  <td className="px-5 py-4 md:px-6">
                    <span className="font-medium text-gray-800 dark:text-white/90 line-clamp-1">
                      {note.title || "—"}
                    </span>
                    {note.processingStatus === "failed" && note.error && (
                      <span
                        className="block mt-0.5 text-xs text-error-500 dark:text-error-400 truncate max-w-xs"
                        title={note.error}
                      >
                        {note.error}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-4 text-gray-500 dark:text-gray-400">
                    {note.userId?.email ?? "—"}
                  </td>
                  <td className="px-3 py-4">
                    <Badge color="light" size="sm">
                      {sourceTypeLabel(note.sourceType)}
                    </Badge>
                  </td>
                  <td className="px-3 py-4">
                    <Badge
                      color={statusBadgeColor(note.processingStatus)}
                      size="sm"
                    >
                      {note.processingStatus
                        ? note.processingStatus.charAt(0).toUpperCase() +
                          note.processingStatus.slice(1)
                        : "—"}
                    </Badge>
                  </td>
                  <td className="px-3 py-4 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    {formatDate(note.createdAt)}
                  </td>
                  <td className="px-3 py-4 pr-5 text-right md:pr-6">
                    <div className="inline-flex items-center gap-2">
                      {note.isShared && (
                        <button
                          onClick={() => handleUnshare(note)}
                          disabled={unsharingId === note._id || deletingId === note._id}
                          className="rounded-lg border border-warning-200 bg-warning-50 px-3 py-1.5 text-xs font-medium text-warning-700 hover:bg-warning-100 disabled:opacity-50 disabled:cursor-not-allowed dark:border-warning-800 dark:bg-warning-900/20 dark:text-warning-400 dark:hover:bg-warning-900/30 transition-colors"
                        >
                          {unsharingId === note._id ? "…" : "Unshare"}
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(note)}
                        disabled={deletingId === note._id || unsharingId === note._id}
                        className="rounded-lg border border-error-200 bg-error-50 px-3 py-1.5 text-xs font-semibold text-error-700 hover:bg-error-100 disabled:opacity-50 disabled:cursor-not-allowed dark:border-error-800 dark:bg-error-900/20 dark:text-error-400 dark:hover:bg-error-900/30 transition-colors"
                      >
                        {deletingId === note._id ? "Deleting…" : "Delete"}
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
            Page {page} of {totalPages} · {totalNotes.toLocaleString()} notes
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
  );
}
