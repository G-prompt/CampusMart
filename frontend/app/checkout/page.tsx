"use client";

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
    <PageShell title="Checkout" description="Complete your purchase with a polished student-friendly order summary and protected wallet transfer.">
      <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="site-card p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-700">Delivery details</p>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="text-sm font-semibold text-slate-950">Pickup location</p>
              <p className="mt-2 text-sm text-slate-600">Main campus student hub</p>
            </div>
            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="text-sm font-semibold text-slate-950">Preferred slot</p>
              <p className="mt-2 text-sm text-slate-600">Today • 4:00 PM</p>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200 p-4">
            <p className="text-sm font-semibold text-slate-950">Items in your order</p>
            <div className="mt-4 space-y-3">
              {cart.length ? cart.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                  <div>
                    <p className="font-semibold text-slate-950">{item.title}</p>
                    <p className="text-sm text-slate-600">Qty {item.quantity}</p>
                  </div>
                  <p className="text-sm font-semibold text-slate-950">₦{(item.price * item.quantity).toLocaleString()}</p>
                </div>
              )) : <p className="text-sm text-slate-600">Your cart is empty. Add products from the marketplace first.</p>}
            </div>
          </div>
        </div>

        <div className="site-card p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-700">Payment summary</p>
          <div className="mt-5 rounded-2xl bg-slate-50 p-5 text-sm text-slate-600">
            <div className="flex items-center justify-between"><span>Subtotal</span><span className="font-semibold text-slate-950">₦{subtotal.toLocaleString()}</span></div>
            <div className="mt-2 flex items-center justify-between"><span>Secure transfer fee</span><span className="font-semibold text-slate-950">₦{fee}</span></div>
            <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3"><span>Total</span><span className="font-semibold text-slate-950">₦{(subtotal + fee).toLocaleString()}</span></div>
          </div>

          <button type="button" className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-brand-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-700">Pay with CampusMart wallet</button>
          <p className="mt-4 text-sm leading-7 text-slate-600">Your wallet is protected by a smart fee engine designed for student vendors and buyers. Funds settle fast and securely.</p>
        </div>
      </div>
    </PageShell>
  );
}
