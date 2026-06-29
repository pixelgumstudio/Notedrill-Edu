import React from "react";

interface ScorePillProps {
  score: number | null;
  className?: string;
}

export default function ScorePill({ score, className = "" }: ScorePillProps) {
  if (score === null) {
    return (
      <span className={`inline-block rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-bold text-gray-400 ${className}`}>
        —
      </span>
    );
  }

  const variant =
    score >= 75
      ? "bg-[#E4F3EA] text-[#1E7A46]"
      : score >= 50
      ? "bg-[#FCF1DC] text-[#9A6A0C]"
      : "bg-edu-red-light text-edu-red";

  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${variant} ${className}`}>
      {score}%
    </span>
  );
}
