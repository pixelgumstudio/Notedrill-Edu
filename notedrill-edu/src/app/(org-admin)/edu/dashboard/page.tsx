"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import MetricCard from "@/components/edu/MetricCard";
import StudentsTable from "@/components/edu/StudentsTable";
import { orgApi } from "@/lib/org-api";
import { useAuth } from "@/context/AuthContext";
import type { OrgStudent, OrgDashboardMetrics } from "@/types/edu";

export default function DashboardPage() {
  const [addStudentOpen, setAddStudentOpen] = useState(false);
  const [addEmail, setAddEmail] = useState("");
  const [addFirstName, setAddFirstName] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const { orgToken } = useAuth();
  const queryClient = useQueryClient();

  const { data: metrics, isLoading: metricsLoading } = useQuery<OrgDashboardMetrics>({
    queryKey: ["org-metrics"],
    queryFn: () => orgApi.getDashboardMetrics(orgToken ?? ""),
    enabled: !!orgToken,
    staleTime: 60_000,
  });

  const { data: students, isLoading: studentsLoading } = useQuery<OrgStudent[]>({
    queryKey: ["org-students"],
    queryFn: () => orgApi.getOrgStudents(orgToken ?? ""),
    enabled: !!orgToken,
    staleTime: 60_000,
  });

  const addStudentMutation = useMutation({
    mutationFn: (data: { email: string; firstName: string }) => orgApi.addOrgStudent(orgToken ?? "", data),
    onSuccess: () => {
      setAddStudentOpen(false);
      setAddEmail("");
      setAddFirstName("");
      showToast("Student invited — login code sent to their email");
      queryClient.invalidateQueries({ queryKey: ["org-students"] });
      queryClient.invalidateQueries({ queryKey: ["org-metrics"] });
    },
    onError: (err: Error) => showToast(err.message || "Failed to send invite"),
  });

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  };

  const copySchoolId = () => {
    if (!metrics?.schoolId) return;
    navigator.clipboard.writeText(metrics.schoolId).then(() => showToast("School ID copied"));
  };

  const m = metrics;
  const s = students ?? [];

  return (
    <>
      {/* Page top bar */}
      <div className="flex items-start justify-between border-b border-edu-line bg-white px-6 py-5 md:px-8">
        <div>
          <h1 className="font-source-serif text-[22px] text-edu-moss-dark">Dashboard</h1>
          <p className="mt-0.5 text-sm text-edu-blue-grey">Overview of your school&apos;s NoteDrill activity</p>
          {m?.schoolId && (
            <button
              onClick={copySchoolId}
              title="Click to copy"
              className="mt-2 inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-edu-line bg-edu-paper-2 px-3 py-1 text-[12px] font-bold text-edu-moss-dark transition-colors hover:border-edu-moss"
            >
              School ID: {m.schoolId} <span aria-hidden="true">⧉</span>
            </button>
          )}
        </div>
        <div className="flex shrink-0 gap-2.5">
          <Link
            href="/edu/upload"
            className="hidden items-center rounded-lg border-[1.5px] border-edu-moss bg-white px-3 py-2 text-sm font-bold text-edu-moss-dark transition-colors hover:bg-edu-moss-light sm:flex"
          >
            + Upload file
          </Link>
          <button
            className="rounded-lg bg-edu-moss px-3 py-2 text-sm font-bold text-white transition-colors hover:bg-edu-moss-dark"
            onClick={() => setAddStudentOpen(true)}
          >
            + Add student
          </button>
        </div>
      </div>

      <div className="px-6 py-7 md:px-8">
        {/* Metrics grid */}
        {metricsLoading ? (
          <div className="mb-7 grid grid-cols-2 gap-3.5 md:grid-cols-3 xl:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-edu-line" />
            ))}
          </div>
        ) : m ? (
          <div className="mb-7 grid grid-cols-2 gap-3.5 md:grid-cols-3 xl:grid-cols-6">
            <MetricCard label="Students" value={`${m.studentCount}`} delta={{ value: `of ${m.seatLimit} seats used`, positive: true }} />
            <MetricCard label="Active students" value={`${m.activeStudents}`} delta={{ value: "practiced in last 7 days", positive: true }} />
            <MetricCard label="Quizzes taken" value={(m.quizzesTaken ?? 0).toLocaleString()} delta={{ value: "across all students", positive: true }} />
            <MetricCard label="Flashcard sessions" value={`${m.flashcardSessions ?? 0}`} delta={{ value: "across all students", positive: true }} />
            <MetricCard label="Average score" value={`${m.avgScore ?? 0}%`} delta={{ value: "org-wide quiz average", positive: true }} />
            <MetricCard
              label="Billing status"
              value={m.billingAmount}
              delta={{ value: m.billingStatus, positive: false }}
              className="bg-edu-gold-light border-[#E7C691]"
            />
          </div>
        ) : null}

        {/* Students preview panel */}
        <div className="overflow-hidden rounded-[var(--edu-radius)] border border-edu-line bg-white" style={{ boxShadow: "var(--edu-shadow)" }}>
          <div className="flex items-center justify-between border-b border-edu-line px-5 py-4">
            <div>
              <h3 className="font-source-serif text-[16.5px] text-edu-moss-dark">Students</h3>
              <p className="mt-0.5 text-[12.5px] text-edu-blue-grey">
                {studentsLoading ? "Loading…" : `${s.length} students · showing top 6`}
              </p>
            </div>
            <Link
              href="/edu/students"
              className="rounded-lg border-[1.5px] border-edu-moss bg-white px-3 py-1.5 text-sm font-bold text-edu-moss-dark transition-colors hover:bg-edu-moss-light"
            >
              View all students →
            </Link>
          </div>
          {studentsLoading ? (
            <div className="space-y-2 p-5">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded bg-edu-line" />
              ))}
            </div>
          ) : (
            <StudentsTable students={s.slice(0, 6)} showActions={false} />
          )}
        </div>
      </div>

      {/* Add Student Modal */}
      {addStudentOpen && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-edu-moss-dark/45 p-5"
          onClick={(e) => e.currentTarget === e.target && setAddStudentOpen(false)}
        >
          <div className="w-full max-w-[460px] rounded-xl bg-white p-7" style={{ boxShadow: "0 10px 40px rgba(0,0,0,0.25)" }}>
            <h3 className="mb-2 font-source-serif text-lg text-edu-ink">Add a student</h3>
            <p className="mb-5 text-sm leading-relaxed text-edu-blue-grey">
              They&apos;ll log in using a one-time code sent to this email — no password needed.
            </p>
            <div className="mb-4">
              <label className="mb-1.5 block text-[12.5px] font-semibold text-edu-ink">First name</label>
              <input
                type="text"
                value={addFirstName}
                onChange={(e) => setAddFirstName(e.target.value)}
                className="w-full rounded-lg border-[1.5px] border-edu-line bg-edu-paper p-2.5 text-sm focus:border-edu-moss focus:outline-none"
                placeholder="Jane"
              />
            </div>
            <div className="mb-5">
              <label className="mb-1.5 block text-[12.5px] font-semibold text-edu-ink">Email address</label>
              <input
                type="email"
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
                className="w-full rounded-lg border-[1.5px] border-edu-line bg-edu-paper p-2.5 text-sm focus:border-edu-moss focus:outline-none"
                placeholder="student@email.com"
              />
            </div>
            <div className="flex gap-2.5">
              <button
                className="flex-1 rounded-lg border-[1.5px] border-edu-line py-2.5 text-sm font-bold text-edu-blue-grey hover:bg-edu-paper-2"
                onClick={() => { setAddStudentOpen(false); setAddEmail(""); setAddFirstName(""); }}
              >
                Cancel
              </button>
              <button
                className="flex-1 rounded-lg bg-edu-moss py-2.5 text-sm font-bold text-white hover:bg-edu-moss-dark disabled:opacity-60"
                disabled={!addEmail || !addFirstName || addStudentMutation.isPending}
                onClick={() => addStudentMutation.mutate({ email: addEmail, firstName: addFirstName })}
              >
                {addStudentMutation.isPending ? "Sending…" : "Add student"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-[2000] flex items-center gap-2.5 rounded-xl bg-edu-moss-dark px-5 py-3.5 text-sm font-semibold text-white" style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.25)" }}>
          {toast}
        </div>
      )}
    </>
  );
}
