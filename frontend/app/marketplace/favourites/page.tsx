"use client";

import {
  useEffect,
  useState,
} from "react";

import Link from "next/link";

import PageShell from "@/components/common/PageShell";
import ProductCard from "@/components/common/ProductCard";
import { useSaved } from "@/components/common/SavedContext";

import type {
  Product,
} from "@/lib/products";

export default function Page() {
  const {
    savedIds,
    savedCount,
    clearSaved,
  } = useSaved();

  const [
    products,
    setProducts,
  ] = useState<Product[]>([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  useEffect(() => {
    let active = true;

    const loadProducts =
      async () => {
        try {
          setLoading(true);
          setError("");

          const apiUrl =
            process.env
              .NEXT_PUBLIC_API_URL ||
            "http://localhost:5000";

          const response =
            await fetch(
              `${apiUrl}/api/products`
            );

          const data =
            await response.json();

          if (
            !response.ok ||
            !data.success
          ) {
            throw new Error(
              data.message ||
                "Unable to load saved listings."
            );
          }

          if (active) {
            setProducts(
              data.products
            );
          }
        } catch (error) {
          console.error(
            "Saved listings error:",
            error
          );

          if (active) {
            setError(
              "Unable to load your saved listings."
            );
          }
        } finally {
          if (active) {
            setLoading(false);
          }
        }
      };

    loadProducts();

    return () => {
      active = false;
    };
  }, []);

  const favourites =
    products.filter(
      (
        product
      ) =>
        savedIds.includes(
          product.id
        )
    );

  return (
    <PageShell
      title="Favourites"
      description="Save your preferred listings for later and revisit them anytime."
    >
      {loading ? (
        <div className="py-16 text-center">
          <p className="text-sm font-semibold text-slate-600">
            Loading your saved
            listings...
          </p>
        </div>
      ) : null}

      {!loading &&
      error ? (
        <div className="site-card flex flex-col items-center px-6 py-16 text-center">
          <h2 className="text-xl font-bold text-slate-950">
            We couldn&apos;t load
            your favourites
          </h2>

          <p className="mt-2 max-w-md text-sm text-slate-600">
            {error}
          </p>

          <Link
            href="/marketplace"
            className="mt-6 rounded-[10px] bg-black px-5 py-3 font-bold text-white transition hover:bg-slate-800"
          >
            Return to marketplace
          </Link>
        </div>
      ) : null}

      {!loading &&
      !error &&
      favourites.length >
        0 ? (
        <>
          <div className="mb-6 flex flex-col gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-600">
              <span className="font-bold text-black">
                {
                  savedCount
                }
              </span>{" "}
              {savedCount === 1
                ? "saved listing"
                : "saved listings"}
            </p>

            <button
              type="button"
              onClick={
                clearSaved
              }
              className="w-fit text-sm font-bold text-slate-500 underline decoration-slate-300 underline-offset-4 transition hover:text-black"
            >
              Clear saved items
            </button>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {favourites.map(
              (
                product
              ) => (
                <ProductCard
                  key={
                    product.id
                  }
                  product={
                    product
                  }
                />
              )
            )}
          </div>
        </>
      ) : null}

      {!loading &&
      !error &&
      favourites.length ===
        0 ? (
        <div className="site-card flex flex-col items-center px-6 py-16 text-center">
          <div
            className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-100 text-accent-700"
            aria-hidden="true"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className="h-7 w-7"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M20.8 5.8a5.5 5.5 0 0 0-7.8 0L12 6.9l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 22l8.8-8.4a5.5 5.5 0 0 0 0-7.8Z"
              />
            </svg>
          </div>

          <h2 className="mt-5 text-2xl font-bold text-slate-950">
            Nothing saved yet
          </h2>

          <p className="mt-2 max-w-md text-slate-600">
            Tap the heart on a
            listing to keep it close
            while you decide.
          </p>

          <Link
            href="/marketplace"
            className="mt-6 rounded-[10px] bg-black px-5 py-3 font-bold text-white transition hover:bg-slate-800"
          >
            Explore listings
          </Link>
        </div>
      ) : null}
    </PageShell>
  );
}