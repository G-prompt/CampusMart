"use client";

import { useEffect, useState } from "react";

export default function LoadingPage() {
    const [show, setShow] = useState(true);

    useEffect(() => {
        const timer = window.setTimeout(() => setShow(false), 1800);
        return () => window.clearTimeout(timer);
    }, []);

    if (!show) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(30,58,95,0.2),_transparent_45%),rgba(248,250,252,0.95)] px-4 py-10 backdrop-blur-sm">
            <div className="w-full max-w-md overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-2xl">
                <div className="bg-gradient-to-r from-brand-900 via-brand-700 to-accent-600 p-6 text-white">
                    <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/30 bg-white/10 text-xl font-semibold">C</div>
                        <div>
                            <p className="text-sm uppercase tracking-[0.24em] text-brand-100">CampusMart</p>
                            <p className="text-lg font-semibold">Preparing your marketplace</p>
                        </div>
                    </div>
                    <div className="mt-6 flex items-center gap-2">
                        <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-white [animation-delay:0ms]" />
                        <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-white/80 [animation-delay:120ms]" />
                        <span className="h-2.5 w-2.5 animate-bounce rounded-full bg-white/60 [animation-delay:240ms]" />
                    </div>
                </div>
                <div className="p-6 text-center">
                    <p className="text-lg font-semibold text-slate-950">Loading your marketplace journey...</p>
                    <p className="mt-2 text-sm leading-7 text-slate-600">Connecting student buyers, trusted vendors, and secure wallet flows.</p>
                </div>
            </div>
        </div>
    );
}

