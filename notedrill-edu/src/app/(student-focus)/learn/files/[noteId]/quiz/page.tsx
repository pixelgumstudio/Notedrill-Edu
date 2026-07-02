"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import QuizCard from "@/components/edu/QuizCard";
import QuizNavRow from "@/components/edu/QuizNavRow";
import EduBackButton from "@/components/edu/EduBackButton";
import { studentApi } from "@/lib/student-api";
import { useAuth } from "@/context/AuthContext";
import type { QuizQuestion } from "@/types/edu";
import type { AdminGeneratedQuiz } from "@/types/edu";

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

/** Map backend quiz questions to the shape QuizCard expects, hiding correctAnswer. */
function mapToQuizCards(quiz: AdminGeneratedQuiz): QuizQuestion[] {
  return quiz.questions.map((q, i) => ({
    id: q.id ?? `q-${i}`,
    text: q.question ?? q.questionText ?? "",
    options: q.options.map((o) => (typeof o === "string" ? o : o.text)),
    correctIndex: -1,
    explanation: q.explanation,
  }));
}

const indexToLetter = (i: number) => "ABCD"[i] ?? String(i);

export default function QuizTakingPage() {
  const { noteId } = useParams<{ noteId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const quizId = searchParams.get("quizId") ?? "";
  const { studentToken } = useAuth();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [timeLeft, setTimeLeft] = useState(15 * 60);
  const [submitted, setSubmitted] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [startTime] = useState(() => Date.now());

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2600); };

  const { data: quiz, isLoading, isError } = useQuery<AdminGeneratedQuiz>({
    queryKey: ["student-quiz", quizId],
    queryFn: () => studentApi.getQuizById(studentToken ?? "", quizId),
    enabled: !!studentToken && !!quizId,
    staleTime: Infinity,
  });

  const questions: QuizQuestion[] = quiz ? mapToQuizCards(quiz) : [];

  useEffect(() => {
    if (questions.length > 0 && answers.length === 0) {
      setAnswers(Array(questions.length).fill(null));
    }
  }, [questions.length, answers.length]);

  useEffect(() => {
    if (submitted) return;
    const id = setInterval(() => setTimeLeft((t) => Math.max(0, t - 1)), 1000);
    return () => clearInterval(id);
  }, [submitted]);

  const submitMutation = useMutation({
    mutationFn: (letterAnswers: string[]) =>
      studentApi.submitQuiz(studentToken ?? "", quizId, letterAnswers),
    onSuccess: (result) => {
      const timeTakenSeconds = Math.round((Date.now() - startTime) / 1000);
      if (quiz) {
        sessionStorage.setItem(
          `quiz-result-${quizId}`,
          JSON.stringify({
            score: result.score,
            correctCount: result.correctCount,
            totalQuestions: result.totalQuestions,
            timeTakenSeconds,
            fileTitle: quiz.title,
            results: result.results,
            questions: quiz.questions,
            userAnswerIndices: answers,
          }),
        );
      }
      setSubmitted(true);
      showToast("Quiz submitted!");
      setTimeout(() => router.push(`/learn/files/${noteId}/quiz/results?quizId=${quizId}`), 800);
    },
    onError: (err: Error) => {
      showToast(err.message || "Submission failed — please try again.");
    },
  });

  const handleSubmit = useCallback(() => {
    if (submitMutation.isPending) return;
    const letterAnswers = answers.map((i) => (i !== null ? indexToLetter(i) : ""));
    submitMutation.mutate(letterAnswers);
  }, [answers, submitMutation]);

  const question = questions[currentIndex];
  const selected = answers[currentIndex] ?? null;
  const progress = questions.length > 0 ? ((currentIndex + 1) / questions.length) * 100 : 0;

  if (!quizId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-edu-paper p-8 text-center text-edu-blue-grey">
        <p>No quiz ID specified.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-edu-paper">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-edu-moss border-t-transparent" />
          <p className="text-sm font-semibold text-edu-moss-dark">Loading quiz…</p>
        </div>
      </div>
    );
  }

  if (isError || !quiz || questions.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-edu-paper p-8 text-center">
        <p className="text-edu-blue-grey">Could not load quiz. It may be unavailable.</p>
        <EduBackButton href={`/learn/files/${noteId}`} label="Back to file" />
      </div>
    );
  }

  if (!question) return null;

  return (
    <div className="min-h-screen bg-edu-paper">
      {/* Minimal topbar */}
      <div className="flex items-center justify-between border-b border-edu-line bg-white px-5 py-4 md:px-8">
        <div>
          <h1 className="font-source-serif text-[18px] text-edu-moss-dark">{quiz.title}</h1>
          <p className="mt-0.5 text-sm text-edu-blue-grey">Quiz in progress</p>
        </div>
        <EduBackButton href={`/learn/files/${noteId}`} label="Exit quiz" />
      </div>

      <div className="mx-auto max-w-[700px] px-5 py-9 md:px-8">
        {/* Meta row */}
        <div className="mb-4 flex items-center justify-between text-sm text-edu-blue-grey">
          <span>Question <b className="text-edu-ink">{currentIndex + 1}</b> of <b className="text-edu-ink">{questions.length}</b></span>
          <span className="flex items-center gap-1.5 font-ibm-plex-mono font-bold text-edu-moss-dark">
            ⏱ {formatTime(timeLeft)}
          </span>
        </div>

        {/* Progress bar */}
        <div className="mb-5 h-1.5 overflow-hidden rounded-full bg-edu-paper-2">
          <div className="h-full rounded-full bg-edu-moss transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>

        {/* Quiz card */}
        <QuizCard
          question={question}
          questionNumber={currentIndex + 1}
          totalQuestions={questions.length}
          selectedIndex={selected}
          onSelect={(idx) => {
            if (submitted) return;
            setAnswers((prev) => { const next = [...prev]; next[currentIndex] = idx; return next; });
          }}
        />

        {/* Navigation */}
        <QuizNavRow
          onPrev={() => { if (currentIndex > 0) setCurrentIndex((i) => i - 1); }}
          onNext={() => { if (currentIndex < questions.length - 1) setCurrentIndex((i) => i + 1); }}
          isFirst={currentIndex === 0}
          isLast={currentIndex === questions.length - 1}
          selectedIndex={selected}
          onSubmit={handleSubmit}
        />
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 z-[2000] flex items-center gap-2.5 rounded-xl bg-edu-moss-dark px-5 py-3.5 text-sm font-semibold text-white" style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.25)" }}>
          {toast}
        </div>
      )}
    </div>
  );
}
