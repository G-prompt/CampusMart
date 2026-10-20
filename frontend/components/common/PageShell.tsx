"use client";

import {
  useRouter,
} from "next/navigation";

interface PageShellProps {
  title: string;

  description: string;

  children?:
    React.ReactNode;

  actions?:
    React.ReactNode;
}

export default function PageShell({
  title,
  description,
  children,
  actions,
}: PageShellProps) {
  const router =
    useRouter();

  const goBack =
    () => {
      if (
        typeof window !==
          "undefined" &&
        window.history.length >
          1
      ) {
        router.back();

        return;
      }

      router.push(
        "/"
      );
    };

  return (
    <main className="main-container py-10 sm:py-12 lg:py-14">
      <section className="section-shell p-6 sm:p-8 lg:p-10">
        <div className="space-y-6">
          <button
            type="button"
            onClick={
              goBack
            }
            className="group inline-flex items-center gap-2 rounded-[10px] border border-slate-200 bg-white/80 px-3.5 py-2 text-sm font-bold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-white hover:text-black"
          >
            <span
              className="transition-transform group-hover:-translate-x-0.5"
              aria-hidden="true"
            >
              ←
            </span>

            <span>
              CampusMart
            </span>
          </button>

          <div className="space-y-3">
            <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
              {
                title
              }
            </h1>

            <p className="max-w-3xl text-[15px] leading-7 text-slate-600">
              {
                description
              }
            </p>
          </div>

          {actions ? (
            <div className="flex flex-wrap gap-3 pt-1">
              {
                actions
              }
            </div>
          ) : null}

          {children ? (
            <div className="mt-8">
              {
                children
              }
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}