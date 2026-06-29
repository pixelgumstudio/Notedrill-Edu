import React from "react";

interface MetricCardProps {
  label: string;
  value: string | number;
  delta?: { value: string; positive?: boolean };
  icon?: React.ReactNode;
  className?: string;
}

export default function MetricCard({ label, value, delta, icon, className = "" }: MetricCardProps) {
  return (
    <div
      className={`rounded-[var(--edu-radius)] bg-white border border-edu-line p-5 flex flex-col gap-3 ${className}`}
      style={{ boxShadow: "var(--edu-shadow)" }}
    >
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-edu-blue-grey">{label}</p>
        {icon && (
          <span className="p-2 rounded-[var(--edu-radius)] bg-edu-moss-light text-edu-moss">
            {icon}
          </span>
        )}
      </div>
      <p className="text-2xl font-semibold text-edu-ink font-source-serif">{value}</p>
      {delta && (
        <p
          className={`text-xs font-medium ${
            delta.positive !== false ? "text-edu-moss" : "text-edu-red"
          }`}
        >
          {delta.positive !== false ? "▲" : "▼"} {delta.value}
        </p>
      )}
    </div>
  );
}
