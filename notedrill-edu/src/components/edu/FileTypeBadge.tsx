import React from "react";

export type FileKind = "pdf" | "youtube" | "text" | "image" | "audio" | string;

const MONOGRAM: Record<string, string> = {
  pdf: "P",
  youtube: "Y",
  text: "T",
  image: "I",
  audio: "A",
};

const sizes = {
  sm: "h-8 w-8 text-[11px]",
  md: "h-10 w-10 text-[13px]",
};

interface FileTypeBadgeProps {
  type: FileKind;
  size?: keyof typeof sizes;
  className?: string;
}

/** Monogram tile for a file's source type — same visual language as AvatarInitials, not an emoji. */
export default function FileTypeBadge({ type, size = "md", className = "" }: FileTypeBadgeProps) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-lg bg-edu-moss-light font-bold text-edu-moss-dark ${sizes[size]} ${className}`}
    >
      {MONOGRAM[type] ?? "F"}
    </div>
  );
}
