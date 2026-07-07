"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

// ── JWT payload shape (mirrors api/src/utils/jwt.ts TokenPayload) ──────────────

interface JwtPayload {
  userId?: string;
  email?: string;
  username?: string;
  role?: "student" | "org_admin" | "superadmin";
  orgId?: string;
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
// Exported so org-api.ts's fetch layer can read/write the same localStorage
// slots when silently refreshing an expired access token.

export const ORG_TOKEN_KEY = "edu_token";
export const STUDENT_TOKEN_KEY = "edu_student_token";
export const ORG_REFRESH_TOKEN_KEY = "edu_refresh_token";
export const STUDENT_REFRESH_TOKEN_KEY = "edu_student_refresh_token";

// ── Cross-module events ─────────────────────────────────────────────────────
// org-api.ts dispatches these on `window` after a silent token refresh
// succeeds/fails, so this context (which owns the React state) can stay in
// sync without importing React internals into a plain fetch module.

export const TOKEN_REFRESHED_EVENT = "edu-token-refreshed";
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
  /** username decoded from the active token. Used for avatar initials. */
  username: string | null;
  /** email decoded from the active token. */
  email: string | null;
  /** Role decoded from the active token. */
  role: "student" | "org_admin" | "superadmin" | null;
  isOrgAdmin: boolean;
  isStudent: boolean;
  isSuperAdmin: boolean;
  /** True if either token is present and unexpired. */
  isAuthenticated: boolean;
  /** Call after org admin OTP verify — stores the access + refresh JWTs. */
  loginAsOrg: (accessToken: string, refreshToken: string) => void;
  /** Call after student OTP verify — stores the access + refresh JWTs. */
  loginAsStudent: (accessToken: string, refreshToken: string) => void;
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

// ── Provider ──────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [isHydrated, setIsHydrated] = useState(false);
  const [orgToken, setOrgToken] = useState<string | null>(null);
  const [studentToken, setStudentToken] = useState<string | null>(null);

  // Hydrate from localStorage once on mount (client-only).
  // isHydrated becomes true only after this runs so ProtectedRoute waits.
  useEffect(() => {
    const storedOrg = localStorage.getItem(ORG_TOKEN_KEY);
    const storedStudent = localStorage.getItem(STUDENT_TOKEN_KEY);

    if (storedOrg) {
      const p = decodeJwt(storedOrg);
      if (!isExpired(p)) setOrgToken(storedOrg);
      else localStorage.removeItem(ORG_TOKEN_KEY);
    }

    if (storedStudent) {
      const p = decodeJwt(storedStudent);
      if (!isExpired(p)) setStudentToken(storedStudent);
      else localStorage.removeItem(STUDENT_TOKEN_KEY);
    }

    setIsHydrated(true);
  }, []);

  const loginAsOrg = useCallback((accessToken: string, refreshToken: string) => {
    localStorage.setItem(ORG_TOKEN_KEY, accessToken);
    localStorage.setItem(ORG_REFRESH_TOKEN_KEY, refreshToken);
    setOrgToken(accessToken);
  }, []);

  const loginAsStudent = useCallback((accessToken: string, refreshToken: string) => {
    localStorage.setItem(STUDENT_TOKEN_KEY, accessToken);
    localStorage.setItem(STUDENT_REFRESH_TOKEN_KEY, refreshToken);
    setStudentToken(accessToken);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(ORG_TOKEN_KEY);
    localStorage.removeItem(STUDENT_TOKEN_KEY);
    localStorage.removeItem(ORG_REFRESH_TOKEN_KEY);
    localStorage.removeItem(STUDENT_REFRESH_TOKEN_KEY);
    setOrgToken(null);
    setStudentToken(null);
  }, []);

  // ── Stay in sync with silent token refreshes/expirations from org-api.ts ───
  // The fetch layer owns the actual refresh call (and localStorage writes for
  // the new tokens); this just mirrors the result into React state and, on
  // expiry, sends the user back to the right login screen.
  useEffect(() => {
    function onRefreshed(e: Event) {
      const { kind, accessToken } = (e as CustomEvent<{ kind: "org" | "student"; accessToken: string }>).detail;
      if (kind === "org") setOrgToken(accessToken);
      else setStudentToken(accessToken);
    }
    function onExpired(e: Event) {
      const { kind } = (e as CustomEvent<{ kind: "org" | "student" }>).detail;
      if (kind === "org") {
        setOrgToken(null);
        router.push("/org/login?expired=1");
      } else {
        setStudentToken(null);
        router.push("/student/login?expired=1");
      }
    }
    window.addEventListener(TOKEN_REFRESHED_EVENT, onRefreshed);
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => {
      window.removeEventListener(TOKEN_REFRESHED_EVENT, onRefreshed);
      window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
    };
  }, [router]);

  // Derive identity from whichever token is present (org admin takes precedence)
  const activePayload: JwtPayload = orgToken
    ? decodeJwt(orgToken)
    : studentToken
      ? decodeJwt(studentToken)
      : {};

  const orgId = activePayload.orgId ?? null;
  const userId = activePayload.userId ?? null;
  const username = activePayload.username ?? null;
  const email = activePayload.email ?? null;
  const role = activePayload.role ?? null;
  const isOrgAdmin = role === "org_admin";
  const isStudent = role === "student";
  const isSuperAdmin = role === "superadmin";
  const isAuthenticated = !!(orgToken || studentToken);

  return (
    <AuthContext.Provider
      value={{
        isHydrated,
        orgToken,
        studentToken,
        orgId,
        userId,
        username,
        email,
        role,
        isOrgAdmin,
        isStudent,
        isSuperAdmin,
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
