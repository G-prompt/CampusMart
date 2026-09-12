"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState, type MouseEvent } from "react";
import type { Product } from "@/lib/products";
import { formatNaira } from "@/lib/products";

export default function ProductCard({ product }: { product: Product }) {
  const [saved, setSaved] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    const savedProducts = JSON.parse(localStorage.getItem("campusmart-saved-products") ?? "[]") as number[];
    setSaved(savedProducts.includes(product.id));
  }, [product.id]);

  const toggleSaved = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const savedProducts = JSON.parse(localStorage.getItem("campusmart-saved-products") ?? "[]") as number[];
    const nextSavedProducts = saved ? savedProducts.filter((id) => id !== product.id) : [...new Set([...savedProducts, product.id])];
    localStorage.setItem("campusmart-saved-products", JSON.stringify(nextSavedProducts));
    setSaved(!saved);
    window.dispatchEvent(new CustomEvent("campusmart-wishlist-change"));
    window.dispatchEvent(new CustomEvent("campusmart-toast", { detail: { message: saved ? "Removed from saved listings" : "Saved to your wishlist" } }));
  };

  return (
    <article className="group overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
      <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
        <Link href={`/marketplace/products/${product.id}`} aria-label={`View ${product.title}`} className="relative block h-full">
          {imageFailed ? (
            <div className="flex h-full items-center justify-center bg-slate-900 p-6 text-center text-sm font-bold text-white">CampusMart listing image</div>
          ) : (
            <Image src={product.images[0]} alt={product.title} fill sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw" onError={() => setImageFailed(true)} className="object-cover transition duration-500 group-hover:scale-105" />
          )}
        </Link>
        <button
          type="button"
          onClick={toggleSaved}
          className="absolute right-3 top-3 inline-flex h-10 w-10 items-center justify-center rounded-[10px] bg-white/90 text-black shadow-sm backdrop-blur transition hover:text-accent-600"
          aria-label={`Save ${product.title} to wishlist`}
          aria-pressed={saved}
          title={saved ? "Remove from wishlist" : "Save to wishlist"}
        >
          <svg viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.2" className="h-5 w-5" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.8 5.8a5.5 5.5 0 0 0-7.8 0L12 6.9l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 22l8.8-8.4a5.5 5.5 0 0 0 0-7.8Z" />
          </svg>
        </button>
      </div>
      <Link href={`/marketplace/products/${product.id}`} className="block p-4">
        <p className="text-sm font-semibold text-slate-500">{product.category}</p>
        <h3 className="mt-2 min-h-12 text-lg font-bold leading-6 text-black">{product.title}</h3>
        <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-500">
          <span className="truncate">{product.seller}</span>
          <span className="shrink-0 font-semibold text-slate-700">★ {product.rating}</span>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 text-[11px] font-semibold text-slate-500">
          <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" /> Campus pickup</span>
          <span className="text-emerald-700">Verified seller</span>
        </div>
        <p className="mt-3 text-xl font-bold text-black">{formatNaira(product.price)}</p>
      </Link>
    </article>
  );
}
