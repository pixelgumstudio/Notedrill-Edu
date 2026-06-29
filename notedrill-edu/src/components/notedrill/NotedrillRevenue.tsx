"use client";

import React, { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import type { ApexOptions } from "apexcharts";
import { notedrillApi } from "@/lib/notedrill-api";
import type { NotedrillRevenueData } from "@/types/notedrill";

const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

// ─── helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Fill in every month between 12 months ago and now, defaulting to 0. */
function buildMonthlyData(
  raw: Array<{ _id: string; count: number }>
): { month: string; count: number }[] {
  const map = Object.fromEntries(raw.map((r) => [r._id, r.count]));
  const result: { month: string; count: number }[] = [];
  const now = new Date();

  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
    result.push({ month: label, count: map[key] ?? 0 });
  }
  return result;
}

// ─── stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: number;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`mt-2 text-3xl font-bold ${accent ?? "text-gray-800 dark:text-white/90"}`}>
        {value.toLocaleString()}
      </p>
      {sub && <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{sub}</p>}
    </div>
  );
}

function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6 animate-pulse">
      <div className="h-3 w-24 rounded bg-gray-200 dark:bg-gray-700 mb-3" />
      <div className="h-8 w-16 rounded bg-gray-200 dark:bg-gray-700" />
    </div>
  );
}

// ─── skeleton / error ─────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="animate-pulse">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex gap-6 border-b border-gray-50 dark:border-gray-800 py-4 px-6">
          <div className="h-3 w-40 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-3 w-44 rounded bg-gray-200 dark:bg-gray-700" />
          <div className="h-3 w-24 rounded bg-gray-200 dark:bg-gray-700 ml-auto" />
        </div>
      ))}
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export default function NotedrillRevenue() {
  const [data, setData] = useState<NotedrillRevenueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchRevenue = useCallback(async () => {
    const result = await notedrillApi.getRevenue();
    if (result?.data) {
      setData(result.data);
      setError(false);
    } else {
      setError(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRevenue();
  }, [fetchRevenue]);

  // ── error ─────────────────────────────────────────────────────────────────
  if (!loading && error) {
    return (
      <div className="rounded-2xl border border-error-200 bg-error-50 p-6 text-sm text-error-700 dark:border-error-800 dark:bg-error-900/20 dark:text-error-400">
        Failed to load revenue data.
      </div>
    );
  }

  // ── chart config ──────────────────────────────────────────────────────────
  const monthly = data ? buildMonthlyData(data.proByMonth) : [];

  const chartOptions: ApexOptions = {
    chart: {
      type: "bar",
      fontFamily: "Outfit, sans-serif",
      toolbar: { show: false },
      background: "transparent",
    },
    colors: ["#465FFF"],
    plotOptions: {
      bar: { borderRadius: 4, columnWidth: "55%" },
    },
    dataLabels: { enabled: false },
    xaxis: {
      categories: monthly.map((m) => m.month),
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: { style: { fontSize: "11px", colors: "#9CA3AF" } },
    },
    yaxis: {
      min: 0,
      labels: {
        style: { fontSize: "11px", colors: "#9CA3AF" },
        formatter: (v) => String(Math.round(v)),
      },
    },
    grid: {
      borderColor: "#F3F4F6",
      yaxis: { lines: { show: true } },
      xaxis: { lines: { show: false } },
    },
    tooltip: {
      y: { formatter: (v) => `${v} new PRO user${v !== 1 ? "s" : ""}` },
    },
    theme: { mode: "light" },
  };

  const chartSeries = [
    { name: "New PRO Users", data: monthly.map((m) => m.count) },
  ];

  const conversionPct =
    data && data.totalUsers > 0
      ? ((data.totalPro / data.totalUsers) * 100).toFixed(1)
      : "0";

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:gap-6">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)
        ) : (
          <>
            <StatCard label="Total Users" value={data!.totalUsers} />
            <StatCard
              label="PRO Users"
              value={data!.totalPro}
              sub={`${conversionPct}% conversion`}
              accent="text-brand-600 dark:text-brand-400"
            />
            <StatCard label="Free Users" value={data!.totalFree} />
          </>
        )}
      </div>

      {/* Monthly PRO growth chart */}
      {!loading && data && (
        <div className="rounded-2xl border border-gray-200 bg-white px-5 pt-5 pb-2 dark:border-gray-800 dark:bg-white/[0.03] sm:px-6 sm:pt-6">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">
              New PRO Users — Last 12 Months
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Users whose accounts were created with PRO subscription
            </p>
          </div>
          <div className="max-w-full overflow-x-auto">
            <div className="min-w-[500px]">
              <ReactApexChart
                options={chartOptions}
                series={chartSeries}
                type="bar"
                height={220}
              />
            </div>
          </div>
        </div>
      )}

      {/* Recent PRO users table */}
      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="px-5 py-4 md:px-6">
          <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">
            Recent PRO Users
          </h3>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            Last 20 accounts with PRO subscription
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-y border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-white/[0.02]">
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider md:px-6">
                  Name
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-3 py-3 pr-5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider md:pr-6">
                  Joined
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={3} className="p-0">
                    <TableSkeleton />
                  </td>
                </tr>
              ) : !data || data.recentProUsers.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-10 text-center text-sm text-gray-400 dark:text-gray-500">
                    No PRO users yet
                  </td>
                </tr>
              ) : (
                data.recentProUsers.map((u) => (
                  <tr
                    key={u._id}
                    className="border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-5 py-4 font-medium text-gray-800 dark:text-white/90 md:px-6">
                      {u.name || "—"}
                    </td>
                    <td className="px-3 py-4 text-gray-500 dark:text-gray-400">
                      {u.email}
                    </td>
                    <td className="px-3 py-4 pr-5 text-gray-500 dark:text-gray-400 whitespace-nowrap md:pr-6">
                      {formatDate(u.createdAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
