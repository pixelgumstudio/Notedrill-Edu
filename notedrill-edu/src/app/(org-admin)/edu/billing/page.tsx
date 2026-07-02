"use client";

import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { orgApi } from "@/lib/org-api";
import { useAuth } from "@/context/AuthContext";
import type { OrgDashboardMetrics } from "@/types/edu";

const STATUS_PILL: Record<
  OrgDashboardMetrics["subscriptionStatus"],
  { className: string }
> = {
  trialing: { className: "bg-edu-gold-light text-[#8A5A18]" },
  active: { className: "bg-edu-moss-light text-edu-moss-dark" },
  past_due: { className: "bg-edu-red-light text-edu-red" },
  canceled: { className: "bg-edu-paper-2 text-edu-blue-grey" },
  unpaid: { className: "bg-edu-red-light text-edu-red" },
};

export default function BillingPage() {
  const [manualPayOpen, setManualPayOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const { orgToken } = useAuth();

  const { data: metrics, isLoading } = useQuery<OrgDashboardMetrics>({
    queryKey: ["org-dashboard"],
    queryFn: () => orgApi.getDashboardMetrics(orgToken ?? ""),
    enabled: !!orgToken,
    staleTime: 30_000,
  });

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2600); };

  const checkoutMutation = useMutation({
    mutationFn: () => orgApi.createBillingCheckout(orgToken ?? ""),
    onSuccess: (data) => {
      window.location.href = data.checkoutUrl;
    },
    onError: (err: Error) => showToast(err.message || "Could not start checkout — please try again"),
  });

  const needsPayment = !isLoading && metrics ? metrics.billingAmount !== "₦0" : false;
  const pill = metrics ? STATUS_PILL[metrics.subscriptionStatus] : STATUS_PILL.trialing;
  const pillLabel =
    metrics?.subscriptionStatus === "trialing" && metrics.trialDaysLeft != null
      ? `${metrics.trialDaysLeft} day${metrics.trialDaysLeft === 1 ? "" : "s"} left`
      : metrics?.billingStatus ?? "";

  return (
    <>
      {/* Page top bar */}
      <div className="border-b border-edu-line bg-white px-6 py-5 md:px-8">
        <h1 className="font-source-serif text-[22px] text-edu-moss-dark">Billing</h1>
        <p className="mt-0.5 text-sm text-edu-blue-grey">Manage your plan and payment</p>
      </div>

      <div className="px-6 py-6 md:px-8">
        {/* 2-col billing grid on desktop, 1-col on mobile */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.3fr_1fr]">
          {/* Left column */}
          <div>
            {/* Plan panel */}
            <div className="mb-5 rounded-xl border border-edu-line bg-white p-5 md:p-6" style={{ boxShadow: "var(--edu-shadow)" }}>
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <p className="text-[12px] font-bold uppercase tracking-wider text-edu-blue-grey">Current plan</p>
                  <p className="mt-1 font-source-serif text-[22px] text-edu-moss-dark">
                    {isLoading ? "Loading…" : `${metrics?.billingStatus} — ${metrics?.studentCount} student${metrics?.studentCount === 1 ? "" : "s"}`}
                  </p>
                </div>
                {!isLoading && pillLabel && (
                  <div className={`rounded-full px-3 py-1.5 text-xs font-bold ${pill.className}`}>{pillLabel}</div>
                )}
              </div>
              <p className="mb-5 text-[13.5px] leading-relaxed text-edu-blue-grey">
                {needsPayment
                  ? "Complete payment below to activate your plan — you'll be redirected to a secure checkout and your plan updates automatically once payment is confirmed."
                  : "Your school is on the free tier. Invite more students to see upgrade pricing here."}
              </p>

              {needsPayment && (
                <div className="flex items-center justify-between border-b border-edu-line py-3.5">
                  <div>
                    <p className="text-sm font-bold text-edu-ink">Annual school plan</p>
                    <p className="text-xs text-edu-blue-grey">Up to {metrics?.seatLimit} students · billed yearly</p>
                  </div>
                  <span className="font-source-serif text-base text-edu-ink">{metrics?.billingAmount}</span>
                </div>
              )}

              {needsPayment && (
                <>
                  <button
                    className="mt-5 w-full rounded-lg bg-edu-moss py-2.5 text-sm font-bold text-white hover:bg-edu-moss-dark disabled:opacity-60"
                    disabled={checkoutMutation.isPending}
                    onClick={() => checkoutMutation.mutate()}
                  >
                    {checkoutMutation.isPending ? "Redirecting…" : "Upgrade Subscription"}
                  </button>
                  <button
                    className="mt-2.5 w-full rounded-lg border-[1.5px] border-edu-line bg-transparent py-2.5 text-sm font-bold text-edu-blue-grey hover:bg-edu-paper-2"
                    onClick={() => setManualPayOpen(true)}
                  >
                    I&apos;ll pay by bank transfer instead
                  </button>
                </>
              )}
            </div>

            {/* Payment history */}
            <div className="rounded-xl border border-edu-line bg-white p-5 md:p-6" style={{ boxShadow: "var(--edu-shadow)" }}>
              <h3 className="mb-3.5 font-source-serif text-[15px] text-edu-moss-dark">Payment history</h3>
              <div className="py-8 text-center text-edu-blue-grey">
                <div className="mb-3 text-3xl opacity-60">🧾</div>
                <h4 className="mb-1.5 text-[14.5px] font-semibold text-edu-ink">No payments yet</h4>
                <p className="mx-auto max-w-[280px] text-sm">
                  Once your first payment is confirmed, receipts and history will appear here.
                </p>
              </div>
            </div>
          </div>

          {/* Right column — "How billing works" */}
          <div>
            <div className="rounded-xl border border-edu-line bg-white p-5 md:p-6" style={{ boxShadow: "var(--edu-shadow)" }}>
              <h3 className="mb-3.5 font-source-serif text-[14.5px] text-edu-moss-dark">How billing works</h3>
              <p className="mb-3.5 text-[13px] leading-relaxed text-edu-blue-grey">
                Clicking &quot;Upgrade Subscription&quot; takes you to a secure checkout — Paystack or Polar,
                depending on your school&apos;s country — and your plan activates automatically once payment
                is confirmed.
              </p>
              <p className="text-[13px] leading-relaxed text-edu-blue-grey">
                Prefer to pay by bank transfer? Use the option below and our team will confirm it manually,
                usually within one business day.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Manual Pay Modal */}
      {manualPayOpen && (
        <Modal
          title="Pay by bank transfer"
          description={`Transfer ${metrics?.billingAmount ?? ""} to the account below, then send your payment reference to our team for confirmation.`}
          onClose={() => setManualPayOpen(false)}
        >
          <div className="mb-5 rounded-lg bg-edu-paper-2 p-4 text-[13.5px] leading-relaxed text-edu-ink">
            <b>Account name:</b> Pixelgum Studio Ltd<br />
            <b>Account number:</b> 0123456789<br />
            <b>Bank:</b> Guaranty Trust Bank
          </div>
          <div className="flex gap-2.5">
            <button className="flex-1 rounded-lg border-[1.5px] border-edu-line py-2.5 text-sm font-bold text-edu-blue-grey hover:bg-edu-paper-2" onClick={() => setManualPayOpen(false)}>Close</button>
            <button className="flex-1 rounded-lg bg-edu-moss py-2.5 text-sm font-bold text-white hover:bg-edu-moss-dark" onClick={() => { setManualPayOpen(false); showToast("Thanks — we'll confirm once received"); }}>I&apos;ve made the transfer</button>
          </div>
        </Modal>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-[2000] flex items-center gap-2.5 rounded-xl bg-edu-moss-dark px-5 py-3.5 text-sm font-semibold text-white" style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.25)" }}>
          {toast}
        </div>
      )}
    </>
  );
}

function Modal({ title, description, children, onClose }: { title: string; description?: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-edu-moss-dark/45 p-5" onClick={(e) => e.currentTarget === e.target && onClose()}>
      <div className="w-full max-w-[460px] rounded-xl bg-white p-7" style={{ boxShadow: "0 10px 40px rgba(0,0,0,0.25)" }}>
        <h3 className="mb-2 font-source-serif text-lg text-edu-ink">{title}</h3>
        {description && <p className="mb-5 text-sm leading-relaxed text-edu-blue-grey">{description}</p>}
        {children}
      </div>
    </div>
  );
}
