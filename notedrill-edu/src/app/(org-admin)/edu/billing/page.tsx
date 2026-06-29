"use client";

import React, { useState } from "react";

export default function BillingPage() {
  const [paystackOpen, setPaystackOpen] = useState(false);
  const [manualPayOpen, setManualPayOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2600); };

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
                  <p className="mt-1 font-source-serif text-[22px] text-edu-moss-dark">Trial — 128 students</p>
                </div>
                <div className="rounded-full bg-edu-gold-light px-3 py-1.5 text-xs font-bold text-[#8A5A18]">12 days left</div>
              </div>
              <p className="mb-5 text-[13.5px] leading-relaxed text-edu-blue-grey">
                Your school has full access during the trial. Once you&apos;re ready, complete payment below and our team will activate your annual plan — usually within one business day.
              </p>

              {/* Invoice row */}
              <div className="flex items-center justify-between border-b border-edu-line py-3.5">
                <div>
                  <p className="text-sm font-bold text-edu-ink">Annual school plan</p>
                  <p className="text-xs text-edu-blue-grey">Up to 150 students · billed yearly</p>
                </div>
                <span className="font-source-serif text-base text-edu-ink">₦64,000</span>
              </div>

              <button
                className="mt-5 w-full rounded-lg bg-edu-moss py-2.5 text-sm font-bold text-white hover:bg-edu-moss-dark"
                onClick={() => setPaystackOpen(true)}
              >
                Pay with Paystack
              </button>
              <button
                className="mt-2.5 w-full rounded-lg border-[1.5px] border-edu-line bg-transparent py-2.5 text-sm font-bold text-edu-blue-grey hover:bg-edu-paper-2"
                onClick={() => setManualPayOpen(true)}
              >
                I&apos;ll pay by bank transfer instead
              </button>
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
                For now, payments are confirmed manually by our team — whether you pay via Paystack or bank transfer. Your plan is activated as soon as we verify it, usually within one business day.
              </p>
              <p className="text-[13px] leading-relaxed text-edu-blue-grey">
                Automatic renewal through Paystack is coming soon as we onboard more schools — you&apos;ll be notified before anything changes.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Paystack Modal */}
      {paystackOpen && (
        <Modal title="Pay with Paystack" description="You'll be redirected to Paystack to complete payment securely. Once paid, our team confirms and activates your plan — usually within one business day." onClose={() => setPaystackOpen(false)}>
          <div className="mb-5 flex items-center gap-3 rounded-xl border-[1.5px] border-edu-moss bg-edu-moss-light p-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1B3A6B] text-[11px] font-extrabold text-white">PS</div>
            <div>
              <p className="text-sm font-bold text-edu-ink">Card, bank transfer, or USSD</p>
              <p className="text-xs text-edu-blue-grey">via Paystack checkout</p>
            </div>
          </div>
          <div className="flex gap-2.5">
            <button className="flex-1 rounded-lg border-[1.5px] border-edu-line py-2.5 text-sm font-bold text-edu-blue-grey hover:bg-edu-paper-2" onClick={() => setPaystackOpen(false)}>Cancel</button>
            <button className="flex-1 rounded-lg bg-edu-moss py-2.5 text-sm font-bold text-white hover:bg-edu-moss-dark" onClick={() => { setPaystackOpen(false); showToast("Redirecting to Paystack…"); }}>Continue to Paystack — ₦64,000</button>
          </div>
        </Modal>
      )}

      {/* Manual Pay Modal */}
      {manualPayOpen && (
        <Modal title="Pay by bank transfer" description="Transfer ₦64,000 to the account below, then send your payment reference to our team for confirmation." onClose={() => setManualPayOpen(false)}>
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
