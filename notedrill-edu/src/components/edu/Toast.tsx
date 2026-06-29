"use client";

import React, { useEffect } from "react";

type ToastVariant = "success" | "error" | "info" | "warning";

interface ToastProps {
  message: string;
  variant?: ToastVariant;
  duration?: number;
  onClose?: () => void;
}

const variantStyles: Record<ToastVariant, string> = {
  success: "bg-edu-moss-light border-edu-moss text-edu-moss-dark",
  error: "bg-edu-red-light border-edu-red text-edu-red",
  info: "bg-white border-edu-line text-edu-ink",
  warning: "bg-edu-gold-light border-edu-gold text-edu-ink",
};

const variantIcons: Record<ToastVariant, string> = {
  success: "✓",
  error: "✕",
  info: "ℹ",
  warning: "⚠",
};

export default function Toast({
  message,
  variant = "info",
  duration = 4000,
  onClose,
}: ToastProps) {
  useEffect(() => {
    if (!duration || !onClose) return;
    const id = setTimeout(onClose, duration);
    return () => clearTimeout(id);
  }, [duration, onClose]);

  return (
    <div
      role="alert"
      className={`flex items-start gap-3 rounded-[var(--edu-radius)] border px-4 py-3 text-sm font-medium ${variantStyles[variant]}`}
      style={{ boxShadow: "var(--edu-shadow)" }}
    >
      <span className="flex-shrink-0 font-bold">{variantIcons[variant]}</span>
      <span className="flex-1">{message}</span>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity"
          aria-label="Dismiss"
        >
          ×
        </button>
      )}
    </div>
  );
}
