"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import type { AuthUser } from "@/types/edu";

// ── JWT payload shape ────────────────────────────────────────────────────────
// backend.notedrill.com issues a single (non-refreshing) token whose payload
// only carries { id, orgId, role, iat, exp } — no name/email — so identity
// for display comes from the `user` object persisted at login time, not the
// token itself.

interface JwtPayload {
  id?: string;
  orgId?: string;
  role?: "owner" | "student";
  exp?: number;
}

function decodeJwt(token: string): JwtPayload {
  try {
    const base64 = token.split(".")[1];
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    return JSON.parse(atob(padded)) as JwtPayload;
  } catch {
    return {};
  }
}

function isExpired(payload: JwtPayload): boolean {
  return !!payload.exp && Date.now() / 1000 > payload.exp;
}

// ── Storage keys ──────────────────────────────────────────────────────────────
// Exported so org-api.ts / student-api.ts can read the same localStorage
// slots when building request headers.

export const ORG_TOKEN_KEY = "edu_token";
export const STUDENT_TOKEN_KEY = "edu_student_token";
export const ORG_USER_KEY = "edu_user";
export const STUDENT_USER_KEY = "edu_student_user";

// ── Cross-module event ───────────────────────────────────────────────────────
// org-api.ts / student-api.ts dispatch this on `window` when a request comes
// back 401 (token invalid or expired) so this context can clear state and
// redirect — there's no refresh-token flow on this backend, so an expired
// token just means "log in again."

export const SESSION_EXPIRED_EVENT = "edu-session-expired";

// ── Context value type ────────────────────────────────────────────────────────

export interface AuthContextValue {
  /** True once localStorage has been read on the client. Guards ProtectedRoute. */
  isHydrated: boolean;
  /** Raw JWT for org admin calls. Null when not logged in as org admin. */
  orgToken: string | null;
  /** Raw JWT for student calls. Null when not logged in as student. */
  studentToken: string | null;
  /** orgId decoded from the active token. */
  orgId: string | null;
  /** userId decoded from the active token. */
  userId: string | null;
  /** Display name from the login response (not present in the JWT itself). */
  name: string | null;
  /** email from the login response. */
  email: string | null;
  /** Role decoded from the active token. */
  role: "owner" | "student" | null;
  isOrgAdmin: boolean;
  isStudent: boolean;
  /** True if either token is present and unexpired. */
  isAuthenticated: boolean;
  /** Call after org admin register/login — stores the JWT + user profile. */
  loginAsOrg: (token: string, user: AuthUser) => void;
  /** Call after student OTP verify — stores the JWT + user profile. */
  loginAsStudent: (token: string, user: AuthUser) => void;
  /** Clears both tokens from state and localStorage. */
  logout: () => void;
}

// ── Context + hook ────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}

