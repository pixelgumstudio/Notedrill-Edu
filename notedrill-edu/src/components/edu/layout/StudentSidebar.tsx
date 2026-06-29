"use client";

import React from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useSidebar } from "@/context/SidebarContext";
import { useAuth } from "@/context/AuthContext";

interface StudentSidebarProps {
  studentName?: string;
  schoolName?: string;
}

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export default function StudentSidebar({
  studentName = "Student",
  schoolName = "Your School",
}: StudentSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { isMobileOpen, toggleMobileSidebar } = useSidebar();
  const { logout } = useAuth();

  const handleSignOut = () => {
    logout();
    router.push("/student/login");
  };

  const isFilesActive = pathname.startsWith("/learn/files");

  return (
    <>
      {/* Mobile backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={toggleMobileSidebar}
          aria-hidden="true"
        />
      )}

      {/* Sidebar — hidden on mobile behind hamburger, visible on md+ */}
      <aside
        className={`
          fixed top-0 left-0 z-50 flex h-full w-[220px] flex-col bg-edu-moss-dark text-edu-paper
          transition-transform duration-300 ease-in-out
          ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
          md:relative md:translate-x-0 md:flex md:h-screen md:sticky md:top-0
        `}
      >
        {/* Student identity */}
        <div className="border-b border-white/10 px-5 py-5">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-edu-gold font-source-serif text-[17px] font-bold text-edu-ink">
            {getInitials(studentName)}
          </div>
          <p className="font-source-serif text-[16px] font-semibold leading-tight text-white">
            {studentName}
          </p>
          <p className="mt-0.5 text-[11.5px] text-[#9FB3AA]">{schoolName}</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-3.5">
          <Link
            href="/learn/files"
            onClick={() => isMobileOpen && toggleMobileSidebar()}
            className={`
              flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13.5px] font-semibold transition-colors
              ${
                isFilesActive
                  ? "bg-white/12 text-white"
                  : "text-[#C7D6CF] hover:bg-white/6 hover:text-white"
              }
            `}
          >
            <span className="w-5 shrink-0 text-center font-mono opacity-85">⊞</span>
            My files
          </Link>
        </nav>

        {/* Sign out */}
        <button
          onClick={handleSignOut}
          className="border-t border-white/10 px-5 py-4 text-left text-[13px] text-[#9FB3AA] transition-colors hover:text-white w-full"
        >
          ↩ Sign out
        </button>
      </aside>

      {/* Mobile bottom nav bar — only visible on small screens */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around border-t border-white/10 bg-edu-moss-dark px-2 py-2 md:hidden">
        <Link
          href="/learn/files"
          className={`flex flex-col items-center gap-0.5 px-4 py-1.5 text-xs font-semibold ${
            isFilesActive ? "text-white" : "text-[#9FB3AA]"
          }`}
        >
          <span className="text-lg leading-none">⊞</span>
          My files
        </Link>
        <button
          onClick={handleSignOut}
          className="flex flex-col items-center gap-0.5 px-4 py-1.5 text-xs font-semibold text-[#9FB3AA]"
        >
          <span className="text-lg leading-none">↩</span>
          Sign out
        </button>
      </nav>
    </>
  );
}
