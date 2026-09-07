"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export default function GlobalLoader() {
    const [phase, setPhase] = useState<"idle" | "running" | "done">("idle");
    const pathname = usePathname();

    useEffect(() => {
        setPhase("running");
        const finish = window.setTimeout(() => setPhase("done"), 220);
        const hide = window.setTimeout(() => setPhase("idle"), 420);
        return () => {
            window.clearTimeout(finish);
            window.clearTimeout(hide);
        };
    }, [pathname]);

    if (phase === "idle") return null;

    return (
        <div className="fixed inset-x-0 top-0 z-[999] h-[3px] overflow-hidden bg-transparent" aria-hidden="true">
            <div
                className="h-full bg-gradient-to-r from-brand-700 via-brand-900 to-accent-500 transition-[width] duration-200 ease-out"
                style={{
                    width: phase === "running" ? "82%" : "100%",
                    opacity: phase === "done" ? 0 : 1,
                    transition: phase === "done" ? "opacity 180ms ease-out" : "width 220ms ease-out",
                }}
            />
        </div>
    );
}
