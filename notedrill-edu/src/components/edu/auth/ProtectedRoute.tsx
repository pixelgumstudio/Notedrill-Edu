"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

interface ProtectedRouteProps {
  /** Which role is required to access the wrapped section. */
  requiredRole: "org_admin" | "student" | "superadmin";
  children: React.ReactNode;
}

const LOGIN_PATHS: Record<ProtectedRouteProps["requiredRole"], string> = {
  org_admin: "/org/login",
  student: "/student/login",
  // No superadmin auth exists on backend.notedrill.com — this section
  // (src/app/(admin)/notedrill/*, an internal B2C panel unrelated to the
  // Edu product) has no login path to send anyone to; kept only so its
  // ProtectedRoute usage still type-checks.
  superadmin: "/org/login",
};

/**
 * Client-side route guard. Because auth tokens live in localStorage they
 * are not available during SSR, so middleware cannot read them. This
 * component waits for AuthContext to hydrate from localStorage, then
 * redirects unauthenticated visitors to the appropriate login page.
 *
 * Render flow:
 *   1. Server/initial render: isHydrated=false → spinner (no layout flash)
 *   2. AuthContext useEffect runs → reads localStorage → isHydrated=true
 *   3. If allowed: render children. If not: router.replace(loginPath).
 */
export default function ProtectedRoute({ requiredRole, children }: ProtectedRouteProps) {
  const { isHydrated, isOrgAdmin, isStudent } = useAuth();
  const router = useRouter();

  // No superadmin role exists in this backend's auth model — always denied.
  const allowed =
    requiredRole === "org_admin" ? isOrgAdmin : requiredRole === "student" ? isStudent : false;

  useEffect(() => {
    if (!isHydrated) return;
    if (!allowed) {
      router.replace(LOGIN_PATHS[requiredRole]);
    }
  }, [isHydrated, allowed, requiredRole, router]);

  // Wait for localStorage hydration before making any routing decision
  if (!isHydrated) {
    return (
      <div
        data-theme="edu"
        className="flex min-h-screen items-center justify-center bg-edu-paper"
      >
        <div className="h-7 w-7 animate-spin rounded-full border-[2.5px] border-edu-moss border-t-transparent" />
      </div>
    );
  }

  // Redirect is in flight — render nothing to prevent layout flash
  if (!allowed) return null;

  return <>{children}</>;
}
