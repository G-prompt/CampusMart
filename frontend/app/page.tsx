
import Link from "next/link";

import AutoScrollProducts from "@/components/common/AutoScrollProducts";
import { ChevronRightIcon } from "@/components/common/icons";

import type { Product } from "@/lib/products";

/*
 * The homepage loads live marketplace
 * listings from the CampusMart backend.
 *
 * Keep this route dynamic during builds.
 */
export const dynamic = "force-dynamic";

/*
 * Server-side fetch requires an absolute URL.
 * /backend-api is intended for browser requests
 * through the Next.js rewrite.
 */
const configuredBackendOrigin =
  process.env.CAMPUSMART_BACKEND_ORIGIN?.trim();

const configuredPublicApi =
  process.env.NEXT_PUBLIC_API_URL?.trim();

const API_URL = (
  configuredBackendOrigin ||
  (configuredPublicApi &&
  /^https?:\/\//i.test(configuredPublicApi)
    ? configuredPublicApi
    : "http://127.0.0.1:5000")
).replace(/\/+$/, "");

const browseCategories = [
  {
    name: "Technology",
    detail: "Study-ready gear",
    href: "/marketplace?category=Technology",
    tone: "bg-[#14161A]",
  },
  {
    name: "Books",
    detail: "Pass it forward",
    href: "/marketplace?category=Books",
    tone: "bg-[#14161A]",
  },
  {
    name: "Food & Drink",
    detail: "Good moments nearby",
    href: "/marketplace?category=Food%20%26%20Drink",
    tone: "bg-[#14161A]",
  },
  {
    name: "Events",
    detail: "Make plans",
    href: "/marketplace?category=Events",
    tone: "bg-[#14161A]",
  },
];

async function getLatestListings(): Promise<Product[]> {
  try {
    const response = await fetch(
      `${API_URL}/api/products`,
      {
        cache: "no-store",
      }
    );

    if (!response.ok) {
      console.error(
        "Homepage listings HTTP error:",
        response.status
      );
      return [];
    }

    const data = await response.json();

    if (
      !data.success ||
      !Array.isArray(data.products)
    ) {
      return [];
    }

    return data.products.slice(0, 30);
  } catch (error) {
    console.error(
      "Homepage listings error:",
      error
    );

    return [];
  }
}

