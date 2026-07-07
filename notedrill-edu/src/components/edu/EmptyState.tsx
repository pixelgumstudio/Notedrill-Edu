import React from "react";
import SectionEyebrow from "./SectionEyebrow";

interface EmptyStateProps {
  /** 1-2 letter monogram shown in a colored tile — not an emoji. */
  mark?: string;
  eyebrow?: string;
  heading: string;
  body: string;
  action?: { label: string; onClick: () => void };
  className?: string;
  /** Rendered below the body — use for multi-action rows the single `action` prop can't express. */
  children?: React.ReactNode;
}

/** Editorial empty state — monogram tile + serif heading, no giant emoji. */
export default function EmptyState({ mark, eyebrow, heading, body, action, className = "", children }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center px-6 py-14 text-center ${className}`}>
      {mark && (
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-edu-moss-light text-[15px] font-bold text-edu-moss-dark">
          {mark}
        </div>
      )}
      {eyebrow && <SectionEyebrow className="mb-2">{eyebrow}</SectionEyebrow>}
      <h3 className="mb-1.5 font-source-serif text-[16px] text-edu-moss-dark">{heading}</h3>
      <p className="max-w-xs text-sm leading-relaxed text-edu-blue-grey">{body}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-5 rounded-lg bg-edu-moss px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-edu-moss-dark"
        >
          {action.label}
        </button>
      )}
      {children}
    </div>
  );
}
