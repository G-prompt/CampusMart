"use client";

import Link from "next/link";
import { useAuth } from "./AuthContext";

export default function MarketplaceCta() {
  const { user, openAuth } = useAuth();

  return (
    <section className="border-y border-slate-200 bg-[#111827] text-white">
      <div className="main-container flex flex-col gap-6 py-8 sm:flex-row sm:items-center sm:justify-between sm:py-10">
        <div className="max-w-2xl">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-accent-300">Keep campus moving</p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{user ? `Welcome back, ${user.name}` : "Find your next good thing nearby"}</h2>
          <p className="mt-2 text-sm leading-6 text-white/70">{user ? "Explore fresh listings or manage your account from one place." : "Shop trusted local listings or create your own campus storefront in minutes."}</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href="/marketplace" className="inline-flex items-center justify-center rounded-[10px] bg-accent-400 px-5 py-3 text-sm font-bold text-black transition hover:bg-accent-300">Browse listings</Link>
          {user ? <Link href={user.role === "vendor" ? "/vendor/add-listing" : "/profile"} className="inline-flex items-center justify-center rounded-[10px] border border-white/30 px-5 py-3 text-sm font-bold text-white transition hover:bg-white hover:text-black">{user.role === "vendor" ? "Add a listing" : "Open my account"}</Link> : <button type="button" onClick={() => openAuth("register")} className="inline-flex items-center justify-center rounded-[10px] border border-white/30 px-5 py-3 text-sm font-bold text-white transition hover:bg-white hover:text-black">Join CampusMart</button>}
        </div>
      </div>
    </section>
  );
}
