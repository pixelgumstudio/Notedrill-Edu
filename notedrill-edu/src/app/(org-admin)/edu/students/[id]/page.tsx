"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import AvatarInitials from "@/components/edu/AvatarInitials";
import ScorePill from "@/components/edu/ScorePill";
import TabBar from "@/components/edu/TabBar";
import EduBackButton from "@/components/edu/EduBackButton";
import { orgApi } from "@/lib/org-api";
import { useAuth } from "@/context/AuthContext";
import type { OrgStudentDetail } from "@/types/edu";

export default function StudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState("quiz");
  const { orgToken } = useAuth();

  const { data, isLoading } = useQuery<OrgStudentDetail>({
    queryKey: ["org-student", id],
    queryFn: () => orgApi.getOrgStudent(orgToken ?? "", id),
    enabled: !!orgToken && !!id,
    staleTime: 30_000,
  });

  const s = data?.student;
  const quizHistory = data?.quizHistory ?? [];
  const flashcardHistory = data?.flashcardHistory ?? [];

  return (
    <>
      {/* Page top bar */}
      <div className="border-b border-edu-line bg-white px-6 py-5 md:px-8">
        <h1 className="font-source-serif text-[22px] text-edu-moss-dark">Student activity</h1>
        <p className="mt-0.5 text-sm text-edu-blue-grey">Every quiz and flashcard session, individually</p>
      </div>

      <div className="px-6 py-6 md:px-8">
        <EduBackButton href="/edu/students" label="Back to all students" className="mb-4" />

        {/* Student header card */}
        {isLoading ? (
          <div className="mb-6 h-28 animate-pulse rounded-xl bg-edu-line" />
        ) : s ? (
          <div
            className="mb-6 flex flex-wrap items-center gap-4 rounded-xl border border-edu-line bg-white p-5"
            style={{ boxShadow: "var(--edu-shadow)" }}
          >
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-edu-moss">
              <AvatarInitials name={s.name} size="lg" />
            </div>
            <div>
              <h2 className="font-source-serif text-[19px] text-edu-moss-dark">{s.name}</h2>
              <p className="text-sm text-edu-blue-grey">{s.email}</p>
              <p className="text-sm text-edu-blue-grey">{s.phone}</p>
            </div>
            <div className="ml-auto flex flex-wrap gap-6">
              <Stat label="Quizzes" value={s.quizzesTaken} />
              <Stat label="Avg score" value={s.averageScore != null ? `${s.averageScore}%` : "—"} />
              <Stat label="Flashcards" value={s.flashcardSessions} />
              <Stat label="Last active" value={s.lastActive ?? "Never"} />
            </div>
          </div>
        ) : (
          <div className="mb-6 rounded-xl border border-edu-red bg-white p-5 text-sm text-edu-red">
            Student not found.
          </div>
        )}

        {/* Tabbed history */}
        <div
          className="overflow-hidden rounded-xl border border-edu-line bg-white"
          style={{ boxShadow: "var(--edu-shadow)" }}
        >
          <div className="border-b border-edu-line px-5">
            <TabBar
              tabs={[
                { id: "quiz", label: "Quiz history" },
                { id: "flash", label: "Flashcard history" },
              ]}
              activeTab={activeTab}
              onTabChange={setActiveTab}
            />
          </div>

          {isLoading ? (
            <div className="space-y-2 p-5">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-12 animate-pulse rounded bg-edu-line" />
              ))}
            </div>
          ) : activeTab === "quiz" ? (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-edu-paper-2">
                    <Th>File</Th>
                    <Th>Score</Th>
                    <Th>Date</Th>
                  </tr>
                </thead>
                <tbody>
                  {quizHistory.map((entry) => (
                    <tr key={entry.id} className="border-b border-edu-line last:border-b-0">
                      <td className="px-5 py-3.5 text-sm text-edu-ink">{entry.noteTitle}</td>
                      <td className="px-5 py-3.5">
                        <ScorePill score={entry.scorePercentage} />
                      </td>
                      <td className="px-5 py-3.5 text-sm text-edu-blue-grey">
                        {new Date(entry.completedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </td>
                    </tr>
                  ))}
                  {quizHistory.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-5 py-8 text-center text-sm text-edu-blue-grey">
                        No quiz history yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-edu-paper-2">
                    <Th>File</Th>
                    <Th>Cards</Th>
                    <Th>Date</Th>
                  </tr>
                </thead>
                <tbody>
                  {flashcardHistory.map((entry) => (
                    <tr key={entry.id} className="border-b border-edu-line last:border-b-0">
                      <td className="px-5 py-3.5 text-sm text-edu-ink">{entry.noteTitle}</td>
                      <td className="px-5 py-3.5 text-sm text-edu-ink">{entry.cardCount}</td>
                      <td className="px-5 py-3.5 text-sm text-edu-blue-grey">
                        {new Date(entry.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </td>
                    </tr>
                  ))}
                  {flashcardHistory.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-5 py-8 text-center text-sm text-edu-blue-grey">
                        No flashcard history yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="text-right">
      <div className="font-source-serif text-[20px] text-edu-moss-dark">{value}</div>
      <div className="text-[11px] uppercase tracking-wider text-edu-blue-grey">{label}</div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="border-b border-edu-line px-5 py-3 text-left text-[11.5px] font-bold uppercase tracking-wider text-edu-blue-grey">
      {children}
    </th>
  );
}
