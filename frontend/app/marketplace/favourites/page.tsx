"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PageShell from "@/components/common/PageShell";
import ProductCard from "@/components/common/ProductCard";
import { products } from "@/lib/products";

export default function Page() {
  const [savedIds, setSavedIds] = useState<number[]>([]);

  useEffect(() => {
    const readSaved = () => setSavedIds(JSON.parse(localStorage.getItem("campusmart-saved-products") ?? "[]") as number[]);
    readSaved();
    window.addEventListener("storage", readSaved);
    window.addEventListener("campusmart-wishlist-change", readSaved);
    return () => {
      window.removeEventListener("storage", readSaved);
      window.removeEventListener("campusmart-wishlist-change", readSaved);
    };
  }, []);

  const favourites = products.filter((product) => savedIds.includes(product.id));

  return (
    <PageShell title="Favourites" description="Save your preferred listings for later and revisit them anytime.">
      {favourites.length > 0 ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {favourites.map((product) => <ProductCard key={product.id} product={product} />)}
        </div>
      ) : (
        <div className="site-card flex flex-col items-center px-6 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-100 text-accent-700" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-7 w-7">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20.8 5.8a5.5 5.5 0 0 0-7.8 0L12 6.9l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 22l8.8-8.4a5.5 5.5 0 0 0 0-7.8Z" />
            </svg>
          </div>
          <h2 className="mt-5 text-2xl font-bold text-slate-950">Nothing saved yet</h2>
          <p className="mt-2 max-w-md text-slate-600">Tap the heart on a listing to keep it close while you decide.</p>
          <Link href="/marketplace" className="mt-6 rounded-[10px] bg-black px-5 py-3 font-bold text-white transition hover:bg-slate-800">Explore listings</Link>
        </div>
      )}
    </PageShell>
  );
}
