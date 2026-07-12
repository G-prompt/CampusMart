"use client";

import { useEffect, useState } from "react";
import PageShell from "@/components/common/PageShell";

type Product = {
  id: number;
  title: string;
  price: number;
  rating: number;
  category: string;
  description: string;
};

type CartItem = Product & { quantity: number };

const products: Product[] = [
  { id: 1, title: "Engineering calculator bundle", price: 12800, rating: 4.8, category: "Study tools", description: "A reliable calculator set for labs and exams." },
  { id: 2, title: "Campus printing package", price: 5400, rating: 4.7, category: "Services", description: "Fast digital printing for reports and portfolios." },
  { id: 3, title: "Laptop stand + charger", price: 18500, rating: 4.9, category: "Tech", description: "Portable desk solution for student work sessions." },
  { id: 4, title: "Shared hostel meal plan", price: 9700, rating: 4.6, category: "Daily essentials", description: "Affordable meal credits for hostel residents." },
];

const formatCurrency = (value: number) => `₦${value.toLocaleString()}`;

export default function Page() {
  const [cart, setCart] = useState<CartItem[]>([]);

  useEffect(() => {
    const savedCart = localStorage.getItem("campusmart-cart");
    if (savedCart) {
      setCart(JSON.parse(savedCart));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("campusmart-cart", JSON.stringify(cart));
  }, [cart]);

  const addToCart = (product: Product) => {
    setCart((current) => {
      const existing = current.find((item) => item.id === product.id);
      if (existing) {
        return current.map((item) => (item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item));
      }
      return [...current, { ...product, quantity: 1 }];
    });
  };

  const subtotal = cart.reduce((total, item) => total + item.price * item.quantity, 0);
  const cartCount = cart.reduce((total, item) => total + item.quantity, 0);

  return (
    <PageShell title="Marketplace" description="Browse curated student-friendly listings, add products to your cart, and move to checkout in minutes.">
      <div className="grid gap-8 lg:grid-cols-[1.35fr_0.65fr]">
        <section className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-white p-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-700">Featured today</p>
              <p className="text-sm text-slate-600">Trusted deals from student vendors across campus.</p>
            </div>
            <div className="rounded-full bg-brand-100 px-3 py-1 text-sm font-semibold text-brand-900">{products.length} products</div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { title: "Electronics", href: "/categories" },
              { title: "Fashion", href: "/categories" },
              { title: "Books & Supplies", href: "/categories" },
              { title: "Services", href: "/marketplace/services" },
            ].map((item) => (
              <a key={item.title} href={item.href} className="site-card p-4 text-sm font-semibold text-slate-900 transition hover:-translate-y-1">
                {item.title}
              </a>
            ))}
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {products.map((product) => (
              <article key={product.id} className="site-card p-6">
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-slate-600">{product.category}</span>
                  <span className="text-sm font-semibold text-amber-500">⭐ {product.rating}</span>
                </div>
                <h3 className="mt-4 text-xl font-semibold text-slate-950">{product.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">{product.description}</p>
                <div className="mt-5 flex items-center justify-between">
                  <p className="text-xl font-semibold text-slate-950">{formatCurrency(product.price)}</p>
                  <button type="button" onClick={() => addToCart(product)} className="rounded-full bg-brand-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700">Add to cart</button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <aside className="space-y-6">
          <div className="site-card p-6">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-700">Cart preview</p>
              <span className="rounded-full bg-brand-100 px-3 py-1 text-sm font-semibold text-brand-900">{cartCount} item{cartCount === 1 ? "" : "s"}</span>
            </div>

            {cart.length ? (
              <div className="mt-5 space-y-3">
                {cart.map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                    <div>
                      <p className="font-semibold text-slate-950">{item.title}</p>
                      <p className="text-sm text-slate-600">Qty {item.quantity}</p>
                    </div>
                    <p className="text-sm font-semibold text-slate-950">{formatCurrency(item.price * item.quantity)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-5 text-sm leading-7 text-slate-600">Your cart is empty. Add a few items and the checkout flow will appear here.</p>
            )}

            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              <div className="flex items-center justify-between"><span>Subtotal</span><span className="font-semibold text-slate-950">{formatCurrency(subtotal)}</span></div>
              <div className="mt-2 flex items-center justify-between"><span>Secure fintech fee</span><span className="font-semibold text-slate-950">{subtotal >= 50000 ? "₦100" : subtotal >= 10000 ? "₦50" : subtotal > 0 ? "₦20" : "₦0"}</span></div>
              <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-2"><span>Estimated total</span><span className="font-semibold text-slate-950">{formatCurrency(subtotal + (subtotal >= 50000 ? 100 : subtotal >= 10000 ? 50 : subtotal > 0 ? 20 : 0))}</span></div>
            </div>

            <a href="/checkout" className="mt-5 inline-flex w-full items-center justify-center rounded-full bg-brand-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-700">Proceed to checkout</a>
          </div>

          <div className="site-card p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-700">Why students trust CampusMart</p>
            <ul className="mt-4 space-y-3 text-sm text-slate-600">
              <li>• Verified student vendors and fast delivery.</li>
              <li>• Secure wallet transfers with transparent fees.</li>
              <li>• Friendly support for everyday campus transactions.</li>
            </ul>
          </div>
        </aside>
      </div>
    </PageShell>
  );
}
