"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { orgApi } from "@/lib/org-api";
import { useAuth } from "@/context/AuthContext";
import SectionEyebrow from "@/components/edu/SectionEyebrow";
import EmptyState from "@/components/edu/EmptyState";
import type { OrgDashboardStats } from "@/types/edu";

export default function BillingPage() {
  const { orgToken } = useAuth();

  const { data: stats, isLoading } = useQuery<OrgDashboardStats>({
    queryKey: ["org-dashboard-stats"],
    queryFn: () => orgApi.getDashboardStats(orgToken ?? ""),
    enabled: !!orgToken,
    staleTime: 30_000,
  });

  const billing = stats?.billing;

  return (
    <>
      {/* Page top bar */}
      <div className="border-b border-edu-line bg-white px-6 py-5 md:px-8">
        <SectionEyebrow className="mb-1">Getting started</SectionEyebrow>
        <h1 className="font-source-serif text-[22px] text-edu-moss-dark">Billing</h1>
        <p className="mt-0.5 text-sm text-edu-blue-grey">Your plan and seat usage</p>
      </div>

      <div className="px-6 py-6 md:px-8">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.3fr_1fr]">
          {/* Left column */}
          <div>
            <div className="mb-5 rounded-xl border border-edu-line bg-white p-5 md:p-6" style={{ boxShadow: "var(--edu-shadow)" }}>
              <div className="mb-4">
                <p className="text-[12px] font-bold uppercase tracking-wider text-edu-blue-grey">Current plan</p>
                <p className="mt-1 font-source-serif text-[22px] capitalize text-edu-moss-dark">
                  {isLoading ? "Loading…" : billing?.plan ?? "—"}
                </p>
              </div>

              {billing && (
                <div className="flex items-center justify-between border-b border-edu-line py-3.5">
                  <div>
                    <p className="text-sm font-bold text-edu-ink">Seats used</p>
                    <p className="text-xs text-edu-blue-grey">{billing.seatsUsed} of {billing.seatLimit} seats · {billing.seatsRemaining} remaining</p>
                  </div>
                  <span className="font-source-serif text-base text-edu-ink">
                    {billing.amountDue > 0 ? `₦${billing.amountDue.toLocaleString()}` : "₦0"}
                  </span>
                </div>
              )}

              {billing && billing.amountDue > 0 && (
                <p className="mt-4 text-[13.5px] leading-relaxed text-edu-blue-grey">
                  Contact your NoteDrill account manager to complete payment for this billing period.
                </p>
              )}
            </div>

            {/* Payment history */}
            <div className="rounded-xl border border-edu-line bg-white p-5 md:p-6" style={{ boxShadow: "var(--edu-shadow)" }}>
              <h3 className="mb-3.5 font-source-serif text-[15px] text-edu-moss-dark">Payment history</h3>
              <EmptyState
                mark="₦"
                heading="No payments yet"
                body="Once your first payment is confirmed, receipts and history will appear here."
                className="py-8"
              />
            </div>
          </div>

          {/* Right column */}
          <div>
            <div className="rounded-xl border border-edu-line bg-white p-5 md:p-6" style={{ boxShadow: "var(--edu-shadow)" }}>
              <h3 className="mb-3.5 font-source-serif text-[14.5px] text-edu-moss-dark">How billing works</h3>
              <p className="text-[13px] leading-relaxed text-edu-blue-grey">
                Your plan and seat usage are shown here. To upgrade your plan or make a payment,
                reach out to your NoteDrill account manager.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
