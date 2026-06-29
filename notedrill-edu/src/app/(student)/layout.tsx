"use client";

import { Inter, Source_Serif_4, IBM_Plex_Mono } from "next/font/google";
import { useSidebar } from "@/context/SidebarContext";
import { useAuth } from "@/context/AuthContext";
import StudentSidebar from "@/components/edu/layout/StudentSidebar";
import ProtectedRoute from "@/components/edu/auth/ProtectedRoute";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-source-serif",
  weight: ["400", "600", "700"],
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-ibm-plex-mono",
  weight: ["400", "500"],
  display: "swap",
});

function StudentLayoutInner({ children }: { children: React.ReactNode }) {
  const { toggleMobileSidebar } = useSidebar();
  const { username, email } = useAuth();

  const displayName = username || email || "Student";

  return (
    <div
      data-theme="edu"
      className={`${inter.variable} ${sourceSerif.variable} ${ibmPlexMono.variable} font-inter bg-edu-paper text-edu-ink min-h-screen`}
    >
      {/* Mobile top bar */}
      <div className="flex items-center md:hidden sticky top-0 z-30 bg-edu-moss-dark px-4 py-3 border-b border-white/10">
        <button
          onClick={toggleMobileSidebar}
          className="mr-3 flex h-8 w-8 items-center justify-center rounded-md bg-white/10 text-white"
          aria-label="Toggle navigation"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <span className="font-source-serif text-base font-semibold text-white">NoteDrill</span>
      </div>

      <div className="flex">
        <StudentSidebar studentName={displayName} />
        <main className="min-w-0 flex-1 pb-16 md:pb-0">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute requiredRole="student">
      <StudentLayoutInner>{children}</StudentLayoutInner>
    </ProtectedRoute>
  );
}
