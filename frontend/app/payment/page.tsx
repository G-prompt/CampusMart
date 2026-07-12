"use client";

import { useMemo, useState } from "react";
import PageShell from "@/components/common/PageShell";

type PaymentCard = {
  id: number;
  title: string;
  amount: number;
  status: string;
};

const recentPayments: PaymentCard[] = [
  { id: 1, title: "Book exchange payout", amount: 15000, status: "Completed" },
  { id: 2, title: "Client transfer", amount: 8500, status: "Pending" },
  { id: 3, title: "Service commission", amount: 6200, status: "Completed" },
];

export default function Page() {
  const [selectedTab, setSelectedTab] = useState("wallet");
  const summary = useMemo(() => recentPayments.reduce((total, item) => total + item.amount, 0), []);

  return (
    <PageShell title="Payment" description="Review secure transfers, payout activity, and smart fintech fees for buyers and vendors.">
      <div className="grid gap-8 lg:grid-cols-[1fr_0.8fr]">
        <div className="site-card p-6">
          <div className="flex flex-wrap gap-3">
            {[
              { value: "wallet", label: "Wallet" },
              { value: "payouts", label: "Payouts" },
            ].map((tab) => (
              <button key={tab.value} type="button" onClick={() => setSelectedTab(tab.value)} className={`rounded-full px-4 py-2 text-sm font-semibold transition ${selectedTab === tab.value ? "bg-brand-900 text-white" : "bg-slate-100 text-slate-700"}`}>{tab.label}</button>
            ))}
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-700">Protected balance</p>
            <h2 className="mt-3 text-3xl font-semibold text-slate-950">₦{summary.toLocaleString()}</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">The CampusMart fintech layer keeps transfers secure with lower marketplace fees that are friendly for student vendors and clients.</p>
            <div className="mt-4 rounded-2xl border border-brand-200 bg-brand-50 p-4 text-sm text-slate-700">
              <p className="font-semibold text-brand-900">Banking partner strategy</p>
              <p className="mt-2 leading-7">CampusMart is structured around Flutterwave-style settlement for instant school-friendly payouts and escrow-backed transfers.</p>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {recentPayments.map((payment) => (
              <div key={payment.id} className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3">
                <div>
                  <p className="font-semibold text-slate-950">{payment.title}</p>
                  <p className="text-sm text-slate-600">{payment.status}</p>
                </div>
                <p className="text-sm font-semibold text-slate-950">₦{payment.amount.toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="site-card p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-700">Fees</p>
          <div className="mt-4 space-y-3 text-sm text-slate-600">
            <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3"><span>Below ₦10,000</span><span className="font-semibold text-slate-950">₦20</span></div>
            <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3"><span>₦10,000–₦49,999</span><span className="font-semibold text-slate-950">₦50</span></div>
            <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3"><span>₦50,000+</span><span className="font-semibold text-slate-950">₦100</span></div>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
