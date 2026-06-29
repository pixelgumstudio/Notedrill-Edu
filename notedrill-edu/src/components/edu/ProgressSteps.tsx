import React from "react";

export interface Step {
  label: string;
  status: "done" | "current" | "pending";
}

interface ProgressStepsProps {
  steps: Step[];
}

export default function ProgressSteps({ steps }: ProgressStepsProps) {
  return (
    <div className="my-7 flex items-center">
      {steps.map((step, i) => (
        <React.Fragment key={step.label}>
          <div className="flex items-center gap-2.5">
            <div
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold ${
                step.status === "done"
                  ? "border-edu-moss bg-edu-moss text-white"
                  : step.status === "current"
                  ? "border-edu-moss bg-white text-edu-moss"
                  : "border-edu-line bg-white text-edu-blue-grey"
              }`}
            >
              {step.status === "done" ? "✓" : i + 1}
            </div>
            <span
              className={`hidden text-[12.5px] font-semibold sm:block ${
                step.status === "pending" ? "text-edu-blue-grey" : "text-edu-ink"
              }`}
            >
              {step.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              className={`mx-2 h-0.5 flex-1 ${
                step.status === "done" ? "bg-edu-moss" : "bg-edu-line"
              }`}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}
