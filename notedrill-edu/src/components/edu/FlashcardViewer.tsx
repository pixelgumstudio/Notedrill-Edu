"use client";

import React, { useState, useEffect } from "react";
import type { AdminFlashcard } from "@/types/edu";
import EmptyState from "./EmptyState";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FlashcardViewerProps {
  cards: AdminFlashcard[];
  onCardsChange: (updated: AdminFlashcard[]) => void;
  onToast: (msg: string) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────
// Edits are local-only — there's no card-update endpoint on the backend, so
// nothing here is persisted server-side (a page refresh reverts it).

export default function FlashcardViewer({
  cards,
  onCardsChange,
  onToast,
}: FlashcardViewerProps) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [visible, setVisible] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [draftFront, setDraftFront] = useState("");
  const [draftBack, setDraftBack] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const total = cards.length;
  const card = cards[currentIdx] ?? null;

  // Reset flip + edit when the card changes
  useEffect(() => {
    setIsFlipped(false);
    setIsEditing(false);
    setVisible(true);
  }, [currentIdx]);

  // ── Helpers ────────────────────────────────────────────────────────────────

  function fadeTransition(action: () => void) {
    setVisible(false);
    setTimeout(() => {
      action();
      setVisible(true);
    }, 140);
  }

  function handleFlip() {
    if (isEditing) return;
    fadeTransition(() => setIsFlipped((f) => !f));
  }

  function goTo(idx: number) {
    if (idx === currentIdx) return;
    fadeTransition(() => {
      setCurrentIdx(idx);
      setIsFlipped(false);
    });
  }

  function openEdit() {
    if (!card) return;
    setDraftFront(card.question);
    setDraftBack(card.answer);
    setIsEditing(true);
    setIsFlipped(false);
  }

  function cancelEdit() {
    setIsEditing(false);
  }

  function saveEdit() {
    if (!card) return;
    setIsSaving(true);
    const updated = cards.map((c, i) =>
      i === currentIdx ? { ...c, question: draftFront, answer: draftBack } : c,
    );
    onCardsChange(updated);
    onToast("Card updated (this session only)");
    setIsEditing(false);
    setIsSaving(false);
  }

  // ── Keyboard navigation ────────────────────────────────────────────────────

  useEffect(() => {
    if (isEditing) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") goTo(Math.min(currentIdx + 1, total - 1));
      if (e.key === "ArrowLeft") goTo(Math.max(currentIdx - 1, 0));
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        handleFlip();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isEditing, currentIdx, total]);

  // ── Empty state ────────────────────────────────────────────────────────────

  if (total === 0) {
    return (
      <EmptyState
        mark="F"
        heading="No cards in this set"
        body="This flashcard deck doesn't have any cards yet."
        className="rounded-xl border border-edu-line bg-edu-paper-2"
      />
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="select-none">

      {/* ── Counter + Edit button ───────────────────────────────────────── */}
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[12.5px] font-semibold text-edu-blue-grey">
          Card {currentIdx + 1} of {total}
        </p>

        {/* Side indicator pills */}
        {!isEditing && (
          <div className="flex items-center gap-2">
            <span
              className={`h-1.5 w-5 rounded-full transition-colors ${!isFlipped ? "bg-edu-moss" : "bg-edu-line"}`}
            />
            <span
              className={`h-1.5 w-5 rounded-full transition-colors ${isFlipped ? "bg-edu-blue-grey" : "bg-edu-line"}`}
            />
          </div>
        )}

        {!isEditing && (
          <button
            onClick={openEdit}
            className="flex items-center gap-1.5 rounded-lg border border-edu-line bg-white px-3 py-1.5 text-[12.5px] font-semibold text-edu-moss-dark transition-colors hover:border-edu-moss hover:bg-edu-moss-light"
          >
            ✎ Edit card
          </button>
        )}
      </div>

      {/* ── Card body ───────────────────────────────────────────────────── */}
      {/*
        No fixed height — the card grows with its content.
        overflow-hidden on the outer shell keeps rounded corners clean.
        The inner face div uses block layout (not flex-centering) so long
        text simply flows downward and the card grows to fit.
      */}
      <div
        className={[
          "relative w-full overflow-hidden rounded-xl border transition-colors duration-150",
          isEditing
            ? "border-edu-moss bg-white"
            : "cursor-pointer border-edu-line bg-white shadow-sm hover:border-edu-moss",
        ].join(" ")}
        style={{ boxShadow: isEditing ? "none" : "var(--edu-shadow)" }}
        onClick={isEditing ? undefined : handleFlip}
      >
        {/* Fade wrapper — opacity only, no min-h constraint */}
        <div
          className={`transition-opacity duration-[140ms] ${visible ? "opacity-100" : "opacity-0"}`}
        >
          {isEditing ? (
            /* ── Edit mode ─────────────────────────────────────────────── */
            <div
              className="p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="mb-4 text-[10.5px] font-bold uppercase tracking-widest text-edu-moss">
                Editing card {currentIdx + 1}
              </p>

              <label className="mb-1.5 block text-[12px] font-bold uppercase tracking-wider text-edu-moss">
                Front (Question)
              </label>
              <textarea
                rows={4}
                value={draftFront}
                onChange={(e) => setDraftFront(e.target.value)}
                className="mb-5 w-full resize-none rounded-lg border-[1.5px] border-edu-line bg-edu-paper-2 p-3 text-sm leading-relaxed text-edu-ink focus:border-edu-moss focus:outline-none"
              />

              <label className="mb-1.5 block text-[12px] font-bold uppercase tracking-wider text-edu-blue-grey">
                Back (Answer)
              </label>
              <textarea
                rows={4}
                value={draftBack}
                onChange={(e) => setDraftBack(e.target.value)}
                className="mb-6 w-full resize-none rounded-lg border-[1.5px] border-edu-line bg-edu-paper-2 p-3 text-sm leading-relaxed text-edu-ink focus:border-edu-moss focus:outline-none"
              />

              <div className="flex gap-2.5">
                <button
                  onClick={cancelEdit}
                  className="flex-1 rounded-lg border-[1.5px] border-edu-line py-2.5 text-sm font-bold text-edu-blue-grey hover:bg-edu-paper-2"
                >
                  Cancel
                </button>
                <button
                  onClick={saveEdit}
                  disabled={isSaving || !draftFront.trim() || !draftBack.trim()}
                  className="flex-1 rounded-lg bg-edu-moss py-2.5 text-sm font-bold text-white hover:bg-edu-moss-dark disabled:opacity-60"
                >
                  {isSaving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          ) : !isFlipped ? (
            /* ── Front face ────────────────────────────────────────────── */
            /*
              Block layout (not flex-centering): label sits at top,
              text flows naturally below it. Card grows with content.
              min-h keeps short cards from looking squashed.
            */
            <div className="min-h-[10rem] p-8">
              {/* Label — inline block at the top, never overlaps text */}
              <p className="mb-4 text-[10.5px] font-bold uppercase tracking-widest text-edu-moss">
                Question
              </p>
              <p className="font-source-serif text-lg leading-relaxed text-edu-moss-dark">
                {card?.question}
              </p>
              {/* Tap hint — below the text, always visible */}
              <p className="mt-6 text-[11px] text-edu-blue-grey">
                Click or press Space to reveal answer
              </p>
            </div>
          ) : (
            /* ── Back face ─────────────────────────────────────────────── */
            <div className="min-h-[10rem] p-8">
              <p className="mb-4 text-[10.5px] font-bold uppercase tracking-widest text-edu-blue-grey">
                Answer
              </p>
              <p className="text-base leading-relaxed text-edu-ink">
                {card?.answer}
              </p>
              <p className="mt-6 text-[11px] text-edu-blue-grey">
                Click or press Space to flip back
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Navigation ──────────────────────────────────────────────────── */}
      {!isEditing && (
        <div className="mt-4 flex items-center gap-2">
          <button
            onClick={() => goTo(Math.max(currentIdx - 1, 0))}
            disabled={currentIdx === 0}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-edu-line bg-white text-sm text-edu-blue-grey transition-colors hover:border-edu-moss hover:text-edu-moss-dark disabled:cursor-not-allowed disabled:opacity-30"
            title="Previous (←)"
          >
            ←
          </button>

          {/* Dot strip — capped at 12 dots */}
          <div className="flex flex-1 items-center justify-center gap-1 overflow-hidden">
            {cards.slice(0, 12).map((_, i) => (
              <button
                key={i}
                onClick={() => goTo(i)}
                className={[
                  "h-2 rounded-full transition-all",
                  i === currentIdx
                    ? "w-5 bg-edu-moss"
                    : "w-2 bg-edu-line hover:bg-edu-blue-grey",
                ].join(" ")}
                title={`Card ${i + 1}`}
              />
            ))}
            {total > 12 && (
              <span className="text-[11px] text-edu-blue-grey">+{total - 12}</span>
            )}
          </div>

          <button
            onClick={() => goTo(Math.min(currentIdx + 1, total - 1))}
            disabled={currentIdx === total - 1}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-edu-line bg-white text-sm text-edu-blue-grey transition-colors hover:border-edu-moss hover:text-edu-moss-dark disabled:cursor-not-allowed disabled:opacity-30"
            title="Next (→)"
          >
            →
          </button>
        </div>
      )}

      {/* Keyboard hint */}
      {!isEditing && (
        <p className="mt-2 text-center text-[11px] text-edu-line">
          ← → to navigate · Space to flip
        </p>
      )}
    </div>
  );
}
