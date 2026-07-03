"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import {
  orgOtpRequestSchema,
  orgOtpVerifySchema,
  type OrgOtpRequestInput,
  type OrgOtpVerifyInput,
} from "@notedrill/validation";
import { orgApi } from "@/lib/org-api";
import { useAuth } from "@/context/AuthContext";
import BrandMark from "@/components/edu/BrandMark";
import Toast from "@/components/edu/Toast";

type Step = "request" | "verify";

export default function OrgLoginPage() {
  return (
    <Suspense fallback={null}>
      <OrgLoginPageInner />
    </Suspense>
  );
}

function OrgLoginPageInner() {
  const searchParams = useSearchParams();
  // Populated when redirected here right after registration (see org/register/page.tsx).
  // orgId is what actually authenticates — schoolId is just shown as a friendly reference,
  // since OTP login still looks orgs up by their real orgId, not the human-readable schoolId.
  const initialOrgId = searchParams.get("orgId") ?? "";
  const initialSchoolId = searchParams.get("schoolId") ?? "";

  const [step, setStep] = useState<Step>("request");
  const [prefillEmail, setPrefillEmail] = useState("");
  const [prefillOrgId, setPrefillOrgId] = useState("");
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { loginAsOrg } = useAuth();
  const router = useRouter();

  return (
    <main className="flex min-h-screen items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-sm">
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
            Organisation Sign In
          </h1>
          <p className="text-sm text-edu-blue-grey">
            {step === "request"
              ? "Enter your email and org ID to receive a one-time code"
              : "Enter the 6-digit code sent to your email"}
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

        {step === "request" && initialSchoolId && (
          <div className="mb-4 rounded-lg bg-edu-moss-light px-3.5 py-2.5 text-center text-[13px] font-semibold text-edu-moss-dark">
            Signing in for School ID: {initialSchoolId}
          </div>
        )}

        {step === "request" ? (
          <RequestStep
            initialOrgId={initialOrgId}
            onSuccess={(email, orgId) => {
              setPrefillEmail(email);
              setPrefillOrgId(orgId);
              setSuccessMsg("Code sent! Check your email.");
              setErrorMsg(null);
              setStep("verify");
            }}
            onError={(msg) => setErrorMsg(msg)}
          />
        ) : (
          <VerifyStep
            email={prefillEmail}
            orgId={prefillOrgId}
            onSuccess={(token) => {
              loginAsOrg(token);
              router.push("/edu/dashboard");
            }}
            onBack={() => setStep("request")}
            onError={(msg) => setErrorMsg(msg)}
          />
        )}

        <p className="mt-4 text-center text-xs text-edu-blue-grey">
          No account yet?{" "}
          <a href="/org/register" className="text-edu-moss hover:underline font-medium">
            Register your organisation
          </a>
        </p>
      </div>
    </main>
  );
}

function RequestStep({
  initialOrgId,
  onSuccess,
  onError,
}: {
  initialOrgId?: string;
  onSuccess: (email: string, orgId: string) => void;
  onError: (msg: string) => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<OrgOtpRequestInput>({
    resolver: zodResolver(orgOtpRequestSchema),
    defaultValues: { orgId: initialOrgId ?? "" },
  });

  const mutation = useMutation({
    mutationFn: orgApi.requestOtp,
    onSuccess: (_, vars) => onSuccess(vars.email, vars.orgId),
    onError: (err: Error) => onError(err.message || "Failed to send code. Please try again."),
  });

  return (
    <form
      onSubmit={handleSubmit((data) => mutation.mutate(data))}
      className="rounded-[var(--edu-radius)] border border-edu-line bg-white p-6 space-y-4"
      style={{ boxShadow: "var(--edu-shadow)" }}
    >
      <Field label="Admin Email" error={errors.email?.message}>
        <input
          {...register("email")}
          type="email"
          placeholder="admin@school.edu.ng"
          className={inputCls(!!errors.email)}
        />
      </Field>

      <Field label="Organisation ID" error={errors.orgId?.message}>
        <input
          {...register("orgId")}
          placeholder="e.g. org_abc123"
          className={inputCls(!!errors.orgId)}
        />
      </Field>

      <button
        type="submit"
        disabled={mutation.isPending}
        className="w-full rounded-[var(--edu-radius)] bg-edu-moss px-4 py-2.5 text-sm font-semibold text-white hover:bg-edu-moss-dark disabled:opacity-60 transition-colors"
      >
        {mutation.isPending ? "Sending code…" : "Send Code"}
      </button>
    </form>
  );
}

function VerifyStep({
  email,
  orgId,
  onSuccess,
  onBack,
  onError,
}: {
  email: string;
  orgId: string;
  onSuccess: (token: string) => void;
  onBack: () => void;
  onError: (msg: string) => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<OrgOtpVerifyInput>({
    resolver: zodResolver(orgOtpVerifySchema),
    defaultValues: { email, orgId },
  });

  const mutation = useMutation({
    mutationFn: orgApi.verifyOtp,
    onSuccess: (data) => onSuccess(data.tokens.accessToken),
    onError: (err: Error) => onError(err.message || "Invalid code. Please try again."),
  });

  return (
    <form
      onSubmit={handleSubmit((data) => mutation.mutate(data))}
      className="rounded-[var(--edu-radius)] border border-edu-line bg-white p-6 space-y-4"
      style={{ boxShadow: "var(--edu-shadow)" }}
    >
      <input type="hidden" {...register("email")} />
      <input type="hidden" {...register("orgId")} />

      <Field label="One-Time Code" error={errors.otp?.message}>
        <input
          {...register("otp")}
          placeholder="000000"
          maxLength={6}
          inputMode="numeric"
          autoComplete="one-time-code"
          className={`${inputCls(!!errors.otp)} text-center tracking-widest text-lg font-ibm-plex-mono`}
        />
      </Field>

      <button
        type="submit"
        disabled={mutation.isPending}
        className="w-full rounded-[var(--edu-radius)] bg-edu-moss px-4 py-2.5 text-sm font-semibold text-white hover:bg-edu-moss-dark disabled:opacity-60 transition-colors"
      >
        {mutation.isPending ? "Verifying…" : "Verify & Sign In"}
      </button>

      <button
        type="button"
        onClick={onBack}
        className="w-full text-sm text-edu-blue-grey hover:text-edu-ink transition-colors"
      >
        ← Back
      </button>
    </form>
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
