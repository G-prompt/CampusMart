"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import ProductCard from "@/components/common/ProductCard";
import { products } from "@/lib/products";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");

  useEffect(() => {
    const initialQuery = new URLSearchParams(window.location.search).get("q") ?? "";
    setQuery(initialQuery);
    setSubmittedQuery(initialQuery);
  }, []);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextQuery = query.trim();
    setSubmittedQuery(nextQuery);
    window.history.replaceState(null, "", nextQuery ? `/marketplace/search?q=${encodeURIComponent(nextQuery)}` : "/marketplace/search");
  };

  const matches = submittedQuery
    ? products.filter((product) => `${product.title} ${product.category} ${product.seller}`.toLowerCase().includes(submittedQuery.toLowerCase()))
    : products;

  return (
    <main className="main-container py-10 sm:py-12 lg:py-14">
      <div className="flex items-end justify-between gap-4">
        <div><p className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500">Find your next thing</p><h1 className="mt-2 text-3xl font-bold text-black">Search listings</h1></div>
        <Link href="/marketplace" className="text-sm font-bold text-slate-600 hover:text-black">Browse all</Link>
      </div>
      <form onSubmit={handleSubmit} className="mt-7 flex gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2">
        <label htmlFor="listing-search" className="sr-only">Search listings</label>
        <input id="listing-search" value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 rounded-lg border-0 bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-accent-300" placeholder="Try calculator, books, events..." />
        <button type="submit" className="rounded-lg bg-black px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800">Search</button>
      </form>
      <p className="mt-6 text-sm text-slate-600" aria-live="polite">{submittedQuery ? `${matches.length} result${matches.length === 1 ? "" : "s"} for “${submittedQuery}”` : `${matches.length} fresh listings`}</p>
      {matches.length > 0 ? (
        <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{matches.map((product) => <ProductCard key={product.id} product={product} />)}</div>
      ) : (
        <div className="site-card mt-5 px-6 py-16 text-center"><h2 className="text-2xl font-bold text-black">No close matches yet</h2><p className="mx-auto mt-2 max-w-md text-slate-600">Try a broader search like books, technology, or events.</p><Link href="/marketplace" className="mt-6 inline-flex rounded-lg bg-accent-400 px-5 py-3 font-bold text-black">Explore all listings</Link></div>
      )}
    </main>
  );
}
