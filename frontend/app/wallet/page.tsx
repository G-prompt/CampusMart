"use client";

import { useMemo, useState } from "react";
import PageShell from "@/components/common/PageShell";

const walletActivity = [
    { title: "No transactions yet", amount: "₦0.00", status: "Empty state" },
];

export default function Page() {
    const [balance] = useState(0);
    const fee = useMemo(() => (balance >= 50000 ? 100 : balance >= 10000 ? 50 : balance > 0 ? 20 : 0), [balance]);

    return (
        <PageShell title="E-wallet" description="Manage your CampusMart wallet with an empty-state balance, transparent fees, and a clear fintech structure for student transactions.">
            <div className="grid gap-8 lg:grid-cols-[1fr_0.8fr]">
                <div className="site-card p-6">
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-700">Your balance</p>
                    <h2 className="mt-3 text-3xl font-semibold text-slate-950">₦{balance.toLocaleString()}</h2>
                    <p className="mt-3 text-sm leading-7 text-slate-600">Your wallet is currently empty. Add funds through the fintech partner flow below to start protected purchases and vendor payouts.</p>

                    <div className="mt-6 space-y-3">
                        {walletActivity.map((entry) => (
                            <div key={entry.title} className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3">
                                <div>
                                    <p className="font-semibold text-slate-950">{entry.title}</p>
                                    <p className="text-sm text-slate-600">{entry.status}</p>
                                </div>
                                <p className="text-sm font-semibold text-slate-950">{entry.amount}</p>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="site-card p-6">
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-700">Fintech partner</p>
                    <div className="mt-4 rounded-2xl border border-brand-200 bg-brand-50 p-4 text-sm text-slate-700">
                        <p className="font-semibold text-brand-900">Recommended partner: Flutterwave</p>
                        <p className="mt-2 leading-7">Flutterwave is a strong fit for CampusMart because it supports local Nigerian transfers, student-friendly checkout, and secure wallet funding for marketplace activity.</p>
                    </div>
                    <div className="mt-4 space-y-3 text-sm text-slate-600">
                        <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3"><span>Less than ₦10,000</span><span className="font-semibold text-slate-950">₦20</span></div>
                        <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3"><span>₦10,000 or more</span><span className="font-semibold text-slate-950">₦50</span></div>
                        <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3"><span>₦50,000 or more</span><span className="font-semibold text-slate-950">₦100</span></div>
                    </div>
                    <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                        <p className="font-semibold text-slate-950">Current transfer fee</p>
                        <p className="mt-1">₦{fee.toLocaleString()} for this wallet balance tier.</p>
                    </div>
                    <button type="button" className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-brand-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-700">Connect fintech wallet</button>
                </div>
            </div>
        </PageShell>
    );
}