function readUser(key: string): AuthUser | null {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isHydrated, setIsHydrated] = useState(false);
  const [orgToken, setOrgToken] = useState<string | null>(null);
  const [studentToken, setStudentToken] = useState<string | null>(null);
  const [orgUser, setOrgUser] = useState<AuthUser | null>(null);
  const [studentUser, setStudentUser] = useState<AuthUser | null>(null);

  // Hydrate from localStorage once on mount (client-only).
  useEffect(() => {
    const storedOrg = localStorage.getItem(ORG_TOKEN_KEY);
    const storedStudent = localStorage.getItem(STUDENT_TOKEN_KEY);

    if (storedOrg) {
      const p = decodeJwt(storedOrg);
      if (!isExpired(p)) {
        setOrgToken(storedOrg);
        setOrgUser(readUser(ORG_USER_KEY));
      } else {
        localStorage.removeItem(ORG_TOKEN_KEY);
        localStorage.removeItem(ORG_USER_KEY);
      }
    }

    if (storedStudent) {
      const p = decodeJwt(storedStudent);
      if (!isExpired(p)) {
        setStudentToken(storedStudent);
        setStudentUser(readUser(STUDENT_USER_KEY));
      } else {
        localStorage.removeItem(STUDENT_TOKEN_KEY);
        localStorage.removeItem(STUDENT_USER_KEY);
      }
    }

    setIsHydrated(true);
  }, []);

  const loginAsOrg = useCallback((token: string, user: AuthUser) => {
    localStorage.setItem(ORG_TOKEN_KEY, token);
    localStorage.setItem(ORG_USER_KEY, JSON.stringify(user));
    setOrgToken(token);
    setOrgUser(user);
  }, []);

  const loginAsStudent = useCallback((token: string, user: AuthUser) => {
    localStorage.setItem(STUDENT_TOKEN_KEY, token);
    localStorage.setItem(STUDENT_USER_KEY, JSON.stringify(user));
    setStudentToken(token);
    setStudentUser(user);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(ORG_TOKEN_KEY);
    localStorage.removeItem(STUDENT_TOKEN_KEY);
    localStorage.removeItem(ORG_USER_KEY);
    localStorage.removeItem(STUDENT_USER_KEY);
    setOrgToken(null);
    setStudentToken(null);
    setOrgUser(null);
    setStudentUser(null);
  }, []);

  // ── React to a 401 from either fetch layer — no refresh is possible on
  // this backend, so any expired/invalid token just signs the user out.
  useEffect(() => {
    function onExpired(e: Event) {
      const { kind } = (e as CustomEvent<{ kind: "org" | "student" }>).detail;
      if (kind === "org") {
        localStorage.removeItem(ORG_TOKEN_KEY);
        localStorage.removeItem(ORG_USER_KEY);
        setOrgToken(null);
        setOrgUser(null);
        router.push("/org/login?expired=1");
      } else {
        localStorage.removeItem(STUDENT_TOKEN_KEY);
        localStorage.removeItem(STUDENT_USER_KEY);
        setStudentToken(null);
        setStudentUser(null);
        router.push("/student/login?expired=1");
      }
    }
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, [router]);

  // isOrgAdmin/isStudent must each be derived from their OWN token — a user
  // can legitimately hold both an org-admin session and a student session in
  // the same browser at once (e.g. a teacher previewing the student view).
  // Deriving both from a single "whichever token wins" payload meant that
  // once an orgToken existed, isStudent was permanently false regardless of
  // a valid studentToken — ProtectedRoute would then bounce a freshly
  // verified student straight back to /student/login.
  const orgPayload: JwtPayload = orgToken ? decodeJwt(orgToken) : {};
  const studentPayload: JwtPayload = studentToken ? decodeJwt(studentToken) : {};
  const isOrgAdmin = orgPayload.role === "owner";
  const isStudent = studentPayload.role === "student";
  const isAuthenticated = !!(orgToken || studentToken);

  // For generic display fields (topbar name/email/etc.) where only one
  // identity can be shown at a time, prefer whichever session matches the
  // current section of the app so a student page never shows the admin's
  // name (or vice versa) when both sessions are active.
  const isStudentSection = pathname?.startsWith("/learn") || pathname?.startsWith("/student");
  const activePayload = isStudentSection && studentToken ? studentPayload : orgToken ? orgPayload : studentPayload;
  const activeUser = isStudentSection && studentToken ? studentUser : orgToken ? orgUser : studentUser;

  const orgId = activePayload.orgId ?? null;
  const userId = activePayload.id ?? null;
  const role = activePayload.role ?? null;
  const name = activeUser?.name ?? null;
  const email = activeUser?.email ?? null;

  return (
    <AuthContext.Provider
      value={{
        isHydrated,
        orgToken,
        studentToken,
        orgId,
        userId,
        name,
        email,
        role,
        isOrgAdmin,
        isStudent,
        isAuthenticated,
        loginAsOrg,
        loginAsStudent,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
