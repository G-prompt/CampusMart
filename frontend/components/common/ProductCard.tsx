"use client";

import Link from "next/link";
import type { Product } from "@/lib/products";
import { formatNaira } from "@/lib/products";

export default function ProductCard({ product }: { product: Product }) {
  return (
    <Link href={`/marketplace/products/${product.id}`} className="group overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
      <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
        <img src={product.images[0]} alt={product.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
        <button
          type="button"
          onClick={(event) => event.preventDefault()}
          className="absolute right-3 top-3 inline-flex h-10 w-10 items-center justify-center rounded-[10px] bg-white/90 text-black shadow-sm backdrop-blur transition hover:text-accent-600"
          aria-label={`Save ${product.title} to wishlist`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="h-5 w-5" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.8 5.8a5.5 5.5 0 0 0-7.8 0L12 6.9l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 22l8.8-8.4a5.5 5.5 0 0 0 0-7.8Z" />
          </svg>
        </button>
      </div>
      <div className="p-4">
        <p className="text-sm font-semibold text-slate-500">{product.category}</p>
        <h3 className="mt-2 min-h-12 text-lg font-bold leading-6 text-black">{product.title}</h3>
        <p className="mt-4 text-xl font-bold text-black">{formatNaira(product.price)}</p>
      </div>
    </Link>
  );
}
