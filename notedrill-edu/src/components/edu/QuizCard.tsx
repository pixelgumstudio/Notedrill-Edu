"use client";

import React from "react";
import type { QuizQuestion } from "@/types/edu";
import QOption from "./QOption";

interface QuizCardProps {
  question: QuizQuestion;
  questionNumber: number;
  totalQuestions: number;
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  showResult?: boolean;
}

const letters = ["A", "B", "C", "D", "E"];

export default function QuizCard({
  question,
  questionNumber,
  totalQuestions,
  selectedIndex,
  onSelect,
  showResult = false,
}: QuizCardProps) {
  return (
    <div
      className="rounded-xl border border-edu-line bg-white p-7 md:p-8"
      style={{ boxShadow: "var(--edu-shadow)" }}
    >
      <p className="mb-3.5 text-[11.5px] font-bold uppercase tracking-wider text-edu-gold">
        Question {questionNumber} of {totalQuestions}
      </p>
      <p className="mb-6 font-source-serif text-[18px] font-semibold leading-snug text-edu-ink">
        {question.text}
      </p>
      <div className="flex flex-col gap-2.5">
        {question.options.map((opt, i) => (
          <QOption
            key={i}
            label={opt}
            letter={letters[i] ?? String(i + 1)}
            selected={selectedIndex === i}
            correct={showResult && i === question.correctIndex}
            showResult={showResult}
            onClick={() => !showResult && onSelect(i)}
          />
        ))}
      </div>
      {showResult && (
        <div className="mt-4 border-t border-edu-line pt-3 text-[12.5px] text-edu-blue-grey">
          <b className="text-edu-ink">Why:</b> {question.explanation}
        </div>
      )}
    </div>
  );
}
