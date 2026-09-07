"use client";

import { useState } from "react";
import { products, categories } from "@/lib/products";
import ProductCard from "@/components/common/ProductCard";

export default function Page() {
    const [activeCategory, setActiveCategory] = useState("All");

    const filtered = activeCategory === "All" ? products : products.filter((product) => product.category === activeCategory);

    return (
        <main className="main-container py-10 sm:py-12 lg:py-14">
            <div className="flex flex-wrap gap-2.5">
                {categories.map((category) => (
                    <button
                        key={category}
                        type="button"
                        onClick={() => setActiveCategory(category)}
                        className={`rounded-[10px] px-4 py-2 text-sm font-bold transition ${
                            activeCategory === category ? "bg-black text-white" : "bg-slate-100 text-black hover:bg-slate-200"
                        }`}
                    >
                        {category}
                    </button>
                ))}
            </div>

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
