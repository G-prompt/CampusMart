import Link from "next/link";
import { products } from "@/lib/products";
import { ChevronRightIcon } from "@/components/common/icons";
import ProductCard from "@/components/common/ProductCard";

const latestListings = products.slice(0, 4);

export default function HomePage() {
  return (
    <main>
      <section
        className="relative min-h-[480px] overflow-hidden bg-cover bg-center sm:min-h-[560px] lg:min-h-[620px]"
        style={{ backgroundImage: "linear-gradient(90deg, rgba(15,23,42,0.48), rgba(15,23,42,0.24)), url('https://images.unsplash.com/photo-1744320911030-1ab998d994d7?auto=format&fit=crop&fm=jpg&q=85&w=2400')" }}
        aria-label="Campus friends using CampusMart"
      >
        <div className="main-container flex min-h-[480px] items-end pb-14 pt-12 sm:min-h-[560px] sm:items-center sm:pb-12 lg:min-h-[620px]">
          <div className="w-full max-w-md rounded-2xl bg-white p-7 shadow-2xl sm:p-9">
            <h1 className="text-3xl font-bold tracking-tight text-black sm:text-4xl">Buy and sell with students around you.</h1>
            <p className="mt-4 text-base leading-7 text-slate-600">Find everyday essentials, discover campus deals, or give your unused items a new home.</p>
            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              <Link href="/marketplace" className="inline-flex items-center justify-center rounded-[10px] bg-accent-400 px-5 py-3 text-base font-bold text-black transition hover:bg-accent-500">Shop now</Link>
              <Link href="/sell" className="inline-flex items-center justify-center rounded-[10px] bg-slate-100 px-5 py-3 text-base font-bold text-black transition hover:bg-slate-200">Start selling</Link>
            </div>
          </div>
        </div>
        <p className="absolute bottom-3 right-4 rounded bg-black/45 px-2 py-1 text-[11px] text-white backdrop-blur-sm">
          Photo by <a href="https://unsplash.com/@leiadakrozjhen?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText" target="_blank" rel="noreferrer" className="underline">Leiada Krözjhen</a> on <a href="https://unsplash.com/photos/a-group-of-smiling-friends-pose-on-some-steps-rqaAWQgy05U?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText" target="_blank" rel="noreferrer" className="underline">Unsplash</a>
        </p>
      </section>

      <section className="main-container py-14 sm:py-16 lg:py-20">
        <div className="mb-7 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-black">Just In</h2>
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
