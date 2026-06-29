import React from "react";

interface AvatarInitialsProps {
  name: string;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

const sizes = {
  xs: "h-6 w-6 text-xs",
  sm: "h-8 w-8 text-sm",
  md: "h-10 w-10 text-base",
  lg: "h-12 w-12 text-lg",
};

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

const palette = [
  "bg-edu-moss text-white",
  "bg-edu-gold text-white",
  "bg-edu-blue-grey text-white",
  "bg-edu-moss-dark text-white",
];

function colorIndex(name: string) {
  return name.charCodeAt(0) % palette.length;
}

export default function AvatarInitials({ name, size = "md", className = "" }: AvatarInitialsProps) {
  return (
    <div
      className={`${sizes[size]} ${palette[colorIndex(name)]} rounded-full flex items-center justify-center font-semibold select-none flex-shrink-0 ${className}`}
      aria-label={name}
      title={name}
    >
      {getInitials(name)}
    </div>
  );
}
