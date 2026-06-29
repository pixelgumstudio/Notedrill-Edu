import React from "react";

interface FileCardProps {
  title: string;
  subtitle: string;
  type?: "pdf" | "youtube" | "text" | "image";
  visible?: boolean;
  onClick?: () => void;
}

const typeIcon: Record<string, string> = {
  pdf: "📄",
  youtube: "▶",
  text: "✎",
  image: "🖼",
};

export default function FileCard({
  title,
  subtitle,
  type = "pdf",
  visible = true,
  onClick,
}: FileCardProps) {
  return (
    <div
      className={`flex items-center gap-3.5 rounded-xl border border-edu-line bg-white px-4 py-4 ${onClick ? "cursor-pointer transition-colors hover:border-edu-moss hover:bg-edu-paper" : ""}`}
      onClick={onClick}
      style={{ boxShadow: "var(--edu-shadow)" }}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-edu-moss-light text-lg text-edu-moss-dark">
        {typeIcon[type] ?? "📄"}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-bold text-edu-ink">{title}</div>
        <div className="mt-0.5 text-xs text-edu-blue-grey">{subtitle}</div>
      </div>
      {visible && (
        <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-edu-moss-light px-2.5 py-1 text-[11px] font-bold text-edu-moss-dark">
          <span>●</span> Visible to students
        </div>
      )}
    </div>
  );
}
