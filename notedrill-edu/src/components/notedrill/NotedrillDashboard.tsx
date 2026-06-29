"use client";

import React, { useCallback, useEffect, useState } from "react";
import { notedrillApi } from "@/lib/notedrill-api";
import type { NotedrillStats } from "@/types/notedrill";

// ─── primitives ───────────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6 animate-pulse">
      <div className="h-3 w-24 rounded bg-gray-200 dark:bg-gray-700 mb-4" />
      <div className="h-8 w-16 rounded bg-gray-200 dark:bg-gray-700" />
      <div className="h-3 w-32 rounded bg-gray-200 dark:bg-gray-700 mt-2" />
    </div>
  );
}

type Accent = "default" | "brand" | "success" | "error" | "warning";

const accentValue: Record<Accent, string> = {
  default: "text-gray-800 dark:text-white/90",
  brand:   "text-brand-600 dark:text-brand-400",
  success: "text-success-600 dark:text-success-400",
  error:   "text-error-600 dark:text-error-400",
  warning: "text-warning-600 dark:text-warning-400",
};

function KpiCard({
  label,
  value,
  sub,
  accent = "default",
}: {
  label: string;
  value: number;
  sub?: string;
  accent?: Accent;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`mt-2 text-3xl font-bold ${accentValue[accent]}`}>
        {value.toLocaleString()}
      </p>
      {sub && (
        <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{sub}</p>
      )}
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
      {children}
    </h2>
  );
}

// ─── queue health pill ────────────────────────────────────────────────────────

function QueueHealthPill({ queue }: { queue: NotedrillStats["queue"] }) {
  const healthy = queue.failed === 0 && queue.waiting < 50;
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium ${
        healthy
          ? "bg-success-50 text-success-700 dark:bg-success-900/20 dark:text-success-400"
          : "bg-error-50 text-error-700 dark:bg-error-900/20 dark:text-error-400"
      }`}
    >
      <span
        className={`h-2 w-2 rounded-full ${
          healthy ? "bg-success-500" : "bg-error-500"
        }`}
      />
      {healthy ? "Queue healthy" : "Queue needs attention"}
    </div>
  );
}

// ─── main ─────────────────────────────────────────────────────────────────────

export default function NotedrillDashboard() {
  const [stats, setStats] = useState<NotedrillStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchStats = useCallback(async () => {
    const result = await notedrillApi.getStats();
    if (result?.data) {
      setStats(result.data);
      setError(false);
    } else {
      setError(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchStats();
    const id = setInterval(fetchStats, 5 * 60_000);
    return () => clearInterval(id);
  }, [fetchStats]);

  // ── skeleton ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-8">
        <div>
          <div className="h-3 w-16 rounded bg-gray-200 dark:bg-gray-700 animate-pulse mb-4" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:gap-6">
            {Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)}
          </div>
        </div>
        <div>
          <div className="h-3 w-16 rounded bg-gray-200 dark:bg-gray-700 animate-pulse mb-4" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 md:gap-6">
            {Array.from({ length: 7 }).map((_, i) => <CardSkeleton key={i} />)}
          </div>
        </div>
        <div>
          <div className="h-3 w-24 rounded bg-gray-200 dark:bg-gray-700 animate-pulse mb-4" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5 md:gap-6">
            {Array.from({ length: 5 }).map((_, i) => <CardSkeleton key={i} />)}
          </div>
        </div>
      </div>
    );
  }

  // ── error ─────────────────────────────────────────────────────────────────
  if (error || !stats) {
    return (
      <div className="rounded-2xl border border-error-200 bg-error-50 p-6 text-sm text-error-700 dark:border-error-800 dark:bg-error-900/20 dark:text-error-400">
        Failed to load Notedrill stats. Check that{" "}
        <code className="font-mono">NEXT_PUBLIC_NOTEDRILL_API_URL</code> and{" "}
        <code className="font-mono">NEXT_PUBLIC_NOTEDRILL_ADMIN_KEY</code> are
        set correctly.
      </div>
    );
  }

  const conversionPct =
    stats.users.total > 0
      ? ((stats.users.pro / stats.users.total) * 100).toFixed(1)
      : "0";

  return (
    <div className="space-y-8">
      {/* ── Users ─────────────────────────────────────────────────────────── */}
      <div>
        <SectionHeading>Users</SectionHeading>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:gap-6">
          <KpiCard label="Total Users" value={stats.users.total} />
          <KpiCard
            label="Pro Users"
            value={stats.users.pro}
            sub={`${conversionPct}% conversion`}
            accent="brand"
          />
          <KpiCard label="Free Users" value={stats.users.free} />
        </div>
      </div>

      {/* ── Content ───────────────────────────────────────────────────────── */}
      <div>
        <SectionHeading>Content</SectionHeading>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 md:gap-6">
          <KpiCard label="Notes Today"       value={stats.notes.today}     accent="brand" />
          <KpiCard label="Notes This Week"   value={stats.notes.thisWeek}  accent="brand" />
          <KpiCard label="Notes This Month"  value={stats.notes.thisMonth} accent="brand" />
          <KpiCard label="Failed Notes"      value={stats.notes.failed}    accent={stats.notes.failed > 0 ? "error" : "default"} />
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3 md:gap-6">
          <KpiCard label="Flashcard Sets" value={stats.content.flashcardSets} accent="success" />
          <KpiCard label="Quizzes"        value={stats.content.quizzes}       accent="success" />
          <KpiCard label="Chat Sessions"  value={stats.content.chats}         />
        </div>
      </div>

      {/* ── Queue Health ──────────────────────────────────────────────────── */}
      <div>
        <SectionHeading>Queue Health</SectionHeading>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5 md:gap-6">
          <KpiCard label="Waiting"   value={stats.queue.waiting}   accent={stats.queue.waiting > 50 ? "warning" : "default"} />
          <KpiCard label="Active"    value={stats.queue.active}    accent="brand" />
          <KpiCard label="Completed" value={stats.queue.completed} accent="success" />
          <KpiCard label="Failed"    value={stats.queue.failed}    accent={stats.queue.failed > 0 ? "error" : "default"} />
          <KpiCard label="Delayed"   value={stats.queue.delayed}   accent={stats.queue.delayed > 0 ? "warning" : "default"} />
        </div>
        <div className="mt-4">
          <QueueHealthPill queue={stats.queue} />
        </div>
      </div>
    </div>
  );
}
