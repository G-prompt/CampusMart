"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PageShell from "@/components/common/PageShell";

type UserProfile = { name: string; role: "vendor" | "client"; email: string };

export default function Page() {
    const [user, setUser] = useState<UserProfile | null>(null);
    const router = useRouter();

    useEffect(() => {
        const storedUser = localStorage.getItem("campusmart-user");
        const isAuth = localStorage.getItem("campusmart-auth");

        if (!storedUser || !isAuth) {
            router.push("/auth/login");
            return;
        }

        setUser(JSON.parse(storedUser));
    }, [router]);

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
