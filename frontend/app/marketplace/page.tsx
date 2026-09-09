"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { products, categories } from "@/lib/products";
import ProductCard from "@/components/common/ProductCard";
import { FilterIcon } from "@/components/common/icons";

export default function Page() {
    const router = useRouter();
    const [activeCategory, setActiveCategory] = useState("All");
    const [sortBy, setSortBy] = useState("newest");
    const [maxPrice, setMaxPrice] = useState("all");
    const [filtersOpen, setFiltersOpen] = useState(false);
    const filterCloseRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        const search = new URLSearchParams(window.location.search);
        const requestedCategory = search.get("category") ?? "All";
        setActiveCategory(categories.includes(requestedCategory) ? requestedCategory : "All");
        setSortBy(search.get("sort") ?? "newest");
        setMaxPrice(search.get("maxPrice") ?? "all");
    }, []);

    useEffect(() => {
        if (!filtersOpen) return;
        const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setFiltersOpen(false); };
        document.body.style.overflow = "hidden";
        window.addEventListener("keydown", closeOnEscape);
        filterCloseRef.current?.focus();
        return () => {
            document.body.style.overflow = "";
            window.removeEventListener("keydown", closeOnEscape);
        };
    }, [filtersOpen]);

    const updateFilters = (nextSort: string, nextMaxPrice: string) => {
        const params = new URLSearchParams(window.location.search);
        if (nextSort === "newest") params.delete("sort"); else params.set("sort", nextSort);
        if (nextMaxPrice === "all") params.delete("maxPrice"); else params.set("maxPrice", nextMaxPrice);
        router.replace(`/marketplace${params.toString() ? `?${params.toString()}` : ""}`, { scroll: false });
    };

    const resetFilters = () => {
        setSortBy("newest");
        setMaxPrice("all");
        updateFilters("newest", "all");
    };

    const selectCategory = (category: string) => {
        setActiveCategory(category);
        router.replace(category === "All" ? "/marketplace" : `/marketplace?category=${encodeURIComponent(category)}`, { scroll: false });
    };

    const filtered = (activeCategory === "All" ? products : products.filter((product) => product.category === activeCategory))
        .filter((product) => maxPrice === "all" || product.price <= Number(maxPrice))
        .sort((first, second) => {
            if (sortBy === "price-low") return first.price - second.price;
            if (sortBy === "price-high") return second.price - first.price;
            if (sortBy === "rating") return second.rating - first.rating;
            return second.id - first.id;
        });

    return (
        <main className="main-container py-10 sm:py-12 lg:py-14">
            <div className="flex flex-wrap gap-2.5">
                {categories.map((category) => (
                    <button
                        key={category}
                        type="button"
                        onClick={() => selectCategory(category)}
                        className={`rounded-[10px] px-4 py-2 text-sm font-bold transition ${
                            activeCategory === category ? "bg-black text-white" : "bg-slate-100 text-black hover:bg-slate-200"
                        }`}
                    >
                        {category}
                    </button>
                ))}
            </div>

            <div className="mt-7 flex flex-col gap-3 border-y border-slate-200 py-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-slate-600"><span className="font-bold text-black">{filtered.length}</span> listings to explore</p>
                <button type="button" onClick={() => setFiltersOpen(true)} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-black md:hidden"><FilterIcon /> Filters</button>
                <div className="hidden flex-wrap gap-2 md:flex">
                    <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
                        <span className="text-slate-500">Price</span>
                        <select value={maxPrice} onChange={(event) => { setMaxPrice(event.target.value); updateFilters(sortBy, event.target.value); }} className="bg-transparent font-bold text-black outline-none">
                            <option value="all">Any</option>
                            <option value="10000">Under ₦10k</option>
                            <option value="20000">Under ₦20k</option>
                            <option value="30000">Under ₦30k</option>
                        </select>
                    </label>
                    <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
                        <span className="text-slate-500">Sort</span>
                        <select value={sortBy} onChange={(event) => { setSortBy(event.target.value); updateFilters(event.target.value, maxPrice); }} className="bg-transparent font-bold text-black outline-none">
                            <option value="newest">Newest</option>
                            <option value="rating">Top rated</option>
                            <option value="price-low">Price: low</option>
                            <option value="price-high">Price: high</option>
                        </select>
                    </label>
                </div>
            </div>

            {filtersOpen ? (
                <div className="fixed inset-0 z-[70] md:hidden" role="dialog" aria-modal="true" aria-label="Marketplace filters">
                    <button type="button" onClick={() => setFiltersOpen(false)} className="absolute inset-0 bg-slate-950/35" aria-label="Close filters" />
                    <section className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-white p-5 shadow-2xl animate-[modalIn_0.18s_ease-out]">
                        <div className="flex items-center justify-between"><h2 className="text-lg font-bold text-black">Filter listings</h2><button ref={filterCloseRef} type="button" onClick={() => setFiltersOpen(false)} className="text-sm font-bold text-slate-500">Done</button></div>
                        <div className="mt-5 grid gap-3 sm:grid-cols-2">
                            <label className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-3 text-sm font-semibold text-slate-700"><span>Maximum price</span><select value={maxPrice} onChange={(event) => { setMaxPrice(event.target.value); updateFilters(sortBy, event.target.value); }} className="bg-transparent font-bold text-black outline-none"><option value="all">Any</option><option value="10000">Under ₦10k</option><option value="20000">Under ₦20k</option><option value="30000">Under ₦30k</option></select></label>
                            <label className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-3 text-sm font-semibold text-slate-700"><span>Sort by</span><select value={sortBy} onChange={(event) => { setSortBy(event.target.value); updateFilters(event.target.value, maxPrice); }} className="bg-transparent font-bold text-black outline-none"><option value="newest">Newest</option><option value="rating">Top rated</option><option value="price-low">Price: low</option><option value="price-high">Price: high</option></select></label>
                        </div>
                        <button type="button" onClick={resetFilters} className="mt-4 text-sm font-bold text-slate-500 underline underline-offset-4">Reset filters</button>
                    </section>
                </div>
            ) : null}

            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {filtered.map((product) => (
                    <ProductCard key={product.id} product={product} />
                ))}
            </div>

            {filtered.length === 0 ? (
                <p className="mt-10 text-center text-sm text-slate-600">No listings in this category yet — check back soon.</p>
            ) : null}
        </main>
    );
}
