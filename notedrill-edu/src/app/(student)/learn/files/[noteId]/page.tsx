"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import TabBar from "@/components/edu/TabBar";
import SummaryBox from "@/components/edu/SummaryBox";
import ScorePill from "@/components/edu/ScorePill";
import { studentApi } from "@/lib/student-api";
import { useAuth } from "@/context/AuthContext";
import type { StudentFile, StudentQuizAttempt, StudentFlashcardSession } from "@/types/edu";

const FILE_TABS = [
  { id: "summary",    label: "Summary",    icon: "📋" },
  { id: "quiz",       label: "Quiz",        icon: "📝" },
  { id: "flashcards", label: "Flashcards",  icon: "🗂" },
];

export default function FileDetailPage() {
  const { noteId } = useParams<{ noteId: string }>();
  const router = useRouter();
  const { studentToken } = useAuth();

  const [activeTab, setActiveTab] = useState("summary");
  const [genQuizOpen, setGenQuizOpen] = useState(false);
  const [genFlashOpen, setGenFlashOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [quizCount, setQuizCount] = useState("20");
  const [flashCount, setFlashCount] = useState("20");

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2600); };

  const { data: file, isLoading: fileLoading } = useQuery<StudentFile>({
    queryKey: ["student-file", noteId],
    queryFn: () => studentApi.getFile(studentToken ?? "", noteId),
    enabled: !!studentToken && !!noteId,
    staleTime: 60_000,
  });

  const { data: quizHistory = [], isLoading: quizLoading } = useQuery<StudentQuizAttempt[]>({
    queryKey: ["student-quiz-history", noteId],
    queryFn: () => studentApi.getQuizHistory(studentToken ?? "", noteId),
    enabled: !!studentToken && !!noteId && activeTab === "quiz",
    staleTime: 30_000,
  });

  const { data: flashHistory = [], isLoading: flashLoading } = useQuery<StudentFlashcardSession[]>({
    queryKey: ["student-flash-history", noteId],
    queryFn: () => studentApi.getFlashcardHistory(studentToken ?? "", noteId),
    enabled: !!studentToken && !!noteId && activeTab === "flashcards",
    staleTime: 30_000,
  });

  const generateQuizMutation = useMutation({
    mutationFn: () =>
      studentApi.generateQuiz(studentToken ?? "", noteId, {
        questionCount: Number(quizCount),
        difficulty: "medium",
      }),
    onSuccess: (quiz) => {
      setGenQuizOpen(false);
      router.push(`/learn/files/${noteId}/quiz?quizId=${quiz._id}`);
    },
    onError: (err: Error) => {
      showToast(err.message || "Failed to generate quiz. Please try again.");
    },
  });

  const generateFlashMutation = useMutation({
    mutationFn: () =>
      studentApi.generateFlashcards(studentToken ?? "", noteId, {
        cardCount: Number(flashCount),
        difficulty: "medium",
      }),
    onSuccess: (set) => {
      setGenFlashOpen(false);
      router.push(`/learn/files/${noteId}/flashcards?setId=${set._id}`);
    },
    onError: (err: Error) => {
      showToast(err.message || "Failed to generate flashcards. Please try again.");
    },
  });

  const bestScore = quizHistory.length > 0 ? Math.max(...quizHistory.map((q) => q.score)) : 0;

  return (
    <>
      {/* Page top bar */}
      <div className="border-b border-edu-line bg-white px-5 py-5 md:px-8">
        {fileLoading ? (
          <div className="h-6 w-64 animate-pulse rounded bg-edu-line" />
        ) : (
          <h1 className="font-source-serif text-xl text-edu-moss-dark">{file?.title ?? "File"}</h1>
        )}
        <p className="mt-0.5 text-sm text-edu-blue-grey">
          {fileLoading ? "Loading…" : `Uploaded ${file?.uploadedAt ?? ""}`}
        </p>
      </div>

      <div className="px-5 py-5 md:px-8">
        <Link href="/learn/files" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-edu-moss hover:underline">
          ← Back to my files
        </Link>

        {/* Tab bar */}
        <TabBar tabs={FILE_TABS} activeTab={activeTab} onTabChange={setActiveTab} className="mb-5" />

        {/* Summary tab */}
        {activeTab === "summary" && (
          fileLoading ? (
            <div className="space-y-3">
              <div className="h-32 animate-pulse rounded-xl bg-edu-line" />
              <div className="h-6 w-1/2 animate-pulse rounded bg-edu-line" />
            </div>
          ) : (
            <SummaryBox
              title={file?.summaryTitle ?? file?.title ?? "Summary"}
              body={file?.summary ?? "Summary not yet generated for this file."}
              stats={[
                { label: "Quizzes taken", value: quizHistory.length },
                { label: "Best score", value: bestScore > 0 ? `${bestScore}%` : "—" },
                { label: "Flashcard sets", value: flashHistory.length },
              ]}
              variant="student"
            />
          )
        )}

        {/* Quiz tab */}
        {activeTab === "quiz" && (
          <div>
            {/* Generate CTA */}
            <div className="mb-5 flex flex-col gap-3 rounded-xl border-[1.5px] border-dashed border-edu-moss bg-edu-moss-light p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h4 className="font-source-serif text-[14.5px] font-semibold text-edu-moss-dark">Generate a new quiz</h4>
                <p className="mt-0.5 text-[12.5px] text-edu-blue-grey">Creates a fresh set of questions from this file — every generation is different.</p>
              </div>
              <button
                className="shrink-0 rounded-lg bg-edu-moss px-4 py-2 text-sm font-bold text-white hover:bg-edu-moss-dark disabled:opacity-60"
                onClick={() => setGenQuizOpen(true)}
              >
                Generate quiz
              </button>
            </div>

            {/* Past quizzes */}
            <div className="overflow-hidden rounded-xl border border-edu-line bg-white" style={{ boxShadow: "var(--edu-shadow)" }}>
              <div className="border-b border-edu-line px-5 py-4">
                <h3 className="font-source-serif text-[15px] text-edu-moss-dark">Your past quizzes on this file</h3>
                <p className="mt-0.5 text-xs text-edu-blue-grey">{quizHistory.length} attempts</p>
              </div>
              {quizLoading ? (
                <div className="space-y-2 p-5">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-12 animate-pulse rounded bg-edu-line" />
                  ))}
                </div>
              ) : quizHistory.length === 0 ? (
                <div className="py-10 text-center text-sm text-edu-blue-grey">No quizzes yet. Generate your first one above!</div>
              ) : (
                quizHistory.map((attempt) => (
                  <Link
                    key={attempt.id}
                    href={`/learn/files/${noteId}/quiz?quizId=${attempt.id}`}
                    className="flex cursor-pointer items-center justify-between border-b border-edu-line px-5 py-3.5 last:border-b-0 hover:bg-edu-paper-2 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-edu-paper-2 text-sm">📝</div>
                      <div>
                        <p className="text-[13.5px] font-semibold text-edu-ink">Quiz attempt — {attempt.questionCount} questions</p>
                        <p className="mt-0.5 text-[11.5px] text-edu-blue-grey">{attempt.date} · {attempt.time}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <ScorePill score={attempt.score} />
                      <span className="text-edu-blue-grey">›</span>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        )}

        {/* Flashcards tab */}
        {activeTab === "flashcards" && (
          <div>
            {/* Generate CTA */}
            <div className="mb-5 flex flex-col gap-3 rounded-xl border-[1.5px] border-dashed border-edu-moss bg-edu-moss-light p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h4 className="font-source-serif text-[14.5px] font-semibold text-edu-moss-dark">Generate new flashcards</h4>
                <p className="mt-0.5 text-[12.5px] text-edu-blue-grey">Creates a fresh set of revision cards from this file.</p>
              </div>
              <button
                className="shrink-0 rounded-lg bg-edu-moss px-4 py-2 text-sm font-bold text-white hover:bg-edu-moss-dark"
                onClick={() => setGenFlashOpen(true)}
              >
                Generate flashcards
              </button>
            </div>

            {/* Past flashcard sessions */}
            <div className="overflow-hidden rounded-xl border border-edu-line bg-white" style={{ boxShadow: "var(--edu-shadow)" }}>
              <div className="border-b border-edu-line px-5 py-4">
                <h3 className="font-source-serif text-[15px] text-edu-moss-dark">Your past flashcard sessions</h3>
                <p className="mt-0.5 text-xs text-edu-blue-grey">{flashHistory.length} sets</p>
              </div>
              {flashLoading ? (
                <div className="space-y-2 p-5">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <div key={i} className="h-12 animate-pulse rounded bg-edu-line" />
                  ))}
                </div>
              ) : flashHistory.length === 0 ? (
                <div className="py-10 text-center text-sm text-edu-blue-grey">No flashcard sessions yet. Generate your first set above!</div>
              ) : (
                flashHistory.map((session) => (
                  <Link
                    key={session.id}
                    href={`/learn/files/${noteId}/flashcards?setId=${session.id}`}
                    className="flex cursor-pointer items-center justify-between border-b border-edu-line px-5 py-3.5 last:border-b-0 hover:bg-edu-paper-2 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-edu-paper-2 text-sm">🗂</div>
                      <div>
                        <p className="text-[13.5px] font-semibold text-edu-ink">Revision cards — {session.cardCount} cards</p>
                        <p className="mt-0.5 text-[11.5px] text-edu-blue-grey">{session.date}</p>
                      </div>
                    </div>
                    <span className="text-edu-blue-grey">›</span>
                  </Link>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Generate Quiz Modal */}
      {genQuizOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-edu-moss-dark/45 p-5" onClick={(e) => e.currentTarget === e.target && setGenQuizOpen(false)}>
          <div className="w-full max-w-[440px] rounded-xl bg-white p-7" style={{ boxShadow: "0 10px 40px rgba(0,0,0,0.25)" }}>
            <h3 className="mb-2 font-source-serif text-lg text-edu-ink">Generate a quiz</h3>
            <p className="mb-5 text-sm text-edu-blue-grey">Based on <b className="text-edu-ink">{file?.title}</b>. This will be your own quiz to practice with.</p>
            <div className="mb-5">
              <label className="mb-1.5 block text-[12.5px] font-semibold text-edu-ink">Number of questions</label>
              <select value={quizCount} onChange={(e) => setQuizCount(e.target.value)} className="w-full rounded-lg border-[1.5px] border-edu-line bg-edu-paper p-2.5 text-sm focus:border-edu-moss focus:outline-none">
                <option>10</option><option>20</option><option>30</option>
              </select>
            </div>
            <div className="flex gap-2.5">
              <button className="flex-1 rounded-lg border-[1.5px] border-edu-line py-2.5 text-sm font-bold text-edu-blue-grey hover:bg-edu-paper-2" onClick={() => setGenQuizOpen(false)} disabled={generateQuizMutation.isPending}>Cancel</button>
              <button
                className="flex-1 rounded-lg bg-edu-moss py-2.5 text-sm font-bold text-white hover:bg-edu-moss-dark disabled:opacity-60"
                disabled={generateQuizMutation.isPending}
                onClick={() => generateQuizMutation.mutate()}
              >
                {generateQuizMutation.isPending ? "Generating…" : "Start quiz"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Generate Flashcards Modal */}
      {genFlashOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-edu-moss-dark/45 p-5" onClick={(e) => e.currentTarget === e.target && setGenFlashOpen(false)}>
          <div className="w-full max-w-[440px] rounded-xl bg-white p-7" style={{ boxShadow: "0 10px 40px rgba(0,0,0,0.25)" }}>
            <h3 className="mb-2 font-source-serif text-lg text-edu-ink">Generate flashcards</h3>
            <p className="mb-5 text-sm text-edu-blue-grey">Based on <b className="text-edu-ink">{file?.title}</b>.</p>
            <div className="mb-5">
              <label className="mb-1.5 block text-[12.5px] font-semibold text-edu-ink">Number of cards</label>
              <select value={flashCount} onChange={(e) => setFlashCount(e.target.value)} className="w-full rounded-lg border-[1.5px] border-edu-line bg-edu-paper p-2.5 text-sm focus:border-edu-moss focus:outline-none">
                <option>10</option><option>20</option><option>30</option>
              </select>
            </div>
            <div className="flex gap-2.5">
              <button className="flex-1 rounded-lg border-[1.5px] border-edu-line py-2.5 text-sm font-bold text-edu-blue-grey hover:bg-edu-paper-2" onClick={() => setGenFlashOpen(false)} disabled={generateFlashMutation.isPending}>Cancel</button>
              <button
                className="flex-1 rounded-lg bg-edu-moss py-2.5 text-sm font-bold text-white hover:bg-edu-moss-dark disabled:opacity-60"
                disabled={generateFlashMutation.isPending}
                onClick={() => generateFlashMutation.mutate()}
              >
                {generateFlashMutation.isPending ? "Generating…" : "Start studying"}
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
