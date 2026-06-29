import React from "react";

interface QuizNavRowProps {
  onPrev: () => void;
  onNext: () => void;
  isFirst: boolean;
  isLast: boolean;
  selectedIndex: number | null;
  onSubmit?: () => void;
}

export default function QuizNavRow({
  onPrev,
  onNext,
  isFirst,
  isLast,
  selectedIndex,
  onSubmit,
}: QuizNavRowProps) {
  return (
    <div className="mt-6 flex justify-between">
      <button
        onClick={onPrev}
        disabled={isFirst}
        className="rounded-lg border-[1.5px] border-edu-line bg-transparent px-4 py-2 text-sm font-bold text-edu-blue-grey transition-colors hover:bg-edu-paper-2 disabled:pointer-events-none disabled:opacity-40"
      >
        ← Previous
      </button>
      {isLast ? (
        <button
          onClick={onSubmit}
          disabled={selectedIndex === null}
          className="rounded-lg bg-edu-moss px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-edu-moss-dark disabled:pointer-events-none disabled:opacity-40"
        >
          Submit quiz
        </button>
      ) : (
        <button
          onClick={onNext}
          disabled={selectedIndex === null}
          className="rounded-lg bg-edu-moss px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-edu-moss-dark disabled:pointer-events-none disabled:opacity-40"
        >
          Next question →
        </button>
      )}
    </div>
  );
}
