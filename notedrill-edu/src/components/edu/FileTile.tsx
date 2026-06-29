import React from "react";
import Link from "next/link";
import type { StudentFile } from "@/types/edu";

interface FileTileProps {
  file: StudentFile;
  href: string;
}

const typeIcon: Record<string, string> = {
  pdf: "📄",
  youtube: "▶",
  text: "✎",
  image: "🖼",
};

const typeLabel: Record<string, string> = {
  pdf: "PDF",
  youtube: "YouTube",
  text: "Text",
  image: "Image",
};

export default function FileTile({ file, href }: FileTileProps) {
  return (
    <Link
      href={href}
      className="block rounded-xl border border-edu-line bg-white p-5 transition-all duration-150 hover:-translate-y-0.5 hover:border-edu-moss"
      style={{ boxShadow: "var(--edu-shadow)" }}
    >
      <div className="mb-3 flex items-start justify-between">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-edu-moss-light text-base text-edu-moss-dark">
          {typeIcon[file.type] ?? "📄"}
        </div>
        <span className="rounded-md bg-edu-paper-2 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-edu-blue-grey">
          {typeLabel[file.type] ?? "File"}
        </span>
      </div>
      <h4 className="mb-2 font-source-serif text-[14.5px] font-semibold leading-tight text-edu-moss-dark">
        {file.title}
      </h4>
      <div className="flex gap-3.5 text-[11.5px] text-edu-blue-grey">
        <span className="flex items-center gap-1">
          📝 {file.quizCount} {file.quizCount === 1 ? "quiz" : "quizzes"} taken
        </span>
        <span className="flex items-center gap-1">
          🗂 {file.flashcardSetCount} {file.flashcardSetCount === 1 ? "set" : "sets"}
        </span>
      </div>
    </Link>
  );
}
