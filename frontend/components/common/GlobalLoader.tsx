"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

export default function GlobalLoader() {
  const [phase, setPhase] = useState<"running" | "done" | "idle">("running");

  useEffect(() => {
    const finish = window.setTimeout(() => setPhase("done"), 900);
    const hide = window.setTimeout(() => setPhase("idle"), 1_150);

    return () => {
      window.clearTimeout(finish);
      window.clearTimeout(hide);
    };
  }, []);

  if (phase === "idle") return null;

  return (
    <div
      className={`campusmart-loader pointer-events-none fixed inset-0 z-[999] flex items-center justify-center transition-opacity duration-300 ${
        phase === "done" ? "opacity-0" : "opacity-100"
      }`}
      role="status"
      aria-live="polite"
      aria-label="Loading CampusMart"
    >
      <div className="campusmart-loader-content flex flex-col items-center">
        <div className="campusmart-loader-mark relative flex h-24 w-24 items-center justify-center rounded-[28px] border border-white/10 bg-[#111317] p-3 shadow-[0_0_70px_rgba(255,107,0,0.12)]">
          <span className="campusmart-loader-orbit" aria-hidden="true" />
          <Image
            src="/campusmart-logo.jpg"
            alt=""
            width={72}
            height={72}
            priority
            className="relative z-10 h-full w-full rounded-[18px] object-contain"
          />
        </div>

        <p className="mt-5 text-lg font-black tracking-tight text-white">
          Campus<span className="text-accent-400">Mart</span>
        </p>
        <p className="mt-1 text-xs font-medium text-slate-400">
          Your campus marketplace
        </p>

        <div className="campusmart-loader-track mt-6 h-1 w-36 overflow-hidden rounded-full bg-white/10">
          <span className="campusmart-loader-progress block h-full rounded-full bg-accent-400" />
        </div>

        <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
          Finding good deals nearby
        </p>
      </div>
    </div>
  );
}
