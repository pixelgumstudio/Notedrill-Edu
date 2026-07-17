"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { loginSchema, type LoginInput } from "@notedrill/validation";
import { orgApi } from "@/lib/org-api";
import { useAuth } from "@/context/AuthContext";
import BrandMark from "@/components/edu/BrandMark";
import Toast from "@/components/edu/Toast";
import PasswordInput from "@/components/edu/PasswordInput";

export default function OrgLoginPage() {
  return (
    <Suspense fallback={null}>
      <OrgLoginPageInner />
    </Suspense>
  );
}

function OrgLoginPageInner() {
  const searchParams = useSearchParams();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { loginAsOrg } = useAuth();
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  useEffect(() => {
    if (searchParams.get("expired") === "1") {
      setErrorMsg("Your session expired. Please log in again.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mutation = useMutation({
    mutationFn: orgApi.login,
    onSuccess: (data) => {
      loginAsOrg(data.token, data.user);
      router.push("/edu/dashboard");
    },
    onError: (err: Error) => setErrorMsg(err.message || "Invalid email or password."),
  });

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
          <p className="text-sm text-edu-blue-grey">Enter your admin email and password</p>
        </div>

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
          <Field label="Admin Email" error={errors.email?.message}>
            <input
              {...register("email")}
              type="email"
              placeholder="admin@school.edu.ng"
              className={inputCls(!!errors.email)}
            />
          </Field>

          <Field label="Password" error={errors.password?.message}>
            <PasswordInput
              {...register("password")}
              placeholder="••••••••"
              className={inputCls(!!errors.password)}
            />
          </Field>

          <button
            type="submit"
            disabled={mutation.isPending}
            className="w-full rounded-[var(--edu-radius)] bg-edu-moss px-4 py-2.5 text-sm font-semibold text-white hover:bg-edu-moss-dark disabled:opacity-60 transition-colors"
          >
            {mutation.isPending ? "Signing in…" : "Sign In"}
          </button>
        </form>

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
