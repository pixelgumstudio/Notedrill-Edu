import React from "react";

interface BrandMarkProps {
  size?: "sm" | "md" | "lg";
  variant?: "full" | "icon";
  className?: string;
}

const sizes = {
  sm: { icon: "h-6 w-6", text: "text-sm" },
  md: { icon: "h-8 w-8", text: "text-base" },
  lg: { icon: "h-10 w-10", text: "text-lg" },
};

export default function BrandMark({ size = "md", variant = "full", className = "" }: BrandMarkProps) {
  const s = sizes[size];

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div
        className={`${s.icon} rounded-[var(--edu-radius)] bg-edu-moss flex items-center justify-center flex-shrink-0`}
        style={{ boxShadow: "var(--edu-shadow)" }}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="h-[60%] w-[60%] text-white"
          aria-hidden="true"
        >
          <path
            d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      {variant === "full" && (
        <span className={`${s.text} font-semibold text-edu-ink font-source-serif tracking-tight`}>
          NoteDrill<span className="text-edu-moss font-bold"> Edu</span>
        </span>
      )}
    </div>
  );
}
