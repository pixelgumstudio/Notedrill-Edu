import React from "react";

interface SummaryBoxStat {
  label: string;
  value: string | number;
}

interface SummaryBoxProps {
  title: string;
  body: string;
  /** Render `body` as HTML (the AI-generated notes come formatted with headings/lists) instead of plain text. */
  bodyIsHtml?: boolean;
  stats?: SummaryBoxStat[];
  variant?: "student" | "admin";
}

export default function SummaryBox({ title, body, bodyIsHtml = false, stats, variant = "student" }: SummaryBoxProps) {
  const containerClass =
    variant === "student"
      ? "rounded-xl border border-edu-line bg-white p-6 md:p-7"
      : "rounded-xl border border-edu-line bg-edu-paper-2 p-5 md:p-6";

  return (
    <div className={containerClass} style={{ boxShadow: "var(--edu-shadow)" }}>
      <h4 className="mb-2.5 font-source-serif text-[15px] font-semibold text-edu-moss-dark">
        {title}
      </h4>
      {bodyIsHtml ? (
        <div
          className={[
            "prose prose-sm max-w-none",
            "prose-headings:font-source-serif prose-headings:text-edu-moss-dark",
            "prose-p:text-edu-ink prose-p:leading-relaxed",
            "prose-strong:text-edu-ink prose-li:text-edu-ink prose-li:leading-relaxed",
            "prose-h2:text-[15px] prose-h3:text-[13.5px] prose-ul:my-2 prose-ol:my-2",
          ].join(" ")}
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: body }}
        />
      ) : (
        <p className="whitespace-pre-line text-[14.5px] leading-relaxed text-edu-ink">{body}</p>
      )}
      {stats && stats.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-6 border-t border-edu-line pt-4">
          {stats.map((s) => (
            <div key={s.label}>
              <b className="block font-source-serif text-[17px] font-semibold text-edu-moss-dark">
                {s.value}
              </b>
              <span className="text-xs text-edu-blue-grey">{s.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
