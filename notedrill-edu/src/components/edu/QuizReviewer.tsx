"use client";

import React, { useState } from "react";
import type { AdminQuizQuestion } from "@/types/edu";
import EmptyState from "./EmptyState";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface QuizReviewerProps {
  questions: AdminQuizQuestion[];
  onQuestionsChange: (updated: AdminQuizQuestion[]) => void;
  onToast: (msg: string) => void;
}

interface QuestionDraft {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildDraft(q: AdminQuizQuestion): QuestionDraft {
  return {
    question: q.question,
    options: [...q.options],
    correctIndex: Math.max(0, q.options.indexOf(q.correctAnswer)),
    explanation: q.explanation ?? "",
  };
}

// ── Main component ────────────────────────────────────────────────────────────
// Edits are local-only — there's no question-update endpoint on the backend,
// so nothing here is persisted server-side (a page refresh reverts it).

export default function QuizReviewer({
  questions,
  onQuestionsChange,
  onToast,
}: QuizReviewerProps) {
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [draft, setDraft] = useState<QuestionDraft | null>(null);

  function openEdit(idx: number) {
    setDraft(buildDraft(questions[idx]));
    setEditingIdx(idx);
  }

  function cancelEdit() {
    setEditingIdx(null);
    setDraft(null);
  }

  function saveEdit() {
    if (editingIdx === null || !draft) return;
    const updated = questions.map((q, i) =>
      i !== editingIdx
        ? q
        : {
            ...q,
            question: draft.question,
            options: draft.options,
            correctAnswer: draft.options[draft.correctIndex],
            explanation: draft.explanation,
          },
    );
    onQuestionsChange(updated);
    onToast("Question updated (this session only)");
    setEditingIdx(null);
    setDraft(null);
  }

  function updateDraftOption(optIdx: number, value: string) {
    if (!draft) return;
    const options = [...draft.options];
    options[optIdx] = value;
    setDraft({ ...draft, options });
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (questions.length === 0) {
    return (
      <EmptyState
        mark="Q"
        heading="No questions in this quiz"
        body="This quiz doesn't have any questions yet."
        className="rounded-xl border border-edu-line bg-edu-paper-2"
      />
    );
  }

  return (
    <div className="space-y-3">
      {questions.map((q, idx) => {
        const correctIdx = q.options.indexOf(q.correctAnswer);
        const isEditing = editingIdx === idx;

        return (
          <div
            key={idx}
            className={[
              "overflow-hidden rounded-xl border bg-white transition-colors",
              isEditing ? "border-edu-moss" : "border-edu-line",
            ].join(" ")}
            style={{ boxShadow: "var(--edu-shadow)" }}
          >
            {isEditing && draft ? (
              /* ── Edit mode ─────────────────────────────────────────────── */
              <div className="p-5">
                <p className="mb-2 text-[10.5px] font-bold uppercase tracking-widest text-edu-moss">
                  Question {idx + 1} — editing
                </p>

                {/* Question text */}
                <label className="mb-1 block text-[12px] font-semibold text-edu-ink">
                  Question
                </label>
                <textarea
                  rows={2}
                  value={draft.question}
                  onChange={(e) => setDraft({ ...draft, question: e.target.value })}
                  className="mb-4 w-full resize-none rounded-lg border-[1.5px] border-edu-line bg-edu-paper-2 p-2.5 text-sm text-edu-ink focus:border-edu-moss focus:outline-none"
                />

                {/* Options */}
                <label className="mb-2 block text-[12px] font-semibold text-edu-ink">
                  Options — select radio to mark correct answer
                </label>
                <div className="mb-4 space-y-2">
                  {draft.options.map((optText, optIdx) => (
                    <div key={optIdx} className="flex items-center gap-2.5">
                      <input
                        type="radio"
                        name={`correct-${idx}`}
                        checked={draft.correctIndex === optIdx}
                        onChange={() => setDraft({ ...draft, correctIndex: optIdx })}
                        className="h-4 w-4 accent-[#3b7a57] cursor-pointer"
                      />
                      <input
                        type="text"
                        value={optText}
                        onChange={(e) => updateDraftOption(optIdx, e.target.value)}
                        className="flex-1 rounded-lg border-[1.5px] border-edu-line bg-edu-paper-2 px-2.5 py-1.5 text-sm text-edu-ink focus:border-edu-moss focus:outline-none"
                      />
                    </div>
                  ))}
                </div>

                {/* Explanation */}
                <label className="mb-1 block text-[12px] font-semibold text-edu-ink">
                  Explanation
                </label>
                <textarea
                  rows={2}
                  value={draft.explanation}
                  onChange={(e) => setDraft({ ...draft, explanation: e.target.value })}
                  className="mb-4 w-full resize-none rounded-lg border-[1.5px] border-edu-line bg-edu-paper-2 p-2.5 text-sm text-edu-ink focus:border-edu-moss focus:outline-none"
                />

                <div className="flex gap-2.5">
                  <button
                    onClick={cancelEdit}
                    className="flex-1 rounded-lg border-[1.5px] border-edu-line py-2 text-sm font-bold text-edu-blue-grey hover:bg-edu-paper-2"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveEdit}
                    disabled={!draft.question.trim() || draft.options.some((o) => !o.trim())}
                    className="flex-1 rounded-lg bg-edu-moss py-2 text-sm font-bold text-white hover:bg-edu-moss-dark disabled:opacity-60"
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              /* ── View mode ─────────────────────────────────────────────── */
              <div className="p-5">
                {/* Question header */}
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="mb-1 text-[10.5px] font-bold uppercase tracking-wider text-edu-gold">
                      Question {idx + 1} of {questions.length}
                    </p>
                    <p className="text-[14.5px] font-semibold leading-snug text-edu-ink">
                      {q.question}
                    </p>
                  </div>
                  <button
                    onClick={() => openEdit(idx)}
                    className="shrink-0 rounded-lg border border-edu-line bg-white px-2.5 py-1 text-[12px] font-semibold text-edu-blue-grey transition-colors hover:border-edu-moss hover:text-edu-moss-dark"
                  >
                    ✎ Edit
                  </button>
                </div>

                {/* Options grid */}
                <div className="mb-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                  {q.options.map((opt, optIdx) => {
                    const isCorrect = optIdx === correctIdx;
                    return (
                      <div
                        key={optIdx}
                        className={[
                          "flex items-start gap-2 rounded-lg border px-3 py-2 text-[13px]",
                          isCorrect
                            ? "border-edu-moss bg-edu-moss-light font-semibold text-edu-moss-dark"
                            : "border-edu-line bg-edu-paper-2 text-edu-ink",
                        ].join(" ")}
                      >
                        <span
                          className={[
                            "mt-px h-4 w-4 shrink-0 rounded-full border text-[10px] font-bold flex items-center justify-center",
                            isCorrect
                              ? "border-edu-moss bg-edu-moss text-white"
                              : "border-edu-line bg-white text-edu-blue-grey",
                          ].join(" ")}
                        >
                          {isCorrect ? "✓" : ""}
                        </span>
                        {opt}
                      </div>
                    );
                  })}
                </div>

                {/* Explanation */}
                {q.explanation && (
                  <div className="flex items-start gap-2 rounded-lg bg-edu-paper-2 px-3 py-2 text-[12.5px] text-edu-blue-grey">
                    <span className="shrink-0">💡</span>
                    <span>{q.explanation}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
