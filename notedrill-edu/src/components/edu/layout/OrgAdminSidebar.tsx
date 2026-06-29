"use client";

import React from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useSidebar } from "@/context/SidebarContext";
import { useAuth } from "@/context/AuthContext";

interface OrgAdminSidebarProps {
  orgName?: string;
  planLabel?: string;
  planStatus?: "trial" | "active" | "overdue";
}

const navLinks = [
  { href: "/edu/dashboard", label: "Dashboard", icon: "⊞" },
  { href: "/edu/students", label: "Students", icon: "≡" },
  { href: "/edu/upload", label: "Files & Content", icon: "⇪" },
  { href: "/edu/billing", label: "Billing", icon: "$" },
];

export default function OrgAdminSidebar({
  orgName = "Your School",
  planLabel = "Trial · 12 days left",
  planStatus = "trial",
}: OrgAdminSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { isMobileOpen, toggleMobileSidebar } = useSidebar();
  const { logout } = useAuth();

  const handleSignOut = () => {
    logout();
    router.push("/org/login");
  };

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  const planPillClass =
    planStatus === "active"
      ? "bg-edu-moss/20 text-green-300"
      : planStatus === "overdue"
      ? "bg-edu-red/20 text-red-300"
      : "bg-edu-gold/20 text-edu-gold-light";

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

      <aside
        className={`
          fixed top-0 left-0 z-50 flex h-full w-[232px] flex-col bg-edu-moss-dark text-edu-paper
          transition-transform duration-300 ease-in-out
          ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
          md:relative md:translate-x-0 md:flex md:h-screen md:sticky md:top-0
        `}
      >
        {/* Org header */}
        <div className="border-b border-white/10 px-5 py-5">
          <p className="font-source-serif text-[17px] font-semibold leading-tight text-white">
            {orgName}
          </p>
          <div
            className={`mt-2.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ${planPillClass}`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {planLabel}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-3.5">
          {navLinks.map(({ href, label, icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => isMobileOpen && toggleMobileSidebar()}
              className={`
                mb-0.5 flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13.5px] font-semibold transition-colors
                ${
                  isActive(href)
                    ? "bg-white/12 text-white"
                    : "text-[#C7D6CF] hover:bg-white/6 hover:text-white"
                }
              `}
            >
              <span className="w-5 shrink-0 text-center opacity-85 font-mono">{icon}</span>
              {label}
            </Link>
          ))}
        </nav>

        {/* Sign out */}
        <button
          onClick={handleSignOut}
          className="border-t border-white/10 px-5 py-4 text-left text-[13px] text-[#9FB3AA] transition-colors hover:text-white w-full"
        >
          ↩ Sign out
        </button>
      </aside>
    </>
  );
}
