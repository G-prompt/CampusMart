"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { getProductById, formatNaira, products } from "@/lib/products";
import { useCart } from "@/components/common/CartContext";
import { ChevronRightIcon } from "@/components/common/icons";
import ProductCard from "@/components/common/ProductCard";
import { getStoredListings } from "@/lib/listings";
import { addReview, getAverageRating, getReviews, type ProductReview } from "@/lib/reviews";
import { useAuth } from "@/components/common/AuthContext";

export default function ProductPage({ params }: { params: { id: string } }) {
    const product = useMemo(() => getStoredListings().find((item) => item.id === Number(params.id)) ?? getProductById(Number(params.id)), [params.id]);
    const { addToCart } = useCart();
    const { user, openAuth } = useAuth();
    const [activeImage, setActiveImage] = useState(0);
    const [added, setAdded] = useState(false);
    const [reviews, setReviews] = useState<ProductReview[]>([]);
    const [reviewRating, setReviewRating] = useState(5);
    const [reviewComment, setReviewComment] = useState("");
    const [reviewError, setReviewError] = useState("");
    const [recentProducts, setRecentProducts] = useState<typeof products>([]);

    useEffect(() => {
        if (!product) return;
        const recent = JSON.parse(localStorage.getItem("campusmart-recent-products") ?? "[]") as number[];
        const nextRecent = [product.id, ...recent.filter((id) => id !== product.id)].slice(0, 6);
        localStorage.setItem("campusmart-recent-products", JSON.stringify(nextRecent));
        setRecentProducts(nextRecent.map((id) => products.find((item) => item.id === id)).filter((item): item is typeof products[number] => Boolean(item)));
    }, [product]);

    useEffect(() => {
        if (!product) return;
        const loadReviews = () => setReviews(getReviews(product.id));
        loadReviews();
        window.addEventListener("campusmart-reviews-change", loadReviews);
        return () => window.removeEventListener("campusmart-reviews-change", loadReviews);
    }, [product]);

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
                    <div className="relative aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                        <Image src={product.images[activeImage]} alt={product.title} fill sizes="(max-width: 1024px) 100vw, 50vw" className="object-cover" priority />
                    </div>
                    {product.images.length > 1 ? (
                        <div className="mt-3 flex gap-3">
                            {product.images.map((image, index) => (
                                <button
                                    key={image}
                                    type="button"
                                    onClick={() => setActiveImage(index)}
                                    className={`relative h-20 w-20 shrink-0 overflow-hidden rounded-[10px] border-2 transition ${index === activeImage ? "border-accent-400" : "border-transparent"}`}
                                    aria-label={`Show image ${index + 1}`}
                                >
                                    <Image src={image} alt="" fill sizes="80px" className="object-cover" />
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
                            {getAverageRating(product.id, product.rating).toFixed(1)}
                        </span>
                        <span>·</span>
                        <span>Sold by {product.seller}</span>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Seller status</p><p className="mt-2 font-bold text-emerald-700">Verified campus seller</p><p className="mt-1 text-sm text-slate-600">Trusted by nearby buyers.</p></div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Exchange</p><p className="mt-2 font-bold text-slate-950">Campus pickup</p><p className="mt-1 text-sm text-slate-600">Arrange a safe nearby handoff.</p></div>
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

            <section className="mt-16 border-t border-slate-200 pt-10">
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <div><p className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500">Customer reviews</p><h2 className="mt-2 text-2xl font-bold text-black">What buyers are saying</h2></div>
                    <p className="text-sm font-semibold text-slate-600">{reviews.length} review{reviews.length === 1 ? "" : "s"}</p>
                </div>
                <div className="mt-6 grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
                    <form onSubmit={(event) => { event.preventDefault(); if (!user) { openAuth("login", "client"); return; } if (user.role !== "client") { setReviewError("Only client accounts can leave product reviews."); return; } if (!reviewComment.trim()) { setReviewError("Write a short comment before submitting."); return; } addReview({ productId: product.id, author: user.name, rating: reviewRating, comment: reviewComment.trim() }); setReviewComment(""); setReviewRating(5); setReviewError(""); }} className="site-card space-y-4 p-5">
                        <h3 className="text-lg font-bold text-slate-950">Leave a review</h3>
                        <label className="block text-sm font-semibold text-slate-700">Rating<select value={reviewRating} onChange={(event) => setReviewRating(Number(event.target.value))} className="mt-2 w-full rounded-[10px] border border-slate-200 bg-slate-50 px-3 py-3 text-slate-900"><option value="5">5 - Excellent</option><option value="4">4 - Good</option><option value="3">3 - Average</option><option value="2">2 - Below average</option><option value="1">1 - Poor</option></select></label>
                        <label className="block text-sm font-semibold text-slate-700">Comment<textarea value={reviewComment} onChange={(event) => setReviewComment(event.target.value)} rows={4} className="mt-2 w-full resize-y rounded-[10px] border border-slate-200 bg-slate-50 px-3 py-3 text-slate-900" placeholder="Share your experience with this product." /></label>
                        {reviewError ? <p className="text-sm font-semibold text-red-600" role="alert">{reviewError}</p> : null}
                        <button type="submit" className="rounded-[10px] bg-accent-400 px-4 py-3 text-sm font-bold text-black">{user ? "Post review" : "Sign in to review"}</button>
                    </form>
                    <div className="space-y-3">{reviews.length ? reviews.map((review) => <article key={review.id} className="rounded-xl border border-slate-200 p-5"><div className="flex items-center justify-between gap-3"><p className="font-bold text-slate-950">{review.author}</p><span className="text-sm font-bold text-slate-600">{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</span></div><p className="mt-3 text-sm leading-7 text-slate-600">{review.comment}</p></article>) : <p className="rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-600">No reviews yet. Be the first client to share your experience.</p>}</div>
                </div>
            </section>

            <section className="mt-16 border-t border-slate-200 pt-10">
                <p className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500">Keep exploring</p>
                <h2 className="mt-2 text-2xl font-bold text-black">You may also like</h2>
                <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                    {products.filter((item) => item.id !== product.id && item.category === product.category).slice(0, 4).map((item) => <ProductCard key={item.id} product={item} />)}
                </div>
            </section>
            {recentProducts.length > 1 ? <section className="mt-16 border-t border-slate-200 pt-10"><p className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500">Your trail</p><h2 className="mt-2 text-2xl font-bold text-black">Recently viewed</h2><div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{recentProducts.filter((item) => item.id !== product.id).slice(0, 4).map((item) => <ProductCard key={item.id} product={item} />)}</div></section> : null}
        </main>
    );
}
