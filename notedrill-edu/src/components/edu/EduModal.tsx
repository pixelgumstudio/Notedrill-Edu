"use client";

import React, { useEffect, useRef } from "react";

interface EduModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  maxWidth?: string;
}

export default function EduModal({
  open,
  onClose,
  title,
  description,
  children,
  maxWidth = "max-w-[460px]",
}: EduModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-edu-moss-dark/45 p-5"
      onClick={(e) => e.target === overlayRef.current && onClose()}
    >
      <div
        className={`w-full ${maxWidth} rounded-[var(--edu-radius)] bg-white p-7 md:p-8`}
        style={{ boxShadow: "0 10px 40px rgba(0,0,0,0.25)" }}
      >
        <h3 className="mb-2 font-source-serif text-lg text-edu-ink">{title}</h3>
        {description && (
          <p className="mb-5 text-sm leading-relaxed text-edu-blue-grey">{description}</p>
        )}
        {children}
      </div>
    </div>
  );
}
