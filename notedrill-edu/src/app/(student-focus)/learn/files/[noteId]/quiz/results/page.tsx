"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";

interface ReviewItem {
  questionText: string;
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  explanation: string;
}

interface SessionData {
  score: number;
  correctCount: number;
  totalQuestions: number;
  timeTakenSeconds: number;
  fileTitle: string;
  results: ReviewItem[];
}

function grade(score: number): string {
  if (score >= 90) return "A+";
  if (score >= 80) return "A";
  if (score >= 70) return "B";
  if (score >= 60) return "C";
  if (score >= 50) return "D";
  return "F";
}

function gradeColor(g: string) {
  if (g === "A+" || g === "A") return "text-[#2B7A3B]";
  if (g === "B") return "text-edu-moss-dark";
  if (g === "C") return "text-[#9B6B0B]";
  return "text-[#B33A3A]";
}

function gradeRingColor(g: string) {
  if (g === "A+" || g === "A") return "#2B7A3B";
  if (g === "B") return "#3D6B4F";
  if (g === "C") return "#B37A1A";
  return "#B33A3A";
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  return `${m}m ${seconds % 60}s`;
}

export default function QuizResultsPage() {
  const { noteId } = useParams<{ noteId: string }>();
  const searchParams = useSearchParams();
  const quizId = searchParams.get("quizId") ?? "";

  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!quizId) { setLoaded(true); return; }
    const raw = sessionStorage.getItem(`quiz-result-${quizId}`);
    if (raw) {
      try { setSessionData(JSON.parse(raw)); } catch { /* ignore */ }
    }
    setLoaded(true);
  }, [quizId]);

  if (!loaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-edu-paper">
        <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-edu-moss border-t-transparent" />
      </div>
    );
  }

  if (!sessionData) {
    return (
      <div className="min-h-screen bg-edu-paper">
        <div className="flex items-center justify-between border-b border-edu-line bg-white px-5 py-4 md:px-8">
          <div>
            <h1 className="font-source-serif text-[18px] text-edu-moss-dark">Quiz results</h1>
            <p className="mt-0.5 text-sm text-edu-blue-grey">No detailed results available for this attempt</p>
          </div>
          <Link href={`/learn/files/${noteId}`} className="rounded-lg border-[1.5px] border-edu-line bg-transparent px-3 py-1.5 text-sm font-bold text-edu-blue-grey hover:bg-edu-paper-2">
            Back to file
          </Link>
        </div>
        <div className="mx-auto flex max-w-[700px] flex-col items-center px-5 py-16 text-center">
          <p className="mb-6 text-sm text-edu-blue-grey">Detailed review is only available immediately after completing a quiz. Retake this quiz to see full results.</p>
          <Link href={`/learn/files/${noteId}/quiz?quizId=${quizId}`} className="rounded-lg bg-edu-moss px-5 py-2.5 text-sm font-bold text-white hover:bg-edu-moss-dark">
            Retake quiz
          </Link>
        </div>
      </div>
    );
  }

  const { score, correctCount, totalQuestions, timeTakenSeconds, fileTitle, results } = sessionData;
  const g = grade(score);
  const ringColor = gradeRingColor(g);

  return (
    <div className="min-h-screen bg-edu-paper pb-16">
      {/* Topbar */}
      <div className="flex items-center justify-between border-b border-edu-line bg-white px-5 py-4 md:px-8">
        <div>
          <h1 className="font-source-serif text-[18px] text-edu-moss-dark">{fileTitle}</h1>
          <p className="mt-0.5 text-sm text-edu-blue-grey">Quiz results</p>
        </div>
        <Link
          href={`/learn/files/${noteId}`}
          className="rounded-lg border-[1.5px] border-edu-line bg-transparent px-3 py-1.5 text-sm font-bold text-edu-blue-grey hover:bg-edu-paper-2"
        >
          Back to file
        </Link>
      </div>

      <div className="mx-auto max-w-[700px] px-5 py-9 md:px-8">
        {/* Hero result card */}
        <div className="mb-6 overflow-hidden rounded-2xl border border-edu-line bg-white" style={{ boxShadow: "var(--edu-shadow)" }}>
          <div className="px-6 pt-8 pb-6 text-center">
            <div
              className="mx-auto mb-4 flex h-[88px] w-[88px] items-center justify-center rounded-full border-[5px]"
              style={{ borderColor: ringColor }}
            >
              <span className={`font-source-serif text-[36px] font-bold ${gradeColor(g)}`}>{g}</span>
            </div>
            <p className="font-source-serif text-[42px] leading-none text-edu-ink">{score}%</p>
            <p className="mt-1.5 text-[14px] text-edu-blue-grey">
              {score >= 75 ? "Well done!" : score >= 50 ? "Good effort — keep practising!" : "Keep going — review the explanations below!"}
            </p>
          </div>

          <div className="grid grid-cols-3 border-t border-edu-line divide-x divide-edu-line">
            <div className="py-4 text-center">
              <p className="font-source-serif text-[22px] text-edu-ink">{correctCount}/{totalQuestions}</p>
              <p className="mt-0.5 text-[11.5px] text-edu-blue-grey uppercase tracking-wide font-bold">Correct</p>
            </div>
            <div className="py-4 text-center">
              <p className="font-ibm-plex-mono text-[22px] text-edu-ink">{formatTime(timeTakenSeconds)}</p>
              <p className="mt-0.5 text-[11.5px] text-edu-blue-grey uppercase tracking-wide font-bold">Time taken</p>
            </div>
            <div className="py-4 text-center">
              <p className={`font-source-serif text-[22px] ${gradeColor(g)}`}>{g}</p>
              <p className="mt-0.5 text-[11.5px] text-edu-blue-grey uppercase tracking-wide font-bold">Grade</p>
            </div>
          </div>
        </div>

        {/* Review section */}
        <h3 className="mb-3 font-source-serif text-[16px] text-edu-moss-dark">Question review</h3>
        <div className="flex flex-col gap-3.5">
          {results.map((item, i) => (
            <div
              key={i}
              className={`rounded-xl border-[1.5px] bg-white p-5 ${item.isCorrect ? "border-[#7FC99A]" : "border-[#E8A0A0]"}`}
              style={{ boxShadow: "var(--edu-shadow)" }}
            >
              <div className="mb-3 flex items-start gap-3">
                <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold text-white ${item.isCorrect ? "bg-[#2B7A3B]" : "bg-[#B33A3A]"}`}>
                  {item.isCorrect ? "✓" : "✗"}
                </div>
                <p className="text-[13.5px] leading-relaxed text-edu-ink">{item.questionText}</p>
              </div>

              <div className="ml-8 space-y-1.5 text-[12.5px]">
                <div className="flex items-start gap-2">
                  <span className="font-bold text-edu-blue-grey shrink-0">Your answer:</span>
                  <span className={item.isCorrect ? "text-[#2B7A3B] font-semibold" : "text-[#B33A3A] font-semibold line-through"}>{item.userAnswer || "—"}</span>
                </div>
                {!item.isCorrect && (
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-edu-blue-grey shrink-0">Correct answer:</span>
                    <span className="font-semibold text-[#2B7A3B]">{item.correctAnswer}</span>
                  </div>
                )}
                <div className="mt-2.5 rounded-lg bg-edu-paper-2 px-3.5 py-2.5 text-edu-blue-grey leading-relaxed">
                  <span className="font-bold text-edu-ink">Explanation: </span>{item.explanation}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* CTA row */}
        <div className="mt-7 flex flex-col gap-2.5 sm:flex-row">
          <Link
            href={`/learn/files/${noteId}?tab=quiz`}
            className="flex-1 rounded-lg border-[1.5px] border-edu-line bg-white py-2.5 text-center text-sm font-bold text-edu-blue-grey hover:bg-edu-paper-2"
          >
            Back to quiz history
          </Link>
          <Link
            href={`/learn/files/${noteId}/quiz?quizId=${quizId}`}
            className="flex-1 rounded-lg bg-edu-moss py-2.5 text-center text-sm font-bold text-white hover:bg-edu-moss-dark"
          >
            Try again
          </Link>
        </div>
      </div>
    </div>
  );
}
