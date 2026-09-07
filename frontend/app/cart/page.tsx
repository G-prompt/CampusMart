"use client";

import Link from "next/link";
import { useCart } from "@/components/common/CartContext";
import { formatNaira } from "@/lib/products";

export default function Page() {
    const { items, subtotal, updateQuantity, removeFromCart } = useCart();
    const fee = subtotal >= 50000 ? 100 : subtotal >= 10000 ? 50 : subtotal > 0 ? 20 : 0;

    return (
        <main className="main-container py-10 sm:py-12 lg:py-14">
            <h1 className="text-3xl font-bold tracking-tight text-black">Your cart</h1>
            <p className="mt-2 text-sm leading-7 text-slate-600">Review your selected items, calculate secure transfer fees, and continue to checkout.</p>

            <div className="mt-8 grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
                <div className="rounded-xl border border-slate-200 bg-white p-6">
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Items</p>
                        <span className="rounded-[10px] bg-slate-100 px-3 py-1 text-sm font-semibold text-black">{items.length} item{items.length === 1 ? "" : "s"}</span>
                    </div>

                    <div className="mt-6 space-y-3">
                        {items.length ? (
                            items.map((item) => (
                                <div key={item.id} className="flex items-center justify-between gap-4 rounded-[10px] border border-slate-200 bg-slate-50 px-4 py-3">
                                    <div className="min-w-0">
                                        <p className="truncate font-semibold text-black">{item.title}</p>
                                        <p className="text-sm text-slate-600">{formatNaira(item.price)} each</p>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-3">
                                        <div className="flex items-center rounded-[10px] border border-slate-200 bg-white">
                                            <button type="button" onClick={() => updateQuantity(item.id, item.quantity - 1)} className="h-8 w-8 text-lg font-bold text-black transition hover:text-slate-500" aria-label={`Decrease quantity of ${item.title}`}>−</button>
                                            <span className="w-6 text-center text-sm font-semibold text-black">{item.quantity}</span>
                                            <button type="button" onClick={() => updateQuantity(item.id, item.quantity + 1)} className="h-8 w-8 text-lg font-bold text-black transition hover:text-slate-500" aria-label={`Increase quantity of ${item.title}`}>+</button>
                                        </div>
                                        <p className="w-24 text-right text-sm font-bold text-black">{formatNaira(item.price * item.quantity)}</p>
                                        <button type="button" onClick={() => removeFromCart(item.id)} className="text-sm font-semibold text-slate-500 transition hover:text-black" aria-label={`Remove ${item.title} from cart`}>Remove</button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="rounded-[10px] border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-600">
                                <p className="font-semibold text-black">Your cart is currently empty.</p>
                                <p className="mt-2">Browse the marketplace and add products to begin your checkout flow.</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="h-fit rounded-xl border border-slate-200 bg-white p-6">
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Order summary</p>
                    <div className="mt-5 rounded-[10px] bg-slate-50 p-5 text-sm text-slate-600">
                        <div className="flex items-center justify-between"><span>Subtotal</span><span className="font-semibold text-black">{formatNaira(subtotal)}</span></div>
                        <div className="mt-2 flex items-center justify-between"><span>Secure transfer fee</span><span className="font-semibold text-black">₦{fee}</span></div>
                        <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3"><span>Total</span><span className="font-semibold text-black">{formatNaira(subtotal + fee)}</span></div>
                    </div>

                    <Link href="/checkout" className="mt-6 inline-flex w-full items-center justify-center rounded-[10px] bg-accent-400 px-5 py-3 text-sm font-bold text-black transition hover:bg-accent-500">
                        Proceed to checkout
                    </Link>
                    <Link href="/marketplace" className="mt-3 inline-flex w-full items-center justify-center rounded-[10px] border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-black transition hover:bg-slate-50">
                        Continue shopping
                    </Link>
                </div>
            </div>
        </main>
    );
}
