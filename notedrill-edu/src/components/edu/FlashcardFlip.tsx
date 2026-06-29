"use client";

import React, { useState } from "react";
import type { FlashCard } from "@/types/edu";

interface FlashcardFlipProps {
  card: FlashCard;
  cardNumber: number;
  totalCards: number;
  onPrev: () => void;
  onNext: () => void;
}

export default function FlashcardFlip({
  card,
  cardNumber,
  totalCards,
  onPrev,
  onNext,
}: FlashcardFlipProps) {
  const [flipped, setFlipped] = useState(false);

  const handleFlip = () => setFlipped((f) => !f);

  const handlePrev = () => {
    setFlipped(false);
    onPrev();
  };

  const handleNext = () => {
    setFlipped(false);
    onNext();
  };

  /*
   * Layout approach: CSS Grid overlay.
   *
   * Both faces sit at grid-area 1/1 (col-start-1 row-start-1), so they
   * stack on top of each other in the same cell. The grid container's
   * height becomes the MAX height of the two faces — it grows with
   * content instead of clipping it.
   *
   * The 3D flip is preserved:
   *   - [transform-style:preserve-3d] on the rotating grid div keeps
   *     children in 3D space.
   *   - [backface-visibility:hidden] on each face means only the
   *     front-facing one is visible at any time.
   *   - The back face starts pre-rotated [transform:rotateY(180deg)]
   *     so it faces away from the viewer at rest.
   *
   * Labels ("Question", "Tap to flip") are in normal block flow above
   * and below the text — no absolute positioning that could overlap.
   */

  const faceBase =
    "col-start-1 row-start-1 flex min-h-[14rem] w-full flex-col rounded-2xl border-[1.5px] p-8 [backface-visibility:hidden]";

  return (
    <div className="flex w-full flex-col items-center px-4 pb-10 pt-3">
      {/* Card counter */}
      <p className="mb-4 text-sm font-semibold text-edu-blue-grey">
        Card {cardNumber} of {totalCards}
      </p>

      {/* 3-D flip wrapper */}
      <div
        className="w-full max-w-[460px] cursor-pointer [perspective:1000px]"
        onClick={handleFlip}
        role="button"
        aria-label={
          flipped ? "Answer — click to see question" : "Question — click to see answer"
        }
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && handleFlip()}
      >
        {/* Rotating grid container */}
        <div
          className={`grid w-full transition-all duration-500 [transform-style:preserve-3d] ${
            flipped ? "[transform:rotateY(180deg)]" : ""
          }`}
        >
          {/* ── Front face — Question ─────────────────────────────────── */}
          <div
            className={`${faceBase} border-edu-line bg-white hover:border-edu-moss`}
          >
            {/* Label — top of flow, never overlaps text */}
            <p className="mb-4 text-[10.5px] font-bold uppercase tracking-wider text-edu-gold">
              Question
            </p>

            {/* Question text — grows freely, no overflow */}
            <p className="flex-1 font-source-serif text-[18px] leading-relaxed text-edu-ink">
              {card.question}
            </p>

            {/* Hint — bottom of flow */}
            <p className="mt-5 text-[11.5px] text-edu-blue-grey">
              Tap to flip
            </p>
          </div>

          {/* ── Back face — Answer ────────────────────────────────────── */}
          <div
            className={`${faceBase} border-edu-moss bg-edu-moss-light [transform:rotateY(180deg)]`}
          >
            <p className="mb-4 text-[10.5px] font-bold uppercase tracking-wider text-edu-gold">
              Answer
            </p>

            <p className="flex-1 font-source-serif text-[18px] leading-relaxed text-edu-ink">
              {card.answer}
            </p>

            <p className="mt-5 text-[11.5px] text-edu-blue-grey">
              Tap to flip back
            </p>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="mt-6 flex items-center gap-4">
        <button
          onClick={handlePrev}
          disabled={cardNumber === 1}
          className="flex h-11 w-11 items-center justify-center rounded-full border-[1.5px] border-edu-line bg-white text-base text-edu-moss-dark transition-colors hover:border-edu-moss hover:bg-edu-moss-light disabled:pointer-events-none disabled:opacity-40"
          aria-label="Previous card"
        >
          ←
        </button>
        <button
          onClick={handleFlip}
          className="rounded-lg bg-edu-moss px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-edu-moss-dark"
        >
          Flip card
        </button>
        <button
          onClick={handleNext}
          className="flex h-11 w-11 items-center justify-center rounded-full border-[1.5px] border-edu-line bg-white text-base text-edu-moss-dark transition-colors hover:border-edu-moss hover:bg-edu-moss-light disabled:pointer-events-none disabled:opacity-40"
          aria-label="Next card"
        >
          →
        </button>
      </div>
    </div>
  );
}
