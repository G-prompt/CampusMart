"use client";

import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";

interface ErrorProps {
  error: Error;
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="main-container flex min-h-[65vh] items-center justify-center py-16">
      <section className="site-card w-full max-w-xl p-8 text-center sm:p-12">
        <Image
          src="/campusmart-logo.jpg"
          alt="CampusMart"
          width={72}
          height={72}
          className="mx-auto h-16 w-16 rounded-2xl object-contain"
        />

        <p className="mt-6 text-xs font-black uppercase tracking-[0.2em] text-[#8A3D48]">
          Something went wrong
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950">
          This page didn’t load
        </h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-600">
          A temporary issue interrupted this page. Try again, or head back to
          the marketplace.
        </p>

        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-accent-400 px-5 text-sm font-black text-black transition hover:bg-accent-500"
          >
            Try again
          </button>
          <Link
            href="/marketplace"
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-800 transition hover:border-slate-400"
          >
            Browse marketplace
          </Link>
        </div>
      </section>
    </main>
  );
}