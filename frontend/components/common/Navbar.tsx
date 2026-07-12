"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const navLinks = [
  { href: "/marketplace", label: "Marketplace" },
  { href: "/categories", label: "Categories" },
  { href: "/sell", label: "Sell" },
  { href: "/wallet", label: "Wallet" },
  { href: "/support", label: "Support" },
  { href: "/admin/dashboard", label: "Admin" },
];

type UserProfile = { name: string; role: "vendor" | "client"; email: string };

type CartItem = { id: number; title: string; price: number; quantity: number };

export default function Navbar() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [cartCount, setCartCount] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const readState = () => {
      const storedUser = localStorage.getItem("campusmart-user");
      const storedCart = localStorage.getItem("campusmart-cart");
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      } else {
        setUser(null);
      }
      if (storedCart) {
        const parsed = JSON.parse(storedCart) as CartItem[];
        setCartCount(parsed.reduce((total, item) => total + item.quantity, 0));
      } else {
        setCartCount(0);
      }
    };

    readState();
    window.addEventListener("storage", readState);
    return () => window.removeEventListener("storage", readState);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("campusmart-user");
    localStorage.removeItem("campusmart-auth");
    setUser(null);
    setMobileOpen(false);
    router.push("/");
  };

  return (
    <header className="border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
      <div className="main-container flex flex-wrap items-center justify-between gap-4 py-4">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-900 text-sm font-semibold text-white shadow-sm">CM</span>
          <span className="flex flex-col leading-none">
            <span className="text-base font-semibold tracking-tight text-slate-950">CampusMart</span>
            <span className="mt-1 text-[11px] uppercase tracking-[0.24em] text-slate-500">Student marketplace</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {navLinks.map((item) => (
            <Link key={item.href} href={item.href} className="text-sm font-medium text-slate-600 transition hover:text-brand-900">{item.label}</Link>
          ))}
        </nav>

        <div className="flex items-center gap-2.5">
          {user ? (
            <>
              <span className="hidden rounded-full bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 sm:inline-flex">Hi, {user.name.split(" ")[0]}</span>
              <button type="button" onClick={handleLogout} className="rounded-full border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand-500 hover:text-brand-900">Logout</button>
            </>
          ) : (
            <>
              <Link href="/auth/login" className="hidden rounded-full border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand-500 hover:text-brand-900 sm:inline-flex">Sign in</Link>
              <Link href="/auth/signup" className="hidden rounded-full bg-brand-900 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 sm:inline-flex">Register</Link>
            </>
          )}

          <button type="button" onClick={() => setMobileOpen((value) => !value)} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 md:hidden" aria-label="Toggle navigation">
            ☰
          </button>
        </div>
      </div>

      {mobileOpen ? (
        <div className="border-t border-slate-200 bg-white px-4 py-4 md:hidden">
          <nav className="flex flex-col gap-3">
            {navLinks.map((item) => (
              <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} className="rounded-2xl px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-brand-900">{item.label}</Link>
            ))}
            {!user ? (
              <>
                <Link href="/auth/login" onClick={() => setMobileOpen(false)} className="rounded-2xl px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-brand-900">Sign in</Link>
                <Link href="/auth/signup" onClick={() => setMobileOpen(false)} className="rounded-2xl bg-brand-900 px-3 py-2 text-center text-sm font-semibold text-white">Register</Link>
              </>
            ) : null}
          </nav>
        </div>
      ) : null}
    </header>
  );
}
