import React from "react";

type Status = "active" | "pending" | "inactive" | "error";

interface StatusDotProps {
  status: Status;
  label?: string;
  className?: string;
}

const statusStyles: Record<Status, { dot: string; text: string }> = {
  active: { dot: "bg-edu-moss", text: "text-edu-moss" },
  pending: { dot: "bg-edu-gold", text: "text-edu-gold" },
  inactive: { dot: "bg-edu-blue-grey", text: "text-edu-blue-grey" },
  error: { dot: "bg-edu-red", text: "text-edu-red" },
};

const statusLabels: Record<Status, string> = {
  active: "Active",
  pending: "Pending",
  inactive: "Inactive",
  error: "Error",
};

export default function StatusDot({ status, label, className = "" }: StatusDotProps) {
  const styles = statusStyles[status];
  const displayLabel = label ?? statusLabels[status];

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span
        className={`h-2 w-2 rounded-full ${styles.dot} flex-shrink-0`}
        aria-hidden="true"
      />
      <span className={`text-sm font-medium ${styles.text}`}>{displayLabel}</span>
    </span>
  );
}
