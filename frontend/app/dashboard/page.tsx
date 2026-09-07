"use client";

import PageShell from "@/components/common/PageShell";
import { useAuth } from "@/components/common/AuthContext";

export default function Page() {
    const { user, isAuthenticated, openAuth } = useAuth();

    if (!isAuthenticated) {
        return (
            <PageShell title="Dashboard" description="Sign in to view your personalized CampusMart hub for orders, activity, and growth.">
                <div className="site-card mx-auto max-w-md p-8 text-center">
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-700">Members only</p>
                    <h2 className="mt-3 text-2xl font-semibold text-slate-950">Sign in to continue</h2>
                    <p className="mt-3 text-sm leading-7 text-slate-600">Your dashboard, orders, and wallet are waiting for you.</p>
                    <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
                        <button type="button" onClick={() => openAuth("login")} className="inline-flex items-center justify-center rounded-[10px] bg-accent-400 px-5 py-3 text-sm font-bold text-black transition hover:bg-accent-500">Sign in</button>
                        <button type="button" onClick={() => openAuth("register")} className="inline-flex items-center justify-center rounded-[10px] bg-slate-100 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-200">Create account</button>
                    </div>
                </div>
            </PageShell>
        );
    }

    return (
        <PageShell title="Dashboard" description="Your personalized CampusMart hub for orders, activity, and growth.">
            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="site-card p-6">
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-700">Welcome back</p>
                    <h2 className="mt-3 text-2xl font-semibold text-slate-950">{user?.name ?? "Student user"}</h2>
                    <p className="mt-3 text-sm leading-7 text-slate-600">Your dashboard is ready for shopping, selling, and managing every campus transaction with confidence.</p>
                    <div className="mt-6 grid gap-4 sm:grid-cols-2">
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <p className="text-sm font-semibold text-slate-950">Orders</p>
                            <p className="mt-2 text-2xl font-semibold text-brand-900">4</p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <p className="text-sm font-semibold text-slate-950">Wallet</p>
                            <p className="mt-2 text-2xl font-semibold text-brand-900">₦28.7k</p>
                        </div>
                    </div>
                </div>
                <div className="site-card p-6">
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-700">Quick actions</p>
                    <div className="mt-4 space-y-3">
                        <a href="/marketplace" className="flex items-center justify-between rounded-2xl border border-slate-200 p-4 text-sm font-semibold text-slate-900">Browse marketplace <span>→</span></a>
                        <a href="/wallet" className="flex items-center justify-between rounded-2xl border border-slate-200 p-4 text-sm font-semibold text-slate-900">Open wallet <span>→</span></a>
                        <a href="/checkout" className="flex items-center justify-between rounded-2xl border border-slate-200 p-4 text-sm font-semibold text-slate-900">Checkout <span>→</span></a>
                    </div>
                </div>
            </div>
        </PageShell>
    );
}
