"use client";

import React from "react";

interface QOptionProps {
  label: string;
  letter: string;
  selected?: boolean;
  correct?: boolean;
  showResult?: boolean;
  onClick?: () => void;
}

export default function QOption({ label, letter, selected, correct, showResult, onClick }: QOptionProps) {
  let containerClass =
    "flex cursor-pointer items-center gap-3 rounded-xl border-[1.5px] border-edu-line p-3.5 text-[14.5px] transition-all";

  let bulletClass =
    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px] border-edu-line text-[11px] font-bold text-transparent";

  if (showResult) {
    if (correct) {
      containerClass += " border-edu-moss bg-edu-moss-light font-semibold";
      bulletClass = "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px] border-edu-moss bg-edu-moss text-[11px] font-bold text-white";
    } else if (selected && !correct) {
      containerClass += " border-edu-red bg-edu-red-light font-semibold";
      bulletClass = "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px] border-edu-red bg-edu-red text-[11px] font-bold text-white";
    }
  } else if (selected) {
    containerClass += " border-edu-moss bg-edu-moss-light font-semibold";
    bulletClass = "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px] border-edu-moss bg-edu-moss text-[11px] font-bold text-white";
  } else {
    containerClass += " hover:border-edu-moss hover:bg-edu-moss-light";
  }

  return (
    <div className={containerClass} onClick={onClick} role="button" tabIndex={0}>
      <div className={bulletClass}>{selected || (showResult && correct) ? "✓" : ""}</div>
      <span>
        <span className="mr-1 font-bold text-edu-blue-grey">{letter}.</span> {label}
      </span>
    </div>
  );
}
