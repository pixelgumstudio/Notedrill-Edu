"use client";

import React, { useCallback, useEffect, useState } from "react";
import { notedrillApi } from "@/lib/notedrill-api";
import type { NotedrillQueueJob, NotedrillQueueResponse } from "@/types/notedrill";

// ─── helpers ──────────────────────────────────────────────────────────────────

function formatTs(ms?: number) {
  if (!ms) return "—";
  return new Date(ms).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function truncateId(id: string) {
  return id.length > 12 ? `${id.slice(0, 12)}…` : id;
}

function noteIdFromData(data: Record<string, unknown>): string {
  const raw =
    data.noteId ?? data.note_id ?? data.id ?? data.documentId ?? null;
  if (!raw) return "—";
  const s = String(raw);
  return s.length > 16 ? `${s.slice(0, 16)}…` : s;
}

// ─── count card ───────────────────────────────────────────────────────────────

function CountCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`mt-2 text-3xl font-bold ${accent ?? "text-gray-800 dark:text-white/90"}`}>
        {value.toLocaleString()}
      </p>
    </div>
  );
}

// ─── jobs table ───────────────────────────────────────────────────────────────

function JobsTable({
  title,
  jobs,
  showProcessedOn,
  emptyMessage,
  onRetry,
  retryingId,
}: {
  title: string;
  jobs: NotedrillQueueJob[];
  showProcessedOn?: boolean;
  emptyMessage: string;
  onRetry?: (job: NotedrillQueueJob) => void;
  retryingId?: string | null;
}) {
  const colSpan = onRetry ? 6 : 5;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="flex items-center justify-between px-5 py-4 md:px-6">
        <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">
          {title}
        </h3>
        <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
          {jobs.length}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-y border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-white/[0.02]">
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider md:px-6">
                Job ID
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Note ID
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Progress
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Attempts
              </th>
              <th
                className={`px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider ${!onRetry ? "pr-5 md:pr-6" : ""}`}
              >
                {showProcessedOn ? "Started At" : "Queued At"}
              </th>
              {onRetry && (
                <th className="px-3 py-3 pr-5 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider md:pr-6">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {jobs.length === 0 ? (
              <tr>
                <td
                  colSpan={colSpan}
                  className="py-10 text-center text-sm text-gray-400 dark:text-gray-500"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              jobs.map((job) => (
                <tr
                  key={job.id}
                  className="border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors"
                >
                  <td className="px-5 py-3 font-mono text-xs text-gray-600 dark:text-gray-400 md:px-6">
                    {truncateId(String(job.id))}
                  </td>
                  <td className="px-3 py-3 font-mono text-xs text-gray-600 dark:text-gray-400">
                    {noteIdFromData(job.data)}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-20 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-brand-500 transition-all"
                          style={{ width: `${Math.min(100, Number(job.progress) || 0)}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums w-8">
                        {Number(job.progress) || 0}%
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-gray-500 dark:text-gray-400 tabular-nums">
                    {job.attemptsMade}
                  </td>
                  <td className={`px-3 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap text-xs ${!onRetry ? "pr-5 md:pr-6" : ""}`}>
                    {showProcessedOn
                      ? formatTs(job.processedOn)
                      : formatTs(job.timestamp)}
                  </td>
                  {onRetry && (
                    <td className="px-3 py-3 pr-5 text-right md:pr-6">
                      <button
                        onClick={() => onRetry(job)}
                        disabled={retryingId === String(job.id)}
                        className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-100 disabled:opacity-50 disabled:cursor-not-allowed dark:border-brand-800 dark:bg-brand-900/20 dark:text-brand-400 dark:hover:bg-brand-900/30 transition-colors"
                      >
                        {retryingId === String(job.id) ? "Retrying…" : "Retry Job"}
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── skeleton ─────────────────────────────────────────────────────────────────

function CountSkeleton() {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] animate-pulse">
      <div className="h-3 w-20 rounded bg-gray-200 dark:bg-gray-700 mb-3" />
      <div className="h-8 w-12 rounded bg-gray-200 dark:bg-gray-700" />
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

const REFRESH_INTERVAL_MS = 30_000;

export default function NotedrillQueueTable() {
  const [data, setData] = useState<NotedrillQueueResponse["data"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  function showToast(type: "success" | "error", message: string) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }

  const fetchQueue = useCallback(async () => {
    const result = await notedrillApi.getQueue();
    if (result?.data) {
      setData(result.data);
      setLastRefreshed(new Date());
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchQueue();
    const id = setInterval(fetchQueue, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchQueue]);

  async function handleRetry(job: NotedrillQueueJob) {
    const jobId = String(job.id);
    setRetryingId(jobId);
    const result = await notedrillApi.retryJob(jobId);
    setRetryingId(null);

    if (result?.success) {
      showToast("success", `Job ${truncateId(jobId)} has been requeued.`);
      await fetchQueue();
    } else {
      showToast("error", result?.message ?? "Failed to retry job.");
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white/90">
            Queue
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Transcription job queue · auto-refreshes every 30 s
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastRefreshed && (
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Updated {lastRefreshed.toLocaleTimeString()}
            </p>
          )}
          <button
            onClick={fetchQueue}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-white/5"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`rounded-lg px-4 py-2.5 text-sm font-medium ${
            toast.type === "success"
              ? "bg-success-50 text-success-700 dark:bg-success-900/20 dark:text-success-400"
              : "bg-error-50 text-error-700 dark:bg-error-900/20 dark:text-error-400"
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Count cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5 md:gap-6">
        {loading || !data ? (
          Array.from({ length: 5 }).map((_, i) => <CountSkeleton key={i} />)
        ) : (
          <>
            <CountCard label="Waiting"   value={data.counts.waiting}   accent={data.counts.waiting > 50 ? "text-warning-600 dark:text-warning-400" : undefined} />
            <CountCard label="Active"    value={data.counts.active}    accent="text-brand-600 dark:text-brand-400" />
            <CountCard label="Completed" value={data.counts.completed} accent="text-success-600 dark:text-success-400" />
            <CountCard label="Failed"    value={data.counts.failed}    accent={data.counts.failed > 0 ? "text-error-600 dark:text-error-400" : undefined} />
            <CountCard label="Delayed"   value={data.counts.delayed}   accent={data.counts.delayed > 0 ? "text-warning-600 dark:text-warning-400" : undefined} />
          </>
        )}
      </div>

      {/* Jobs tables */}
      {data && (
        <>
          <JobsTable
            title="Active Jobs"
            jobs={data.activeJobs}
            showProcessedOn
            emptyMessage="No active jobs"
          />
          <JobsTable
            title="Failed Jobs"
            jobs={data.failedJobs ?? []}
            showProcessedOn
            emptyMessage="No failed jobs"
            onRetry={handleRetry}
            retryingId={retryingId}
          />
          <JobsTable
            title="Waiting Jobs"
            jobs={data.waitingJobs}
            emptyMessage="Queue is empty"
          />
        </>
      )}
    </div>
  );
}
