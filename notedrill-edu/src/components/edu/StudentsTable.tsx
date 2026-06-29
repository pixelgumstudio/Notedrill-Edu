"use client";

import React, { useState } from "react";
import Link from "next/link";
import type { OrgStudent } from "@/types/edu";
import ScorePill from "./ScorePill";
import AvatarInitials from "./AvatarInitials";
import EduModal from "./EduModal";

interface StudentsTableProps {
  students: OrgStudent[];
  baseHref?: string;
  showActions?: boolean;
  onStudentRemoved?: (id: string) => void;
}

export default function StudentsTable({
  students,
  baseHref = "/edu/students",
  showActions = true,
  onStudentRemoved,
}: StudentsTableProps) {
  const [resetTarget, setResetTarget] = useState<OrgStudent | null>(null);
  const [removeTarget, setRemoveTarget] = useState<OrgStudent | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  };

  const handleReset = () => {
    setResetTarget(null);
    showToast("Access reset — student can request a new code");
  };

  const handleRemove = () => {
    if (removeTarget && onStudentRemoved) onStudentRemoved(removeTarget.id);
    setRemoveTarget(null);
    showToast("Student removed");
  };

  const lastActiveLabel = (val: string | null) => {
    if (!val) return "Never";
    return val;
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-edu-paper-2">
            <th className="border-b border-edu-line px-5 py-3 text-left text-[11.5px] font-bold uppercase tracking-wider text-edu-blue-grey">
              Name
            </th>
            {showActions && (
              <th className="hidden border-b border-edu-line px-5 py-3 text-left text-[11.5px] font-bold uppercase tracking-wider text-edu-blue-grey sm:table-cell">
                Email
              </th>
            )}
            <th className="border-b border-edu-line px-5 py-3 text-left text-[11.5px] font-bold uppercase tracking-wider text-edu-blue-grey">
              Quizzes
            </th>
            <th className="border-b border-edu-line px-5 py-3 text-left text-[11.5px] font-bold uppercase tracking-wider text-edu-blue-grey">
              Avg. score
            </th>
            <th className="hidden border-b border-edu-line px-5 py-3 text-left text-[11.5px] font-bold uppercase tracking-wider text-edu-blue-grey lg:table-cell">
              Flashcards
            </th>
            <th className="hidden border-b border-edu-line px-5 py-3 text-left text-[11.5px] font-bold uppercase tracking-wider text-edu-blue-grey sm:table-cell">
              Last active
            </th>
            {showActions && (
              <th className="border-b border-edu-line px-5 py-3 text-right text-[11.5px] font-bold uppercase tracking-wider text-edu-blue-grey" />
            )}
          </tr>
        </thead>
        <tbody>
          {students.map((student) => (
            <tr key={student.id} className="border-b border-edu-line last:border-b-0 hover:bg-edu-paper-2 transition-colors">
              <td className="px-5 py-3.5">
                <Link
                  href={`${baseHref}/${student.id}`}
                  className="flex items-center gap-2.5"
                >
                  <AvatarInitials name={student.name} size="xs" />
                  <span className="text-sm font-medium text-edu-ink hover:text-edu-moss">
                    {student.name}
                  </span>
                </Link>
              </td>
              {showActions && (
                <td className="hidden px-5 py-3.5 text-sm text-edu-blue-grey sm:table-cell">
                  {student.email}
                </td>
              )}
              <td className="px-5 py-3.5 text-sm text-edu-ink">{student.quizCount}</td>
              <td className="px-5 py-3.5">
                <ScorePill score={student.avgScore} />
              </td>
              <td className="hidden px-5 py-3.5 text-sm text-edu-ink lg:table-cell">
                {student.flashcardCount}
              </td>
              <td className="hidden px-5 py-3.5 text-sm text-edu-blue-grey sm:table-cell">
                {lastActiveLabel(student.lastActive)}
              </td>
              {showActions && (
                <td className="px-5 py-3.5 text-right">
                  <button
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-edu-line bg-white text-sm text-edu-blue-grey transition-colors hover:bg-edu-paper-2 hover:text-edu-ink"
                    title="Reset access"
                    onClick={(e) => { e.stopPropagation(); setResetTarget(student); }}
                  >
                    ⟲
                  </button>
                  <button
                    className="ml-1.5 inline-flex h-7 w-7 items-center justify-center rounded-md border border-edu-line bg-white text-sm text-edu-blue-grey transition-colors hover:border-[#E0B5B0] hover:bg-edu-red-light hover:text-edu-red"
                    title="Remove student"
                    onClick={(e) => { e.stopPropagation(); setRemoveTarget(student); }}
                  >
                    ✕
                  </button>
                </td>
              )}
            </tr>
          ))}
          {students.length === 0 && (
            <tr>
              <td colSpan={showActions ? 7 : 5} className="px-5 py-10 text-center text-sm text-edu-blue-grey">
                No students found.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Reset Access Modal */}
      <EduModal
        open={!!resetTarget}
        onClose={() => setResetTarget(null)}
        title="Reset student access"
        description={`This cancels any pending login code for ${resetTarget?.name}. They can request a new one the next time they try to log in.`}
      >
        <div className="flex gap-2.5">
          <button
            className="flex-1 rounded-lg border border-edu-line bg-transparent py-2.5 text-sm font-bold text-edu-blue-grey hover:bg-edu-paper-2"
            onClick={() => setResetTarget(null)}
          >
            Cancel
          </button>
          <button
            className="flex-1 rounded-lg bg-edu-moss py-2.5 text-sm font-bold text-white hover:bg-edu-moss-dark"
            onClick={handleReset}
          >
            Reset access
          </button>
        </div>
      </EduModal>

      {/* Remove Student Modal */}
      <EduModal
        open={!!removeTarget}
        onClose={() => setRemoveTarget(null)}
        title="Remove student?"
        description={`${removeTarget?.name} will lose access immediately. Their quiz and flashcard history stays on record for your reports.`}
      >
        <div className="flex gap-2.5">
          <button
            className="flex-1 rounded-lg border border-edu-line bg-transparent py-2.5 text-sm font-bold text-edu-blue-grey hover:bg-edu-paper-2"
            onClick={() => setRemoveTarget(null)}
          >
            Cancel
          </button>
          <button
            className="flex-1 rounded-lg bg-edu-red py-2.5 text-sm font-bold text-white hover:opacity-90"
            onClick={handleRemove}
          >
            Remove student
          </button>
        </div>
      </EduModal>

      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-6 right-6 z-[2000] flex items-center gap-2.5 rounded-xl bg-edu-moss-dark px-5 py-3.5 text-sm font-semibold text-white"
          style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.25)" }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}
