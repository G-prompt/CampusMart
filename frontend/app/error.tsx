"use client";

import { useEffect } from "react";
import Link from "next/link";

interface ErrorProps { error: Error; reset: () => void; }

export default function ErrorPage({ error, reset }: ErrorProps) {
	useEffect(() => { console.error(error); }, [error]);
	return <div className="main-container py-20"><div className="site-card p-10 text-center"><p className="text-sm font-semibold uppercase tracking-[0.25em] text-brand-800">Something went wrong</p><h1 className="mt-6 text-3xl font-semibold text-slate-950">We hit an unexpected issue.</h1><p className="mt-4 text-sm leading-7 text-slate-600">The page did not load correctly. Try again or return to the marketplace.</p><div className="mt-8 flex flex-wrap justify-center gap-3"><button type="button" onClick={reset} className="rounded-[10px] bg-accent-400 px-5 py-3 text-sm font-bold text-black transition hover:bg-accent-500">Try again</button><Link href="/marketplace" className="rounded-[10px] border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50">Marketplace</Link></div></div></div>;
}