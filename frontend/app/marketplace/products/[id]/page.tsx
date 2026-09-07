"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { getProductById, formatNaira } from "@/lib/products";
import { useCart } from "@/components/common/CartContext";
import { ChevronRightIcon } from "@/components/common/icons";

export default function ProductPage({ params }: { params: { id: string } }) {
    const product = useMemo(() => getProductById(Number(params.id)), [params.id]);
    const { addToCart } = useCart();
    const [activeImage, setActiveImage] = useState(0);
    const [added, setAdded] = useState(false);

    if (!product) {
        return (
            <main className="main-container py-16 text-center">
                <h1 className="text-2xl font-bold text-black">Product not found</h1>
                <p className="mt-3 text-sm text-slate-600">This listing may have been removed or sold out.</p>
                <Link href="/marketplace" className="mt-6 inline-flex items-center justify-center rounded-[10px] bg-black px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800">Back to marketplace</Link>
            </main>
        );
    }

    const handleAddToCart = () => {
        addToCart(product);
        setAdded(true);
        window.setTimeout(() => setAdded(false), 1800);
    };

    return (
        <main className="main-container py-10 sm:py-12 lg:py-14">
            <nav className="flex items-center gap-1 text-sm font-semibold text-slate-500" aria-label="Breadcrumb">
                <Link href="/marketplace" className="transition hover:text-black">Marketplace</Link>
                <ChevronRightIcon className="h-3.5 w-3.5" />
                <span className="text-black">{product.category}</span>
            </nav>

            <div className="mt-6 grid gap-10 lg:grid-cols-2">
                <div>
                    <div className="aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                        <img src={product.images[activeImage]} alt={product.title} className="h-full w-full object-cover" />
                    </div>
                    {product.images.length > 1 ? (
                        <div className="mt-3 flex gap-3">
                            {product.images.map((image, index) => (
                                <button
                                    key={image + index}
                                    type="button"
                                    onClick={() => setActiveImage(index)}
                                    className={`h-20 w-20 shrink-0 overflow-hidden rounded-[10px] border-2 transition ${index === activeImage ? "border-accent-400" : "border-transparent"}`}
                                    aria-label={`Show image ${index + 1}`}
                                >
                                    <img src={image} alt="" className="h-full w-full object-cover" />
                                </button>
                            ))}
                        </div>
                    ) : null}
                </div>

                <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">{product.category}</p>
                    <h1 className="mt-2 text-3xl font-bold tracking-tight text-black">{product.title}</h1>
                    <div className="mt-3 flex items-center gap-2 text-sm text-slate-600">
                        <span className="inline-flex items-center gap-1 font-semibold text-black">
                            <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 text-accent-500" aria-hidden="true">
                                <path d="M12 2.5l2.9 6.16 6.6.72-4.9 4.6 1.28 6.52L12 17.3l-5.88 3.2 1.28-6.52-4.9-4.6 6.6-.72L12 2.5Z" />
                            </svg>
                            {product.rating}
                        </span>
                        <span>·</span>
                        <span>Sold by {product.seller}</span>
                    </div>

                    <p className="mt-6 text-3xl font-bold text-black">{formatNaira(product.price)}</p>

                    <p className="mt-6 text-[15px] leading-7 text-slate-600">{product.description}</p>

                    <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                        <button
                            type="button"
                            onClick={handleAddToCart}
                            className="inline-flex flex-1 items-center justify-center rounded-[10px] bg-accent-400 px-6 py-3.5 text-base font-bold text-black transition hover:bg-accent-500"
                        >
                            {added ? "Added to cart ✓" : "Add to cart"}
                        </button>
                        <Link href="/cart" className="inline-flex flex-1 items-center justify-center rounded-[10px] border border-slate-200 bg-white px-6 py-3.5 text-base font-bold text-black transition hover:bg-slate-50">
                            View cart
                        </Link>
                    </div>

                    <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm leading-7 text-slate-600">
                        Protected by CampusMart escrow — funds are only released to the seller once you confirm pickup or delivery.
                    </div>
                </div>
            </div>
        </main>
    );
}
