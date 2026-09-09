"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export default function GlobalLoader() {
    const [phase, setPhase] = useState<"running" | "done" | "idle">("running");
    const pathname = usePathname();

    useEffect(() => {
        setPhase("running");
        const finish = window.setTimeout(() => setPhase("done"), 520);
        const hide = window.setTimeout(() => setPhase("idle"), 760);
        return () => {
            window.clearTimeout(finish);
            window.clearTimeout(hide);
        };
    }, [pathname]);

    if (phase === "idle") return null;

    return (
        <div className={`pointer-events-none fixed inset-0 z-[999] transition-opacity duration-200 ${phase === "done" ? "opacity-0" : "opacity-100"}`} role="status" aria-live="polite" aria-label="Loading CampusMart">
            <div className="absolute inset-x-0 top-0 h-1 overflow-hidden bg-slate-950/10">
            <div
                className="campusmart-loader-bar absolute left-0 top-0 h-full w-full bg-gradient-to-r from-brand-900 via-accent-400 to-brand-900"
                style={{
                    opacity: phase === "running" ? 1 : 0,
                }}
            />
            </div>
            <div className="absolute left-1/2 top-5 flex -translate-x-1/2 items-center gap-2 rounded-full border border-slate-200 bg-white/95 px-3 py-1.5 text-[11px] font-bold tracking-wide text-slate-700 shadow-sm backdrop-blur-sm">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent-500" aria-hidden="true" />
                CampusMart is loading
            </div>
        </div>
    );
}