export default async function HomePage() {
  const latestListings = await getLatestListings();

  return (
    <main className="bg-[#08090B]">
      <section
        className="relative min-h-[470px] overflow-hidden bg-cover bg-center sm:min-h-[560px] lg:min-h-[650px]"
        style={{
          backgroundImage:
            "linear-gradient(90deg, rgba(8,9,11,0.94) 0%, rgba(8,9,11,0.68) 52%, rgba(8,9,11,0.18) 100%), url('https://images.unsplash.com/photo-1744320911030-1ab998d994d7?auto=format&fit=crop&fm=jpg&q=85&w=2400')",
        }}
        aria-label="Campus friends using CampusMart"
      >
        <div className="main-container flex min-h-[470px] items-center py-12 sm:min-h-[560px] lg:min-h-[650px]">
          <div className="max-w-2xl text-white">
            <p className="inline-flex rounded-full border border-accent-400/40 bg-accent-400/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-accent-300">
              Student deals · Better prices
            </p>

            <h1 className="mt-5 max-w-2xl text-[42px] font-black leading-[0.98] tracking-[-0.045em] sm:text-6xl lg:text-[76px]">
              Good products.
              <br />
              <span className="text-accent-400">Better prices.</span>
            </h1>

            <p className="mt-5 max-w-xl text-sm leading-6 text-white/75 sm:text-lg sm:leading-8">
              Find student-friendly deals from trusted sellers around your campus. Buy, sell and connect in one place.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                href="/marketplace"
                className="inline-flex items-center justify-center rounded-xl bg-accent-400 px-6 py-3.5 text-sm font-black text-black transition hover:-translate-y-0.5 hover:bg-accent-500"
              >
                Shop deals <ChevronRightIcon className="ml-1 h-4 w-4" />
              </Link>
              <Link href="/sell" className="inline-flex items-center justify-center rounded-xl border border-white/20 bg-black/20 px-5 py-3.5 text-sm font-bold text-white transition hover:bg-white/10">
                Start selling
              </Link>
            </div>
          </div>
        </div>

        <p className="absolute bottom-3 right-4 rounded bg-black/45 px-2 py-1 text-[10px] text-white backdrop-blur-sm">
          Photo by{" "}
          <a
            href="https://unsplash.com/@leiadakrozjhen"
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            Leiada KrÃ¶zjhen
          </a>{" "}
          on Unsplash
        </p>
      </section>

      <section className="border-b border-[#25272B] bg-[#101114]">
        <div className="main-container grid divide-y divide-[#25272B] py-2 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <div className="py-5 sm:px-6 sm:first:pl-0">
            <p className="text-lg font-black text-accent-400">
              01
            </p>

            <h3 className="mt-2 font-bold text-black">
              Made for campus life
            </h3>

            <p className="mt-1 text-sm text-slate-600">
              Find what you need
              without searching far.
            </p>
          </div>

          <div className="py-5 sm:px-6">
            <p className="text-lg font-black text-accent-400">
              02
            </p>

            <h3 className="mt-2 font-bold text-black">
              People you can trust
            </h3>

            <p className="mt-1 text-sm text-slate-600">
              Buy and sell within
              your campus community.
            </p>
          </div>

          <div className="py-5 sm:px-6">
            <p className="text-lg font-black text-accent-400">
              03
            </p>

            <h3 className="mt-2 font-bold text-black">
              Simple exchanges
            </h3>

            <p className="mt-1 text-sm text-slate-600">
              Find it. Meet up.
              Move on.
            </p>
          </div>
        </div>
      </section>

      <section className="main-container py-14 sm:py-16 lg:py-20">
        <div className="max-w-xl">
          <p className="text-xs font-bold uppercase tracking-tight text-slate-500">
            Start somewhere
          </p>

          <h2 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">
            Shop by category
          </h2>

          <p className="mt-3 text-base leading-7 text-slate-600">
            Whatever campus life
            throws at you, someone
            nearby might already
            have what you need.
          </p>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {browseCategories.map((category) => (
            <Link
              key={category.name}
              href={category.href}
              className={`${category.tone} group relative min-h-[130px] overflow-hidden rounded-2xl border border-[#27292E] p-5 transition duration-300 hover:-translate-y-1 hover:border-accent-400/50 hover:shadow-lg`}
            >
              <p className="text-sm font-medium text-slate-600">
                {category.detail}
              </p>

              <div className="absolute inset-x-5 bottom-5 flex items-end justify-between gap-4">
                <p className="text-xl font-black text-white">
                  {category.name}
                </p>

                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/70 transition group-hover:translate-x-1">
                  <ChevronRightIcon className="h-4 w-4" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="border-t border-[#25272B] py-12 sm:py-16">
        <div className="main-container">
          <div className="mb-7 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                Fresh on campus
              </p>

              <h2 className="mt-2 text-3xl font-bold tracking-tight text-black">
                Just In
              </h2>

              <p className="mt-2 text-sm text-slate-600 sm:text-base">
                New finds from
                sellers around campus.
              </p>
            </div>

            <Link
              href="/marketplace"
              className="hidden items-center gap-1 text-sm font-bold text-black transition hover:text-slate-600 sm:inline-flex"
            >
              View all
              <ChevronRightIcon className="h-4 w-4" />
            </Link>
          </div>

          {latestListings.length > 0 ? (
            <>
              <AutoScrollProducts
                products={latestListings}
              />

              <div className="mt-6 flex justify-end sm:hidden">
                <Link
                  href="/marketplace"
                  className="inline-flex items-center gap-1 text-sm font-bold text-black"
                >
                  View all listings
                  <ChevronRightIcon className="h-4 w-4" />
                </Link>
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 px-6 py-10 text-center">
              <p className="font-bold text-black">
                Nothing listed yet.
              </p>

              <p className="mt-2 text-sm text-slate-600">
                New products will
                appear here as
                vendors publish them.
              </p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
