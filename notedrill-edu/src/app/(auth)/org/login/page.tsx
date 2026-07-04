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
  const initialSchoolId = searchParams.get("schoolId") ?? "";

  const [step, setStep] = useState<Step>("request");
  const [prefillEmail, setPrefillEmail] = useState("");
  const [prefillSchoolId, setPrefillSchoolId] = useState("");
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [forgotOpen, setForgotOpen] = useState(false);

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
              ? "Enter your email and School ID to receive a one-time code"
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

        {step === "request" ? (
          <>
            <RequestStep
              initialSchoolId={initialSchoolId}
              onSuccess={(email, schoolId) => {
                setPrefillEmail(email);
                setPrefillSchoolId(schoolId);
                setSuccessMsg("Code sent! Check your email.");
                setErrorMsg(null);
                setStep("verify");
              }}
              onError={(msg) => setErrorMsg(msg)}
            />
            <p className="mt-3 text-center text-xs text-edu-blue-grey">
              <button
                type="button"
                onClick={() => setForgotOpen(true)}
                className="text-edu-moss hover:underline font-medium"
              >
                Forgot your School ID?
              </button>
            </p>
          </>
        ) : (
          <VerifyStep
            email={prefillEmail}
            schoolId={prefillSchoolId}
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

      {forgotOpen && <ForgotSchoolIdModal onClose={() => setForgotOpen(false)} />}
    </main>
  );
}

function ForgotSchoolIdModal({ onClose }: { onClose: () => void }) {
  const [adminEmail, setAdminEmail] = useState("");
  const [sent, setSent] = useState(false);

  const mutation = useMutation({
    mutationFn: () => orgApi.recoverSchoolId(adminEmail),
    // Always shows the same generic confirmation, regardless of whether the
    // email matched anything — matches the backend's privacy-preserving design.
    onSuccess: () => setSent(true),
    onError: () => setSent(true),
  });

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-edu-moss-dark/45 p-5"
      onClick={(e) => e.currentTarget === e.target && onClose()}
    >
      <div className="w-full max-w-[420px] rounded-xl bg-white p-7" style={{ boxShadow: "0 10px 40px rgba(0,0,0,0.25)" }}>
        {sent ? (
          <>
            <h3 className="mb-2 font-source-serif text-lg text-edu-ink">Check your email</h3>
            <p className="mb-5 text-sm leading-relaxed text-edu-blue-grey">
              If an account exists for that email, we&apos;ve sent the School ID(s) to it.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-lg bg-edu-moss py-2.5 text-sm font-bold text-white hover:bg-edu-moss-dark"
            >
              Close
            </button>
          </>
        ) : (
          <>
            <h3 className="mb-2 font-source-serif text-lg text-edu-ink">Forgot your School ID?</h3>
            <p className="mb-5 text-sm leading-relaxed text-edu-blue-grey">
              Enter your admin email and we&apos;ll send your School ID(s) to it.
            </p>
            <div className="mb-5">
              <label className="mb-1.5 block text-[12.5px] font-semibold text-edu-ink">Admin Email</label>
              <input
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="admin@school.edu.ng"
                className="w-full rounded-lg border-[1.5px] border-edu-line bg-edu-paper p-2.5 text-sm focus:border-edu-moss focus:outline-none"
              />
            </div>
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-lg border-[1.5px] border-edu-line py-2.5 text-sm font-bold text-edu-blue-grey hover:bg-edu-paper-2"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!adminEmail || mutation.isPending}
                onClick={() => mutation.mutate()}
                className="flex-1 rounded-lg bg-edu-moss py-2.5 text-sm font-bold text-white hover:bg-edu-moss-dark disabled:opacity-60"
              >
                {mutation.isPending ? "Sending…" : "Send"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function RequestStep({
  initialSchoolId,
  onSuccess,
  onError,
}: {
  initialSchoolId?: string;
  onSuccess: (email: string, schoolId: string) => void;
  onError: (msg: string) => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<OrgOtpRequestInput>({
    resolver: zodResolver(orgOtpRequestSchema),
    defaultValues: { schoolId: initialSchoolId ?? "" },
  });

  const mutation = useMutation({
    mutationFn: orgApi.requestOtp,
    onSuccess: (_, vars) => onSuccess(vars.email, vars.schoolId),
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

      <Field label="School ID" error={errors.schoolId?.message}>
        <input
          {...register("schoolId")}
          placeholder="e.g. GREENWOOD-8392"
          className={inputCls(!!errors.schoolId)}
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
  schoolId,
  onSuccess,
  onBack,
  onError,
}: {
  email: string;
  schoolId: string;
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
    defaultValues: { email, schoolId },
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
      <input type="hidden" {...register("schoolId")} />

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
