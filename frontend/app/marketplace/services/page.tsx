"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";

import PageShell from "@/components/common/PageShell";
import ProductCard from "@/components/common/ProductCard";

import {
  isServiceCategory,
  serviceCategories,
  type Product,
} from "@/lib/products";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:5000";

export default function Page() {
  const [products, setProducts] =
    useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] =
    useState("All services");
  const [search, setSearch] =
    useState("");
  const [loading, setLoading] =
    useState(true);
  const [error, setError] =
    useState("");
  const [retry, setRetry] =
    useState(0);

  useEffect(() => {
    const controller = new AbortController();

    const loadServices = async () => {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(
          `${API_URL}/api/products`,
          {
            signal: controller.signal,
            cache: "no-store",
          }
        );
        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(
            data.message || "Unable to load services."
          );
        }

        setProducts(
          Array.isArray(data.products)
            ? data.products.filter(
                (product: Product) =>
                  isServiceCategory(product.category)
              )
            : []
        );
      } catch (loadError) {
        if (
          loadError instanceof DOMException &&
          loadError.name === "AbortError"
        ) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load services."
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    void loadServices();

    return () => controller.abort();
  }, [retry]);

  const visibleServices = useMemo(() => {
    const query = search.trim().toLowerCase();

    return products.filter((product) => {
      const matchesCategory =
        selectedCategory === "All services" ||
        product.category === selectedCategory;
      const matchesSearch =
        !query ||
        `${product.title} ${product.category} ${product.description} ${product.seller}`
          .toLowerCase()
          .includes(query);

      return matchesCategory && matchesSearch;
    });
  }, [products, search, selectedCategory]);

  return (
    <PageShell
      title="Services"
      description="Find campus services offered by local sellers. Contact a provider to confirm availability and arrange a booking."
    >
      <section className="site-card p-4 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <label className="sr-only" htmlFor="service-search">
            Search services
          </label>
          <input
            id="service-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search barbering, tutoring, repairs..."
            className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-slate-500"
          />
          <Link
            href="/vendor/add-listing"
            className="inline-flex min-h-11 items-center justify-center rounded-xl bg-accent-400 px-5 text-sm font-black text-black transition hover:bg-accent-500"
          >
            Offer a service
          </Link>
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {["All services", ...serviceCategories].map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => setSelectedCategory(category)}
              aria-pressed={selectedCategory === category}
              className={`shrink-0 rounded-full border px-3.5 py-2 text-xs font-bold transition ${
                selectedCategory === category
                  ? "border-slate-950 bg-slate-950 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-400"
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </section>

      {error ? (
        <section
          role="alert"
          className="site-card mt-5 border border-red-200 p-6"
        >
          <h2 className="font-black text-slate-950">
            Services are unavailable right now
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">{error}</p>
          <button
            type="button"
            onClick={() => setRetry((current) => current + 1)}
            className="mt-4 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-bold text-white"
          >
            Try again
          </button>
        </section>
      ) : loading ? (
        <div
          aria-label="Loading services"
          className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
        >
          {Array.from({ length: 8 }, (_, index) => (
            <div
              key={index}
              className="aspect-[3/4] animate-pulse rounded-xl bg-slate-200"
            />
          ))}
        </div>
      ) : visibleServices.length > 0 ? (
        <section
          aria-label="Available services"
          className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
        >
          {visibleServices.map((service) => (
            <ProductCard key={service.id} product={service} />
          ))}
        </section>
      ) : (
        <section className="site-card mt-5 p-7 text-center">
          <h2 className="text-lg font-black text-slate-950">
            {products.length === 0
              ? "No services have been listed yet"
              : "No services match your search"}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {products.length === 0
              ? "Check back later, or publish a service if you are a seller."
              : "Try another search or choose a different service category."}
          </p>
          {products.length === 0 ? (
            <Link
              href="/vendor/add-listing"
              className="mt-4 inline-flex rounded-xl bg-accent-400 px-4 py-2.5 text-sm font-black text-black"
            >
              List a service
            </Link>
          ) : null}
        </section>
      )}
    </PageShell>
  );
}
