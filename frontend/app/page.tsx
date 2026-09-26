import Link from "next/link";

import AutoScrollProducts from "@/components/common/AutoScrollProducts";
import { ChevronRightIcon } from "@/components/common/icons";

import type { Product } from "@/lib/products";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:5000";

const browseCategories = [
  {
    name: "Technology",
    detail: "Study-ready gear",
    href: "/marketplace?category=Technology",
    tone: "bg-[#DCEBFF]",
  },
  {
    name: "Books",
    detail: "Pass it forward",
    href: "/marketplace?category=Books",
    tone: "bg-[#F8E7C8]",
  },
  {
    name: "Food & Drink",
    detail: "Good moments nearby",
    href: "/marketplace?category=Food%20%26%20Drink",
    tone: "bg-[#DDF2DE]",
  },
  {
    name: "Events",
    detail: "Make plans",
    href: "/marketplace?category=Events",
    tone: "bg-[#F4DCE8]",
  },
];

async function getLatestListings(): Promise<Product[]> {
  try {
    const response =
      await fetch(
        `${API_URL}/api/products`,
        {
          cache: "no-store",
        }
      );

    if (!response.ok) {
      return [];
    }

    const data =
      await response.json();

    if (
      !data.success ||
      !Array.isArray(
        data.products
      )
    ) {
      return [];
    }

    /*
     * Homepage carousel can now
     * carry up to 30 real products.
     */
    return data.products.slice(
      0,
      30
    );
  } catch (error) {
    console.error(
      "Homepage listings error:",
      error
    );

    return [];
  }
}

export default async function HomePage() {
  const latestListings =
    await getLatestListings();

  return (
    <main className="bg-white">
      <section
        className="relative min-h-[540px] overflow-hidden bg-cover bg-center sm:min-h-[630px] lg:min-h-[700px]"
        style={{
          backgroundImage:
            "linear-gradient(90deg, rgba(15,23,42,0.88) 0%, rgba(15,23,42,0.58) 44%, rgba(15,23,42,0.12) 100%), url('https://images.unsplash.com/photo-1744320911030-1ab998d994d7?auto=format&fit=crop&fm=jpg&q=85&w=2400')",
        }}
        aria-label="Campus friends using CampusMart"
      >
        <div className="main-container flex min-h-[540px] items-center py-14 sm:min-h-[630px] lg:min-h-[700px]">
          <div className="max-w-2xl text-white">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-accent-300">
              The campus marketplace
            </p>

            <h1 className="mt-5 max-w-2xl text-5xl font-bold leading-[0.96] tracking-[-0.045em] sm:text-6xl lg:text-[78px]">
              Good finds.
              <br />
              Close by.
            </h1>

            <p className="mt-6 max-w-xl text-base leading-7 text-white/80 sm:text-xl sm:leading-8">
              Buy what you need,
              sell what you no
              longer do, and keep
              more value moving
              through your campus
              community.
            </p>

            <div className="mt-9">
              <Link
                href="/marketplace"
                className="inline-flex items-center justify-center rounded-[12px] bg-accent-400 px-6 py-3.5 text-base font-bold text-black transition hover:-translate-y-0.5 hover:bg-accent-500"
              >
                Explore the marketplace
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
            Leiada Krözjhen
          </a>{" "}
          on Unsplash
        </p>
      </section>

      <section className="border-b border-slate-200 bg-[#F7F5EF]">
        <div className="main-container grid divide-y divide-slate-200 py-2 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <div className="py-5 sm:px-6 sm:first:pl-0">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
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
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
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
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
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
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
            Start somewhere
          </p>

          <h2 className="mt-3 text-3xl font-bold tracking-tight text-black sm:text-4xl">
            Browse by mood.
          </h2>

          <p className="mt-3 text-base leading-7 text-slate-600">
            Whatever campus life
            throws at you, someone
            nearby might already
            have what you need.
          </p>
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {browseCategories.map(
            (category) => (
              <Link
                key={category.name}
                href={category.href}
                className={`${category.tone} group relative min-h-[155px] rounded-[16px] p-5 transition duration-300 hover:-translate-y-1 hover:shadow-lg`}
              >
                <p className="text-sm font-medium text-slate-600">
                  {category.detail}
                </p>

                <div className="absolute inset-x-5 bottom-5 flex items-end justify-between gap-4">
                  <p className="text-xl font-bold text-black">
                    {category.name}
                  </p>

                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/70 transition group-hover:translate-x-1">
                    <ChevronRightIcon className="h-4 w-4" />
                  </span>
                </div>
              </Link>
            )
          )}
        </div>
      </section>

      <section className="border-t border-slate-100 py-14 sm:py-16">
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

          {latestListings.length >
          0 ? (
            <>
              <AutoScrollProducts
                products={
                  latestListings
                }
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