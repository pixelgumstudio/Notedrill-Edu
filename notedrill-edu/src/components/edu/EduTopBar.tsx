"use client";

import React from "react";
import BrandMark from "./BrandMark";
import AvatarInitials from "./AvatarInitials";
import { useAuth } from "@/context/AuthContext";

interface EduTopBarProps {
  /** Explicit display name override. Falls back to the signed-in user's stored name. */
  userName?: string;
  orgName?: string;
  children?: React.ReactNode;
}

export default function EduTopBar({ userName, orgName, children }: EduTopBarProps) {
  const { name, email } = useAuth();

  // Preference order: explicit prop → stored name → stored email → "Admin"
  const displayName = userName || name || email || "Admin";

  return (
    <header
      className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-edu-line bg-white/90 backdrop-blur-sm px-4 md:px-6"
      style={{ boxShadow: "var(--edu-shadow)" }}
    >
      <BrandMark size="sm" variant="full" />

      <div className="flex items-center gap-3">
        {children}
        {orgName && (
          <span className="hidden md:block text-xs text-edu-blue-grey border border-edu-line rounded-full px-3 py-1">
            {orgName}
          </span>
        )}
        <AvatarInitials name={displayName} size="sm" />
      </div>
    </header>
  );
}
