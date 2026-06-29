"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { notedrillApi } from "@/lib/notedrill-api";
import type { NotedrillFeedback } from "@/types/notedrill";
import Badge from "@/components/ui/badge/Badge";
import { ChatIcon } from "@/icons";

// ─── helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
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
          <div className="h-3 w-40 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-3 w-44 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-3 w-16 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-3 flex-1 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-3 w-24 rounded bg-gray-200 dark:bg-gray-700" />
        </div>
      ))}
    </div>
  );
}

// ─── constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

// ─── main component ───────────────────────────────────────────────────────────

export default function NotedrillFeedbackTable() {
  const [items, setItems] = useState<NotedrillFeedback[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const [page, setPage] = useState(1);
  // '' = all, 'true' = positive, 'false' = negative
  const [sentimentFilter, setSentimentFilter] = useState<"" | "true" | "false">("");

  // ── fetch ─────────────────────────────────────────────────────────────────
  const fetchFeedback = useCallback(
    async (p: number, sentiment: "" | "true" | "false") => {
      setLoading(true);
      const result = await notedrillApi.getFeedback({
        page: p,
        limit: PAGE_SIZE,
        isPositive: sentiment || undefined,
      });
      if (result?.data) {
        setItems(result.data);
        setTotalItems(result.pagination.total);
        setTotalPages(result.pagination.pages);
      }
      setLoading(false);
    },
    []
  );

  useEffect(() => {
    fetchFeedback(page, sentimentFilter);
  }, [page, sentimentFilter, fetchFeedback]);

  function handleSentimentChange(value: "" | "true" | "false") {
    setPage(1);
    setSentimentFilter(value);
  }

  const hasFilters = sentimentFilter !== "";

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
            Feedback
          </h2>
          {!loading && (
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
              {totalItems.toLocaleString()} total responses
            </p>
          )}
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-end gap-3 border-t border-gray-100 dark:border-gray-800 px-5 py-4 md:px-6">
        {/* Sentiment */}
        <div className="min-w-[160px]">
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
            Sentiment
          </label>
          <select
            value={sentimentFilter}
            onChange={(e) =>
              handleSentimentChange(e.target.value as "" | "true" | "false")
            }
            className="h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
          >
            <option value="">All feedback</option>
            <option value="true">Positive only</option>
            <option value="false">Negative only</option>
          </select>
        </div>

        {hasFilters && (
          <button
            onClick={() => handleSentimentChange("")}
            className="h-9 rounded-lg border border-gray-200 px-3 text-sm text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-white/5"
          >
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-y border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-white/[0.02]">
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider md:px-6">
                User
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Note
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Sentiment
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Comment
              </th>
              <th className="px-3 py-3 pr-5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider md:pr-6">
                Date
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="p-0">
                  <TableSkeleton />
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="py-16 text-center text-sm text-gray-400 dark:text-gray-500"
                >
                  <ChatIcon className="mx-auto mb-3 size-8 opacity-30" />
                  {hasFilters
                    ? "No feedback matches your filter"
                    : "No feedback found"}
                </td>
              </tr>
            ) : (
              items.map((fb) => (
                <tr
                  key={fb._id}
                  className="border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors"
                >
                  {/* User */}
                  <td className="px-5 py-4 md:px-6">
                    <span className="font-medium text-gray-800 dark:text-white/90">
                      {fb.userId?.email ?? "—"}
                    </span>
                    {fb.userId?.name && (
                      <span className="block text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                        {fb.userId.name}
                      </span>
                    )}
                  </td>

                  {/* Note title */}
                  <td className="px-3 py-4 text-gray-500 dark:text-gray-400 max-w-[200px]">
                    <span className="truncate block" title={fb.noteId?.title}>
                      {fb.noteId?.title ?? "—"}
                    </span>
                  </td>

                  {/* Sentiment */}
                  <td className="px-3 py-4">
                    <Badge
                      color={fb.isPositive ? "success" : "error"}
                      size="sm"
                    >
                      {fb.isPositive ? "Positive" : "Negative"}
                    </Badge>
                  </td>

                  {/* Comment */}
                  <td className="px-3 py-4 text-gray-500 dark:text-gray-400 max-w-xs">
                    {fb.comment ? (
                      <span
                        className="block truncate"
                        title={fb.comment}
                      >
                        {fb.comment}
                      </span>
                    ) : (
                      <span className="text-gray-300 dark:text-gray-600 italic text-xs">
                        No comment
                      </span>
                    )}
                  </td>

                  {/* Date */}
                  <td className="px-3 py-4 pr-5 text-gray-500 dark:text-gray-400 whitespace-nowrap md:pr-6">
                    {formatDate(fb.createdAt)}
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
            Page {page} of {totalPages} ·{" "}
            {totalItems.toLocaleString()} responses
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
