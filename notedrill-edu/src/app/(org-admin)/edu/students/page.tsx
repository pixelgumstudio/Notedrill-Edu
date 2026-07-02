"use client";

import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import StudentsTable from "@/components/edu/StudentsTable";
import { orgApi, type BulkStudentUploadResult } from "@/lib/org-api";
import { useAuth } from "@/context/AuthContext";
import type { OrgStudent } from "@/types/edu";

type FilterKey = "all" | "active" | "never";

const filterLabels: Record<FilterKey, string> = {
  all: "All students",
  active: "Active this week",
  never: "Never logged in",
};

export default function StudentsPage() {
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const [addStudentOpen, setAddStudentOpen] = useState(false);
  const [addEmail, setAddEmail] = useState("");
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkResult, setBulkResult] = useState<BulkStudentUploadResult | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const { orgToken } = useAuth();
  const queryClient = useQueryClient();

  const { data: students, isLoading } = useQuery<OrgStudent[]>({
    queryKey: ["org-students", activeFilter],
    queryFn: () =>
      orgApi.getOrgStudents(orgToken ?? "", activeFilter === "all" ? undefined : activeFilter),
    enabled: !!orgToken,
    staleTime: 60_000,
  });

  const addStudentMutation = useMutation({
    mutationFn: (email: string) => orgApi.addOrgStudent(orgToken ?? "", { email }),
    onSuccess: () => {
      setAddStudentOpen(false);
      setAddEmail("");
      showToast("Student invited — login code sent to their email");
      queryClient.invalidateQueries({ queryKey: ["org-students"] });
    },
    onError: (err: Error) => showToast(err.message || "Failed to send invite"),
  });

  const removeStudentMutation = useMutation({
    mutationFn: (id: string) => orgApi.removeOrgStudent(orgToken ?? "", id),
    onSuccess: () => {
      showToast("Student removed");
      queryClient.invalidateQueries({ queryKey: ["org-students"] });
    },
    onError: (err: Error) => showToast(err.message || "Failed to remove student"),
  });

  const bulkUploadMutation = useMutation({
    mutationFn: (file: File) => orgApi.addOrgStudentsBulk(orgToken ?? "", file),
    onSuccess: (result) => {
      setBulkResult(result);
      setBulkFile(null);
      queryClient.invalidateQueries({ queryKey: ["org-students"] });
      showToast(
        result.failureCount === 0
          ? `Successfully invited ${result.successCount} student${result.successCount === 1 ? "" : "s"}!`
          : `Invited ${result.successCount} student${result.successCount === 1 ? "" : "s"} — ${result.failureCount} failed.`
      );
    },
    onError: (err: Error) => showToast(err.message || "Bulk upload failed"),
  });

  const displayed = students ?? [];

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  };

  const closeBulkModal = () => {
    setBulkUploadOpen(false);
    setBulkFile(null);
    setBulkResult(null);
  };

  const handleDownloadTemplate = () => {
    const csvContent = "firstName,lastName,email\nJane,Doe,jane.doe@school.edu\n";
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "student-upload-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      {/* Page top bar */}
      <div className="flex items-start justify-between border-b border-edu-line bg-white px-6 py-5 md:px-8">
        <div>
          <h1 className="font-source-serif text-[22px] text-edu-moss-dark">Students</h1>
          <p className="mt-0.5 text-sm text-edu-blue-grey">
            {isLoading ? "Loading…" : `${displayed.length} students`}
          </p>
        </div>
        <div className="flex gap-2.5">
          <button
            className="rounded-lg bg-edu-paper-2 px-3 py-2 text-sm font-bold text-edu-blue-grey transition-colors hover:bg-edu-line"
            onClick={() => setBulkUploadOpen(true)}
          >
            Bulk Upload CSV
          </button>
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
            <div className="py-16 text-center text-edu-blue-grey">
              <div className="mb-3 text-3xl opacity-60">👤</div>
              <p className="text-sm">No students found.</p>
            </div>
          ) : (
            <StudentsTable
              students={displayed}
              showActions
              onStudentRemoved={(id) => removeStudentMutation.mutate(id)}
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
              They&apos;ll log in using a one-time code sent to this email — no password needed.
            </p>
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
                onClick={() => { setAddStudentOpen(false); setAddEmail(""); }}
              >
                Cancel
              </button>
              <button
                className="flex-1 rounded-lg bg-edu-moss py-2.5 text-sm font-bold text-white hover:bg-edu-moss-dark disabled:opacity-60"
                disabled={!addEmail || addStudentMutation.isPending}
                onClick={() => addStudentMutation.mutate(addEmail)}
              >
                {addStudentMutation.isPending ? "Sending…" : "Add student"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Upload CSV Modal */}
      {bulkUploadOpen && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-edu-moss-dark/45 p-5"
          onClick={(e) => e.currentTarget === e.target && closeBulkModal()}
        >
          <div className="w-full max-w-[480px] rounded-xl bg-white p-7" style={{ boxShadow: "0 10px 40px rgba(0,0,0,0.25)" }}>
            <h3 className="mb-2 font-source-serif text-lg text-edu-ink">Bulk upload students</h3>
            <p className="mb-4 text-sm leading-relaxed text-edu-blue-grey">
              Upload a CSV to invite an entire classroom at once. Each student gets a one-time sign-in code by email.
            </p>

            <div className="mb-4 rounded-lg bg-edu-paper-2 px-3.5 py-3 text-[12.5px] leading-relaxed text-edu-blue-grey">
              Required columns: <b className="text-edu-ink">firstName</b>, <b className="text-edu-ink">email</b>.{" "}
              <b className="text-edu-ink">lastName</b> is optional.{" "}
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="font-semibold text-edu-moss hover:underline"
              >
                Download template
              </button>
            </div>

            {!bulkResult && (
              <div className="mb-5">
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => setBulkFile(e.target.files?.[0] ?? null)}
                  className="w-full rounded-lg border-[1.5px] border-dashed border-edu-line bg-edu-paper p-2.5 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-edu-moss file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-white"
                />
              </div>
            )}

            {bulkResult && (
              <div className="mb-5 max-h-40 overflow-y-auto rounded-lg border border-edu-line p-3 text-[12.5px]">
                <p className="mb-1.5 font-semibold text-edu-ink">
                  {bulkResult.successCount} invited, {bulkResult.failureCount} failed
                </p>
                {bulkResult.errors.length > 0 && (
                  <ul className="space-y-1 text-edu-red">
                    {bulkResult.errors.map((e, i) => (
                      <li key={i}>{e.email}: {e.reason}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="flex gap-2.5">
              <button
                className="flex-1 rounded-lg border-[1.5px] border-edu-line py-2.5 text-sm font-bold text-edu-blue-grey hover:bg-edu-paper-2"
                onClick={closeBulkModal}
              >
                {bulkResult ? "Close" : "Cancel"}
              </button>
              {!bulkResult && (
                <button
                  className="flex-1 rounded-lg bg-edu-moss py-2.5 text-sm font-bold text-white hover:bg-edu-moss-dark disabled:opacity-60"
                  disabled={!bulkFile || bulkUploadMutation.isPending}
                  onClick={() => bulkFile && bulkUploadMutation.mutate(bulkFile)}
                >
                  {bulkUploadMutation.isPending ? "Uploading…" : "Upload CSV"}
                </button>
              )}
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
