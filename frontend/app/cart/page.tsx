"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import PageShell from "@/components/common/PageShell";

type CartItem = { id: number; title: string; price: number; quantity: number };

export default function Page() {
    const [cart, setCart] = useState<CartItem[]>([]);

    useEffect(() => {
        const savedCart = localStorage.getItem("campusmart-cart");
        if (savedCart) {
            setCart(JSON.parse(savedCart));
        }
    }, []);

    const subtotal = useMemo(() => cart.reduce((total, item) => total + item.price * item.quantity, 0), [cart]);
    const fee = subtotal >= 50000 ? 100 : subtotal >= 10000 ? 50 : subtotal > 0 ? 20 : 0;

    return (
        <PageShell title="Cart" description="Review your selected items, calculate secure transfer fees, and continue to checkout with CampusMart protection.">
            <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
                <div className="site-card p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-700">Your selected items</p>
                            <p className="mt-2 text-sm text-slate-600">Everything in your cart is protected by CampusMart escrow and smart fintech pricing.</p>
                        </div>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">{cart.length} item{cart.length === 1 ? "" : "s"}</span>
                    </div>

                    <div className="mt-6 space-y-3">
                        {cart.length ? (
                            cart.map((item) => (
                                <div key={item.id} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                                    <div>
                                        <p className="font-semibold text-slate-950">{item.title}</p>
                                        <p className="text-sm text-slate-600">Qty {item.quantity}</p>
                                    </div>
                                    <p className="text-sm font-semibold text-slate-950">₦{(item.price * item.quantity).toLocaleString()}</p>
                                </div>
                            ))
                        ) : (
                            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-600">
                                <p className="font-semibold text-slate-950">Your cart is currently empty.</p>
                                <p className="mt-2">Browse the marketplace and add products or services to begin your checkout flow.</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="site-card p-6">
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-700">Order summary</p>
                    <div className="mt-5 rounded-2xl bg-slate-50 p-5 text-sm text-slate-600">
                        <div className="flex items-center justify-between"><span>Subtotal</span><span className="font-semibold text-slate-950">₦{subtotal.toLocaleString()}</span></div>
                        <div className="mt-2 flex items-center justify-between"><span>Secure transfer fee</span><span className="font-semibold text-slate-950">₦{fee}</span></div>
                        <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3"><span>Total</span><span className="font-semibold text-slate-950">₦{(subtotal + fee).toLocaleString()}</span></div>
                    </div>

                    <Link href="/checkout" className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-brand-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-700">
                        Proceed to checkout
                    </Link>
                    <Link href="/marketplace" className="mt-3 inline-flex w-full items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50">
                        Continue shopping
                    </Link>
                </div>
            </div>
        </PageShell>
    );
}
