import React from "react";
import Link from "next/link";
import type { StudentNoteSummary } from "@/types/edu";
import FileTypeBadge from "./FileTypeBadge";

interface FileTileProps {
  file: StudentNoteSummary;
  href: string;
}

const typeLabel: Record<string, string> = {
  pdf: "PDF",
  youtube: "YouTube",
  text: "Text",
  image: "Image",
  audio: "Audio",
};

export default function FileTile({ file, href }: FileTileProps) {
  return (
    <Link
      href={href}
      className="block rounded-xl border border-edu-line bg-white p-5 transition-all duration-150 hover:-translate-y-0.5 hover:border-edu-moss"
      style={{ boxShadow: "var(--edu-shadow)" }}
    >
      <div className="mb-3 flex items-start justify-between">
        <FileTypeBadge type={file.sourceType} size="sm" />
        <span className="rounded-md bg-edu-paper-2 px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-edu-blue-grey">
          {typeLabel[file.sourceType] ?? "File"}
        </span>
      </div>
      <h4 className="mb-2 font-source-serif text-[14.5px] font-semibold leading-tight text-edu-moss-dark">
        {file.title}
      </h4>
      <div className="flex gap-3.5 text-[11.5px] text-edu-blue-grey">
        <span>
          {file.quizCount} {file.quizCount === 1 ? "quiz" : "quizzes"}
        </span>
        <span>
          {file.flashcardSetCount} {file.flashcardSetCount === 1 ? "set" : "sets"}
        </span>
      </div>
    </Link>
  );
}
