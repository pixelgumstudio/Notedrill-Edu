"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import MetricCard from "@/components/edu/MetricCard";
import StudentsTable from "@/components/edu/StudentsTable";
import SectionEyebrow from "@/components/edu/SectionEyebrow";
import EmptyState from "@/components/edu/EmptyState";
import { orgApi } from "@/lib/org-api";
import { useAuth } from "@/context/AuthContext";
import type { OrgStudent, OrgDashboardStats } from "@/types/edu";

export default function DashboardPage() {
  const [addStudentOpen, setAddStudentOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addPhone, setAddPhone] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const { orgToken } = useAuth();
  const queryClient = useQueryClient();

  const { data: stats, isLoading: statsLoading } = useQuery<OrgDashboardStats>({
    queryKey: ["org-dashboard-stats"],
    queryFn: () => orgApi.getDashboardStats(orgToken ?? ""),
    enabled: !!orgToken,
    staleTime: 60_000,
  });

  const { data: studentsData, isLoading: studentsLoading } = useQuery<{ items: OrgStudent[] }>({
    queryKey: ["org-students"],
    queryFn: () => orgApi.getOrgStudents(orgToken ?? "", { limit: 6 }),
    enabled: !!orgToken,
    staleTime: 60_000,
  });

  const addStudentMutation = useMutation({
    mutationFn: (data: { name: string; email: string; phone: string }) => orgApi.addOrgStudent(orgToken ?? "", data),
    onSuccess: () => {
      setAddStudentOpen(false);
      setAddName("");
      setAddEmail("");
      setAddPhone("");
      showToast("Student added");
      queryClient.invalidateQueries({ queryKey: ["org-students"] });
      queryClient.invalidateQueries({ queryKey: ["org-dashboard-stats"] });
    },
    onError: (err: Error) => showToast(err.message || "Failed to add student"),
  });

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  };

  const s = stats;
  const students = studentsData?.items ?? [];

  return (
    <>
      {/* Page top bar */}
      <div className="flex items-start justify-between border-b border-edu-line bg-white px-6 py-5 md:px-8">
        <div>
          <SectionEyebrow className="mb-1">For school management</SectionEyebrow>
          <h1 className="font-source-serif text-[22px] text-edu-moss-dark">Dashboard</h1>
          <p className="mt-0.5 text-sm text-edu-blue-grey">Overview of your school&apos;s NoteDrill activity</p>
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
        {statsLoading ? (
          <div className="mb-7 grid grid-cols-2 gap-3.5 md:grid-cols-3 xl:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-edu-line" />
            ))}
          </div>
        ) : s ? (
          <div className="mb-7 grid grid-cols-2 gap-3.5 md:grid-cols-3 xl:grid-cols-6">
            <MetricCard label="Students" value={`${s.students.total}`} delta={{ value: `of ${s.students.seatLimit} seats used`, positive: true }} />
            <MetricCard label="Active this week" value={`${s.students.activeThisWeek}`} delta={{ value: "practiced in last 7 days", positive: true }} />
            <MetricCard label="Quizzes taken" value={s.quizzes.taken.toLocaleString()} delta={{ value: "across all students", positive: true }} />
            <MetricCard label="Flashcard sessions" value={`${s.flashcards.sessions}`} delta={{ value: "across all students", positive: true }} />
            <MetricCard label="Average score" value={`${s.quizzes.averageScore ?? 0}%`} delta={{ value: "org-wide quiz average", positive: true }} />
            <MetricCard
              label="Plan"
              value={s.billing.plan}
              delta={{ value: `${s.billing.seatsUsed}/${s.billing.seatLimit} seats used`, positive: false }}
              className="bg-edu-gold-light border-[#E7C691]"
            />
          </div>
        ) : null}

        {/* Getting started — shown until the school has added its first student */}
        {!studentsLoading && students.length === 0 && (
          <div
            className="mb-7 overflow-hidden rounded-xl border border-edu-line bg-white p-6 md:p-7"
            style={{ boxShadow: "var(--edu-shadow)" }}
          >
            <SectionEyebrow className="mb-2">Getting started</SectionEyebrow>
            <h3 className="mb-5 font-source-serif text-[18px] text-edu-moss-dark">
              Two steps from your first exam paper.
            </h3>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div className="flex gap-3.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-edu-moss text-sm font-bold text-white">1</div>
                <div>
                  <p className="mb-0.5 text-sm font-bold text-edu-ink">Add your students</p>
                  <p className="text-[13px] leading-relaxed text-edu-blue-grey">
                    They&apos;ll sign in with a one-time code sent by email — no password, no app download.
                  </p>
                  <Link href="/edu/students" className="mt-2 inline-block text-[13px] font-bold text-edu-moss hover:underline">
                    Add students →
                  </Link>
                </div>
              </div>
              <div className="flex gap-3.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-edu-moss text-sm font-bold text-white">2</div>
                <div>
                  <p className="mb-0.5 text-sm font-bold text-edu-ink">Upload your first lesson material</p>
                  <p className="text-[13px] leading-relaxed text-edu-blue-grey">
                    One PDF is all you need — Notedrill generates a summary, quiz, and flashcards from it.
                  </p>
                  <Link href="/edu/upload" className="mt-2 inline-block text-[13px] font-bold text-edu-moss hover:underline">
                    Upload a file →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Students preview panel */}
        <div className="overflow-hidden rounded-[var(--edu-radius)] border border-edu-line bg-white" style={{ boxShadow: "var(--edu-shadow)" }}>
          <div className="flex items-center justify-between border-b border-edu-line px-5 py-4">
            <div>
              <h3 className="font-source-serif text-[16.5px] text-edu-moss-dark">Students</h3>
              <p className="mt-0.5 text-[12.5px] text-edu-blue-grey">
                {studentsLoading ? "Loading…" : `${students.length} students · showing top 6`}
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
          ) : students.length === 0 ? (
            <EmptyState
              mark="S"
              heading="No students yet"
              body="Add your first student above to see them appear here."
              className="py-10"
            />
          ) : (
            <StudentsTable students={students.slice(0, 6)} showActions={false} />
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
              <label className="mb-1.5 block text-[12.5px] font-semibold text-edu-ink">Full name</label>
              <input
                type="text"
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                className="w-full rounded-lg border-[1.5px] border-edu-line bg-edu-paper p-2.5 text-sm focus:border-edu-moss focus:outline-none"
                placeholder="Jane Doe"
              />
            </div>
            <div className="mb-4">
              <label className="mb-1.5 block text-[12.5px] font-semibold text-edu-ink">Email address</label>
              <input
                type="email"
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
                className="w-full rounded-lg border-[1.5px] border-edu-line bg-edu-paper p-2.5 text-sm focus:border-edu-moss focus:outline-none"
                placeholder="student@email.com"
              />
            </div>
            <div className="mb-5">
              <label className="mb-1.5 block text-[12.5px] font-semibold text-edu-ink">Phone number</label>
              <input
                type="tel"
                value={addPhone}
                onChange={(e) => setAddPhone(e.target.value)}
                className="w-full rounded-lg border-[1.5px] border-edu-line bg-edu-paper p-2.5 text-sm focus:border-edu-moss focus:outline-none"
                placeholder="+2348012345678"
              />
            </div>
            <div className="flex gap-2.5">
              <button
                className="flex-1 rounded-lg border-[1.5px] border-edu-line py-2.5 text-sm font-bold text-edu-blue-grey hover:bg-edu-paper-2"
                onClick={() => { setAddStudentOpen(false); setAddName(""); setAddEmail(""); setAddPhone(""); }}
              >
                Cancel
              </button>
              <button
                className="flex-1 rounded-lg bg-edu-moss py-2.5 text-sm font-bold text-white hover:bg-edu-moss-dark disabled:opacity-60"
                disabled={!addName || !addEmail || !addPhone || addStudentMutation.isPending}
                onClick={() => addStudentMutation.mutate({ name: addName, email: addEmail, phone: addPhone })}
              >
                {addStudentMutation.isPending ? "Adding…" : "Add student"}
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
