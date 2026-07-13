"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { sendOTPSchema, verifyLoginOTPSchema } from "@notedrill/validation";
import type { SendOTPInput, VerifyLoginOTPInput } from "@notedrill/validation";
import { studentApi } from "@/lib/student-api";
import { useAuth } from "@/context/AuthContext";
import type { AuthUser } from "@/types/edu";
import BrandMark from "@/components/edu/BrandMark";
import Toast from "@/components/edu/Toast";

type Step = "request" | "verify";

export default function StudentLoginPage() {
  return (
    <Suspense fallback={null}>
      <StudentLoginPageInner />
    </Suspense>
  );
}

function StudentLoginPageInner() {
  const searchParams = useSearchParams();
  const [step, setStep] = useState<Step>("request");
  const [prefillEmail, setPrefillEmail] = useState("");
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { loginAsStudent } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (searchParams.get("expired") === "1") {
      setErrorMsg("Your session expired. Please log in again.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
            Student Sign In
          </h1>
          <p className="text-sm text-edu-blue-grey">
            {step === "request"
              ? "Enter your email to receive a sign-in code"
              : `Enter the 6-digit code sent to ${prefillEmail}`}
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
          <RequestStep
            onSuccess={(email) => {
              setPrefillEmail(email);
              setSuccessMsg("Code sent! Check your inbox.");
              setErrorMsg(null);
              setStep("verify");
            }}
            onError={(msg) => setErrorMsg(msg)}
          />
        ) : (
          <VerifyStep
            email={prefillEmail}
            onSuccess={(token, user) => {
              loginAsStudent(token, user);
              router.push("/learn/files");
            }}
            onBack={() => setStep("request")}
            onError={(msg) => setErrorMsg(msg)}
          />
        )}

        <p className="mt-4 text-center text-xs text-edu-blue-grey">
          Organisation admin?{" "}
          <a href="/org/login" className="text-edu-moss hover:underline font-medium">
            Sign in here
          </a>
        </p>
      </div>
    </main>
  );
}

function RequestStep({
  onSuccess,
  onError,
}: {
  onSuccess: (email: string) => void;
  onError: (msg: string) => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SendOTPInput>({ resolver: zodResolver(sendOTPSchema) });

  const mutation = useMutation({
    mutationFn: (data: SendOTPInput) => studentApi.requestOtp(data.email),
    onSuccess: (_, vars) => onSuccess(vars.email),
    onError: (err: Error) => onError(err.message || "Failed to send code. Please try again."),
  });

  return (
    <form
      onSubmit={handleSubmit((data) => mutation.mutate(data))}
      className="rounded-[var(--edu-radius)] border border-edu-line bg-white p-6 space-y-4"
      style={{ boxShadow: "var(--edu-shadow)" }}
    >
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-edu-ink">School Email</label>
        <input
          {...register("email")}
          type="email"
          placeholder="you@school.edu.ng"
          className={inputCls(!!errors.email)}
        />
        {errors.email && (
          <p className="text-xs text-edu-red">{errors.email.message}</p>
        )}
      </div>

      <button
        type="submit"
        disabled={mutation.isPending}
        className="w-full rounded-[var(--edu-radius)] bg-edu-moss px-4 py-2.5 text-sm font-semibold text-white hover:bg-edu-moss-dark disabled:opacity-60 transition-colors"
      >
        {mutation.isPending ? "Sending code…" : "Send Sign-In Code"}
      </button>
    </form>
  );
}

function VerifyStep({
  email,
  onSuccess,
  onBack,
  onError,
}: {
  email: string;
  onSuccess: (token: string, user: AuthUser) => void;
  onBack: () => void;
  onError: (msg: string) => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<VerifyLoginOTPInput>({
    resolver: zodResolver(verifyLoginOTPSchema),
    defaultValues: { email },
  });

  const mutation = useMutation({
    mutationFn: (data: VerifyLoginOTPInput) => studentApi.verifyOtp(data.email, data.otp),
    onSuccess: (data) => onSuccess(data.token, data.user),
    onError: (err: Error) => onError(err.message || "Invalid code. Please try again."),
  });

  return (
    <form
      onSubmit={handleSubmit((data) => mutation.mutate(data))}
      className="rounded-[var(--edu-radius)] border border-edu-line bg-white p-6 space-y-4"
      style={{ boxShadow: "var(--edu-shadow)" }}
    >
      <input type="hidden" {...register("email")} />

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-edu-ink">Sign-In Code</label>
        <input
          {...register("otp")}
          placeholder="000000"
          maxLength={6}
          inputMode="numeric"
          autoComplete="one-time-code"
          className={`${inputCls(!!errors.otp)} text-center tracking-widest text-lg font-ibm-plex-mono`}
        />
        {errors.otp && <p className="text-xs text-edu-red">{errors.otp.message}</p>}
      </div>

      <button
        type="submit"
        disabled={mutation.isPending}
        className="w-full rounded-[var(--edu-radius)] bg-edu-moss px-4 py-2.5 text-sm font-semibold text-white hover:bg-edu-moss-dark disabled:opacity-60 transition-colors"
      >
        {mutation.isPending ? "Verifying…" : "Sign In"}
      </button>

      <button
        type="button"
        onClick={onBack}
        className="w-full text-sm text-edu-blue-grey hover:text-edu-ink transition-colors"
      >
        ← Use a different email
      </button>
    </form>
  );
}

function inputCls(hasError: boolean) {
  return `w-full rounded-[var(--edu-radius)] border px-3 py-2 text-sm text-edu-ink bg-white placeholder:text-edu-blue-grey/60 outline-none transition-colors focus:border-edu-moss focus:ring-1 focus:ring-edu-moss/30 ${
    hasError ? "border-edu-red" : "border-edu-line"
  }`;
}
