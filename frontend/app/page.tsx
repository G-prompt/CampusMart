import Link from "next/link";
import { products } from "@/lib/products";
import { ChevronRightIcon } from "@/components/common/icons";
import ProductCard from "@/components/common/ProductCard";

const latestListings = products.slice(0, 4);
const browseCategories = [
  { name: "Technology", detail: "Study-ready gear", href: "/marketplace?category=Technology", tone: "bg-[#DCEBFF]" },
  { name: "Books", detail: "Pass it forward", href: "/marketplace?category=Books", tone: "bg-[#F8E7C8]" },
  { name: "Food & Drink", detail: "Good moments nearby", href: "/marketplace?category=Food%20%26%20Drink", tone: "bg-[#DDF2DE]" },
  { name: "Events", detail: "Make plans", href: "/marketplace?category=Events", tone: "bg-[#F4DCE8]" },
];

export default function HomePage() {
  return (
    <main>
      <section
        className="relative min-h-[560px] overflow-hidden bg-cover bg-center sm:min-h-[640px] lg:min-h-[700px]"
        style={{ backgroundImage: "linear-gradient(90deg, rgba(15,23,42,0.86), rgba(15,23,42,0.38)), url('https://images.unsplash.com/photo-1744320911030-1ab998d994d7?auto=format&fit=crop&fm=jpg&q=85&w=2400')" }}
        aria-label="Campus friends using CampusMart"
      >
        <div className="main-container flex min-h-[560px] items-center pb-20 pt-16 sm:min-h-[640px] lg:min-h-[700px]">
          <div className="max-w-2xl text-white">
            <p className="mb-5 text-sm font-bold uppercase tracking-[0.22em] text-accent-300">The campus marketplace</p>
            <h1 className="max-w-xl text-5xl font-bold leading-[0.98] tracking-tight sm:text-6xl lg:text-7xl">Good finds. Close by.</h1>
            <p className="mt-6 max-w-lg text-lg leading-8 text-white/85 sm:text-xl">Buy what you need, sell what you no longer do, and keep more value moving through your campus community.</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link href="/marketplace" className="inline-flex items-center justify-center rounded-[10px] bg-accent-400 px-6 py-3.5 text-base font-bold text-black transition hover:bg-accent-300">Explore the marketplace</Link>
              <Link href="/sell" className="inline-flex items-center justify-center rounded-[10px] border border-white/60 bg-white/10 px-6 py-3.5 text-base font-bold text-white backdrop-blur transition hover:bg-white hover:text-black">List an item</Link>
            </div>
          </div>
        </div>
        <p className="absolute bottom-3 right-4 rounded bg-black/45 px-2 py-1 text-[11px] text-white backdrop-blur-sm">
          Photo by <a href="https://unsplash.com/@leiadakrozjhen?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText" target="_blank" rel="noreferrer" className="underline">Leiada Krözjhen</a> on <a href="https://unsplash.com/photos/a-group-of-smiling-friends-pose-on-some-steps-rqaAWQgy05U?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText" target="_blank" rel="noreferrer" className="underline">Unsplash</a>
        </p>
      </section>

      <section className="border-b border-slate-200 bg-[#F7F5EF]">
        <div className="main-container grid gap-5 py-6 sm:grid-cols-3 sm:py-7">
          <div><p className="text-sm font-bold text-black">Made for campus life</p><p className="mt-1 text-sm text-slate-600">Listings that fit your everyday.</p></div>
          <div><p className="text-sm font-bold text-black">People you can trust</p><p className="mt-1 text-sm text-slate-600">Discover sellers in your community.</p></div>
          <div><p className="text-sm font-bold text-black">Simple, nearby exchanges</p><p className="mt-1 text-sm text-slate-600">Find it. Meet up. Move on.</p></div>
        </div>
      </section>

      <section className="main-container py-14 sm:py-16 lg:py-20">
        <div className="flex items-end justify-between gap-4">
          <div><p className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500">Start somewhere</p><h2 className="mt-2 text-3xl font-bold tracking-tight text-black">Browse by mood</h2></div>
          <Link href="/categories" className="hidden text-sm font-bold text-black transition hover:text-brand-700 sm:inline">All categories</Link>
        </div>
        <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {browseCategories.map((category) => (
            <Link key={category.name} href={category.href} className={`${category.tone} min-h-36 rounded-xl p-5 transition hover:-translate-y-1 hover:shadow-lg`}>
              <span className="text-sm font-semibold text-slate-600">{category.detail}</span>
              <span className="mt-10 block text-xl font-bold text-black">{category.name}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="main-container py-14 sm:py-16 lg:py-20">
        <div className="mb-7 flex items-end justify-between gap-4">
          <div><p className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500">Fresh on the feed</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-black">Just In</h2>
            <p className="mt-2 text-base text-slate-600">Fresh finds, campus experiences, and useful essentials.</p>
          </div>
          <Link href="/marketplace" className="inline-flex shrink-0 items-center gap-1 text-sm font-bold text-black transition hover:text-slate-600 sm:text-base">
            View more <ChevronRightIcon className="h-4 w-4 sm:h-5 sm:w-5" />
          </Link>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {latestListings.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

    </main>
  );
}
