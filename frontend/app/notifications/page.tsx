"use client";

import Link from "next/link";
import PageShell from "@/components/common/PageShell";
import { useAuth } from "@/components/common/AuthContext";

export default function Page() {
  const { user, openAuth } = useAuth();
  if (!user) return <PageShell title="Notifications" description="See new messages, updates, and alerts."><div className="site-card mx-auto max-w-md p-8 text-center"><h2 className="text-2xl font-bold text-slate-950">Sign in to see notifications</h2><button type="button" onClick={() => openAuth("login")} className="mt-6 rounded-[10px] bg-accent-400 px-5 py-3 text-sm font-bold text-black">Sign in</button></div></PageShell>;
  return <PageShell title="Notifications" description="Stay up to date with your account, orders, and marketplace activity."><div className="max-w-3xl space-y-3"><article className="site-card flex items-start gap-4 p-5"><span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-accent-500" /><div><p className="font-bold text-slate-950">Welcome to CampusMart, {user.name}</p><p className="mt-1 text-sm leading-6 text-slate-600">Your {user.role} account is ready. Complete your profile so other campus members know how to connect with you.</p><Link href="/profile" className="mt-3 inline-block text-sm font-bold text-slate-950 underline underline-offset-4">Open profile</Link></div></article><article className="site-card flex items-start gap-4 p-5"><span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-slate-300" /><div><p className="font-bold text-slate-950">CampusMart marketplace is live</p><p className="mt-1 text-sm leading-6 text-slate-600">Browse verified listings, save products you like, and keep conversations and purchases organized.</p><Link href="/marketplace" className="mt-3 inline-block text-sm font-bold text-slate-950 underline underline-offset-4">Browse marketplace</Link></div></article></div></PageShell>;
}
