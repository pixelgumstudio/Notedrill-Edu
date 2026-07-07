import React from "react";

interface SectionEyebrowProps {
  children: React.ReactNode;
  className?: string;
}

/** Small-caps, letter-spaced label — the deck's signature device for section headers. */
export default function SectionEyebrow({ children, className = "" }: SectionEyebrowProps) {
  return (
    <p className={`text-[11px] font-bold uppercase tracking-[0.14em] text-edu-gold ${className}`}>
      {children}
    </p>
  );
}
