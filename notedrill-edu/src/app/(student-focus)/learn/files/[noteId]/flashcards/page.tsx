"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import FlashcardFlip from "@/components/edu/FlashcardFlip";
import EduBackButton from "@/components/edu/EduBackButton";
import { studentApi } from "@/lib/student-api";
import { useAuth } from "@/context/AuthContext";
import type { FlashCard, StudentFlashcardSet } from "@/types/edu";

/** Map backend cards ({ question, answer }) to the shape FlashcardFlip expects. */
function mapCards(set: StudentFlashcardSet): FlashCard[] {
  return set.cards.map((c, i) => ({
    id: `card-${i}`,
    question: c.question,
    answer: c.answer,
  }));
}

export default function FlashcardsPage() {
  const { noteId } = useParams<{ noteId: string }>();
  const searchParams = useSearchParams();
  const setId = searchParams.get("setId") ?? "";
  const { studentToken } = useAuth();

  const [current, setCurrent] = useState(0);
  const [completed, setCompleted] = useState<Set<number>>(new Set());
  const [done, setDone] = useState(false);

  // There's no single-set-by-id endpoint — the history list already returns
  // full `cards[]` per entry, so find this set within it.
  const { data: historyData, isLoading, isError } = useQuery({
    queryKey: ["student-flash-history", noteId],
    queryFn: () => studentApi.getFlashcardHistory(studentToken ?? "", noteId),
    enabled: !!studentToken && !!noteId && !!setId,
    staleTime: 30_000,
  });
  const flashcardSet = historyData?.items.find((s) => s.id === setId);

  const cards: FlashCard[] = flashcardSet ? mapCards(flashcardSet) : [];
  const total = cards.length;
  const progress = total > 0 ? (completed.size / total) * 100 : 0;

  const handlePrev = () => { if (current > 0) setCurrent((i) => i - 1); };
  const handleNext = () => {
    setCompleted((prev) => new Set(prev).add(current));
    if (current < total - 1) {
      setCurrent((i) => i + 1);
    } else {
      setDone(true);
    }
  };

  if (!setId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-edu-paper p-8 text-center text-edu-blue-grey">
        <p>No flashcard set specified.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-edu-paper">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-edu-moss border-t-transparent" />
          <p className="text-sm font-semibold text-edu-moss-dark">Loading flashcards…</p>
        </div>
      </div>
    );
  }

  if (isError || !flashcardSet || cards.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-edu-paper p-8 text-center">
        <p className="text-edu-blue-grey">Could not load flashcards. This set may be unavailable.</p>
        <EduBackButton href={`/learn/files/${noteId}`} label="Back to file" />
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen bg-edu-paper">
        <div className="flex items-center justify-between border-b border-edu-line bg-white px-5 py-4 md:px-8">
          <div>
            <h1 className="font-source-serif text-[18px] text-edu-moss-dark">Flashcards complete</h1>
            <p className="mt-0.5 text-sm text-edu-blue-grey">{total} cards reviewed</p>
          </div>
          <EduBackButton href={`/learn/files/${noteId}`} label="Exit" />
        </div>
        <div className="mx-auto flex max-w-[460px] flex-col items-center px-5 py-20 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-edu-moss-light text-3xl">🎉</div>
          <h2 className="mb-2 font-source-serif text-[22px] text-edu-moss-dark">You reviewed all {total} cards!</h2>
          <p className="mb-8 text-[14px] text-edu-blue-grey">Great work. Head back to the file or do another round to reinforce your memory.</p>
          <div className="flex w-full flex-col gap-2.5 sm:flex-row">
            <Link
              href={`/learn/files/${noteId}`}
              className="flex-1 rounded-lg border-[1.5px] border-edu-line bg-white py-2.5 text-center text-sm font-bold text-edu-blue-grey hover:bg-edu-paper-2"
            >
              Back to file
            </Link>
            <button
              className="flex-1 rounded-lg bg-edu-moss py-2.5 text-sm font-bold text-white hover:bg-edu-moss-dark"
              onClick={() => { setCurrent(0); setCompleted(new Set()); setDone(false); }}
            >
              Study again
            </button>
          </div>
        </div>
      </div>
    );
  }

  const card = cards[current];

  return (
    <div className="min-h-screen bg-edu-paper">
      {/* Topbar */}
      <div className="flex items-center justify-between border-b border-edu-line bg-white px-5 py-4 md:px-8">
        <div>
          <h1 className="font-source-serif text-[18px] text-edu-moss-dark">{flashcardSet.noteTitle}</h1>
          <p className="mt-0.5 text-sm text-edu-blue-grey">Flashcard study</p>
        </div>
        <EduBackButton href={`/learn/files/${noteId}`} label="Exit" />
      </div>

      <div className="mx-auto flex max-w-[560px] flex-col items-center px-5 py-9 md:px-8">
        {/* Progress */}
        <div className="mb-3 flex w-full items-center justify-between text-sm text-edu-blue-grey">
          <span className="font-ibm-plex-mono text-[12px] text-edu-moss-dark">{completed.size}/{total} reviewed</span>
        </div>
        <div className="mb-5 h-1.5 w-full overflow-hidden rounded-full bg-edu-paper-2">
          <div className="h-full rounded-full bg-edu-moss transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>

        {card && (
          <FlashcardFlip
            key={card.id}
            card={card}
            cardNumber={current + 1}
            totalCards={total}
            onPrev={handlePrev}
            onNext={handleNext}
          />
        )}
      </div>
    </div>
  );
}
