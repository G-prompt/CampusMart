"use client";

import PageShell from "@/components/common/PageShell";
import { useAuth } from "@/components/common/AuthContext";

const benefits = [
    "Verified student identity for trusted selling",
    "Easy listing flow for books, gadgets, fashion and services",
    "Protected wallet payouts and fast settlement",
];

export default function Page() {
    const { openAuth } = useAuth();

    return (
        <PageShell title="Sell on CampusMart" description="Start your student vendor journey with a verified campus marketplace account.">
            <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="site-card p-6">
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-700">Why sell here</p>
                    <h2 className="mt-3 text-2xl font-semibold text-slate-950">Reach buyers who already trust campus commerce</h2>
                    <ul className="mt-5 space-y-3 text-sm leading-7 text-slate-600">
                        {benefits.map((benefit) => (
                            <li key={benefit} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">{benefit}</li>
                        ))}
                    </ul>
                </div>
                <div className="site-card p-6">
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-700">Start now</p>
                    <button type="button" onClick={() => openAuth("register", "vendor")} className="mt-4 inline-flex w-full items-center justify-center rounded-[10px] bg-accent-400 px-5 py-3 text-sm font-bold text-black transition hover:bg-accent-500">Create vendor account</button>
                    <p className="mt-4 text-sm leading-7 text-slate-600">Sign up in seconds, then complete your student verification from your vendor dashboard.</p>
                </div>
            </div>
        </PageShell>
    );
}
