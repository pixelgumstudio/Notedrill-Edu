"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { orgRegisterSchema, type OrgRegisterInput } from "@notedrill/validation";
import { orgApi } from "@/lib/org-api";
import BrandMark from "@/components/edu/BrandMark";
import Toast from "@/components/edu/Toast";

const SCHOOL_TYPES = [
  { value: "university", label: "University" },
  { value: "secondary", label: "Secondary School" },
  { value: "primary", label: "Primary School" },
  { value: "tutoring_center", label: "Tutoring Centre" },
  { value: "other", label: "Other" },
] as const;

const EXAM_OPTIONS = ["WAEC", "NECO", "JAMB", "GCE", "ICAN", "ACCA", "SAT", "IELTS", "Other"];

export default function OrgRegisterPage() {
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedExams, setSelectedExams] = useState<string[]>([]);

  const router = useRouter();

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<OrgRegisterInput>({
    resolver: zodResolver(orgRegisterSchema),
    defaultValues: { examFocus: [] },
  });

  const mutation = useMutation({
    mutationFn: orgApi.register,
    onSuccess: (data) => {
      // Show the School ID briefly, then redirect to login so admin can sign in
      setSuccessMsg(`Registration successful! Your School ID is: ${data.schoolId} — save this for signing in. Redirecting…`);
      setErrorMsg(null);
      setTimeout(() => {
        router.push(
          `/org/login?orgId=${encodeURIComponent(data.orgId)}&schoolId=${encodeURIComponent(data.schoolId)}`
        );
      }, 2500);
    },
    onError: (err: Error) => {
      setErrorMsg(err.message || "Registration failed. Please try again.");
    },
  });

  function toggleExam(exam: string) {
    const next = selectedExams.includes(exam)
      ? selectedExams.filter((e) => e !== exam)
      : [...selectedExams, exam];
    setSelectedExams(next);
    setValue("examFocus", next, { shouldValidate: true });
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-lg">
        <div className="mb-6 flex justify-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-edu-blue-grey transition-colors hover:text-edu-moss"
          >
            <span aria-hidden="true">←</span> Back to Home
          </Link>
        </div>

        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <Link href="/">
            <BrandMark size="lg" />
          </Link>
          <h1 className="mt-4 text-2xl font-semibold text-edu-ink font-source-serif">
            Register your Organisation
          </h1>
          <p className="text-sm text-edu-blue-grey">
            Set up a NoteDrill Edu account for your institution
          </p>
        </div>

        {successMsg && (
          <div className="mb-4">
            <Toast message={successMsg} variant="success" onClose={() => setSuccessMsg(null)} />
          </div>
        )}
        {errorMsg && (
          <div className="mb-4">
            <Toast message={errorMsg} variant="error" onClose={() => setErrorMsg(null)} />
          </div>
        )}

        <form
          onSubmit={handleSubmit((data) => mutation.mutate(data))}
          className="rounded-[var(--edu-radius)] border border-edu-line bg-white p-6 space-y-4"
          style={{ boxShadow: "var(--edu-shadow)" }}
        >
          <Field label="Organisation Name" error={errors.name?.message}>
            <input
              {...register("name")}
              placeholder="e.g. Greenfield Academy"
              className={inputCls(!!errors.name)}
            />
          </Field>

          <Field label="School Type" error={errors.schoolType?.message}>
            <select {...register("schoolType")} className={inputCls(!!errors.schoolType)}>
              <option value="">Select type…</option>
              {SCHOOL_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="State" error={errors.state?.message}>
              <input
                {...register("state")}
                placeholder="e.g. Lagos"
                className={inputCls(!!errors.state)}
              />
            </Field>
            <Field label="City" error={errors.city?.message}>
              <input
                {...register("city")}
                placeholder="e.g. Ikeja"
                className={inputCls(!!errors.city)}
              />
            </Field>
          </div>

          <Field label="Exam Focus" error={errors.examFocus?.message}>
            <div className="flex flex-wrap gap-2 mt-1">
              {EXAM_OPTIONS.map((exam) => (
                <button
                  key={exam}
                  type="button"
                  onClick={() => toggleExam(exam)}
                  className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
                    selectedExams.includes(exam)
                      ? "bg-edu-moss text-white border-edu-moss"
                      : "bg-white text-edu-blue-grey border-edu-line hover:border-edu-moss hover:text-edu-moss"
                  }`}
                >
                  {exam}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Estimated Students" error={errors.estimatedStudents?.message}>
            <input
              {...register("estimatedStudents", { valueAsNumber: true })}
              type="number"
              min={1}
              placeholder="e.g. 500"
              className={inputCls(!!errors.estimatedStudents)}
            />
          </Field>

          <Field label="Admin Email" error={errors.adminEmail?.message}>
            <input
              {...register("adminEmail")}
              type="email"
              placeholder="admin@school.edu.ng"
              className={inputCls(!!errors.adminEmail)}
            />
          </Field>

          <Field label="Domain (optional)" error={errors.domain?.message}>
            <input
              {...register("domain")}
              placeholder="e.g. school.edu.ng"
              className={inputCls(!!errors.domain)}
            />
          </Field>

          <button
            type="submit"
            disabled={mutation.isPending || mutation.isSuccess}
            className="w-full mt-2 rounded-[var(--edu-radius)] bg-edu-moss px-4 py-2.5 text-sm font-semibold text-white hover:bg-edu-moss-dark disabled:opacity-60 transition-colors"
          >
            {mutation.isPending ? "Registering…" : "Register Organisation"}
          </button>

          <p className="text-center text-xs text-edu-blue-grey">
            Already registered?{" "}
            <a href="/org/login" className="text-edu-moss hover:underline font-medium">
              Sign in
            </a>
          </p>
        </form>
      </div>
    </main>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-edu-ink">{label}</label>
      {children}
      {error && <p className="text-xs text-edu-red">{error}</p>}
    </div>
  );
}

function inputCls(hasError: boolean) {
  return `w-full rounded-[var(--edu-radius)] border px-3 py-2 text-sm text-edu-ink bg-white placeholder:text-edu-blue-grey/60 outline-none transition-colors focus:border-edu-moss focus:ring-1 focus:ring-edu-moss/30 ${
    hasError ? "border-edu-red" : "border-edu-line"
  }`;
}
