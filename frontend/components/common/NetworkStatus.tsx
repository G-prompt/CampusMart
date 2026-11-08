"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

export default function NetworkStatus() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const updateNetworkStatus = () => {
      setOffline(!navigator.onLine);
    };

    updateNetworkStatus();
    window.addEventListener("offline", updateNetworkStatus);
    window.addEventListener("online", updateNetworkStatus);

    return () => {
      window.removeEventListener("offline", updateNetworkStatus);
      window.removeEventListener("online", updateNetworkStatus);
    };
  }, []);

  if (!offline) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-[#08090B]/95 px-5 py-10 backdrop-blur-sm"
      role="alert"
      aria-live="assertive"
    >
      <section className="w-full max-w-md rounded-3xl border border-white/10 bg-[#111317] p-8 text-center shadow-2xl sm:p-10">
        <Image
          src="/campusmart-logo.jpg"
          alt="CampusMart"
          width={72}
          height={72}
          className="mx-auto h-16 w-16 rounded-2xl object-contain"
        />

        <p className="mt-6 text-xs font-black uppercase tracking-[0.2em] text-accent-400">
          You’re offline
        </p>
        <h1 className="mt-3 text-2xl font-black tracking-tight text-white">
          Check your connection
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          CampusMart needs an internet connection to load listings and keep
          your account up to date. Reconnect and we’ll get you back on track.
        </p>

        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-7 inline-flex min-h-11 items-center justify-center rounded-xl bg-accent-400 px-5 text-sm font-black text-black transition hover:bg-accent-500"
        >
          Try again
        </button>
      </section>
    </div>
  );
}
