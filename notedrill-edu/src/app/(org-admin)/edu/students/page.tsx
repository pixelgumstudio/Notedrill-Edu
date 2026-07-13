"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import StudentsTable from "@/components/edu/StudentsTable";
import EmptyState from "@/components/edu/EmptyState";
import SectionEyebrow from "@/components/edu/SectionEyebrow";
import { orgApi } from "@/lib/org-api";
import { useAuth } from "@/context/AuthContext";
import type { OrgStudent } from "@/types/edu";

type FilterKey = "all" | "active_this_week" | "never_logged_in";

const filterLabels: Record<FilterKey, string> = {
  all: "All students",
  active_this_week: "Active this week",
  never_logged_in: "Never logged in",
};

export default function StudentsPage() {
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const [addStudentOpen, setAddStudentOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addPhone, setAddPhone] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const { orgToken } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<{ items: OrgStudent[] }>({
    queryKey: ["org-students", activeFilter],
    queryFn: () =>
      orgApi.getOrgStudents(orgToken ?? "", {
        filter: activeFilter === "all" ? undefined : activeFilter,
        limit: 100,
      }),
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
    },
    onError: (err: Error) => showToast(err.message || "Failed to add student"),
  });

  const removeStudentMutation = useMutation({
    mutationFn: (id: string) => orgApi.removeOrgStudent(orgToken ?? "", id),
    onSuccess: () => {
      showToast("Student removed");
      queryClient.invalidateQueries({ queryKey: ["org-students"] });
    },
    onError: (err: Error) => showToast(err.message || "Failed to remove student"),
  });

  const resetAccessMutation = useMutation({
    mutationFn: (id: string) => orgApi.resetStudentAccess(orgToken ?? "", id),
    onSuccess: () => showToast("Access reset — the student will need to sign in again"),
    onError: (err: Error) => showToast(err.message || "Failed to reset access"),
  });

  const displayed = data?.items ?? [];

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  };

  return (
    <>
      {/* Page top bar */}
      <div className="flex items-start justify-between border-b border-edu-line bg-white px-6 py-5 md:px-8">
        <div>
          <SectionEyebrow className="mb-1">Manage students</SectionEyebrow>
          <h1 className="font-source-serif text-[22px] text-edu-moss-dark">Students</h1>
          <p className="mt-0.5 text-sm text-edu-blue-grey">
            {isLoading ? "Loading…" : `${displayed.length} student${displayed.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <div className="flex gap-2.5">
          <button
            className="rounded-lg bg-edu-moss px-3 py-2 text-sm font-bold text-white transition-colors hover:bg-edu-moss-dark"
            onClick={() => setAddStudentOpen(true)}
          >
            + Add student
          </button>
        </div>
      </div>

      <div className="px-6 py-6 md:px-8">
        {/* Filter pills */}
        <div className="mb-4 flex flex-wrap gap-2">
          {(Object.keys(filterLabels) as FilterKey[]).map((key) => (
            <button
              key={key}
              onClick={() => setActiveFilter(key)}
              className={`rounded-full border-[1.5px] px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors ${
                activeFilter === key
                  ? "border-edu-moss-dark bg-edu-moss-dark text-white"
                  : "border-edu-line bg-white text-edu-blue-grey hover:border-edu-moss hover:text-edu-moss-dark"
              }`}
            >
              {filterLabels[key]}
              {!isLoading && key === activeFilter && ` (${displayed.length})`}
            </button>
          ))}
        </div>

        {/* Students table */}
        <div className="overflow-hidden rounded-[var(--edu-radius)] border border-edu-line bg-white" style={{ boxShadow: "var(--edu-shadow)" }}>
          {isLoading ? (
            <div className="space-y-2 p-5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded bg-edu-line" />
              ))}
            </div>
          ) : displayed.length === 0 ? (
            <EmptyState
              mark="S"
              heading="No students found"
              body={
                activeFilter === "all"
                  ? "Add your first student to get started."
                  : "No students match this filter yet."
              }
            />
          ) : (
            <StudentsTable
              students={displayed}
              showActions
              onStudentRemoved={(id) => removeStudentMutation.mutate(id)}
              onResetAccess={(id) => resetAccessMutation.mutate(id)}
            />
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
              They&apos;ll sign in with a one-time code sent to this email — no password needed.
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

      {toast && (
        <div className="fixed bottom-6 right-6 z-[2000] flex items-center gap-2.5 rounded-xl bg-edu-moss-dark px-5 py-3.5 text-sm font-semibold text-white" style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.25)" }}>
          {toast}
        </div>
      )}
    </>
  );
}
