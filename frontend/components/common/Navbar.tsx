"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./AuthContext";
import { useCart } from "./CartContext";
import { CartIcon } from "./icons";

const navLinks = [
  { href: "/marketplace", label: "Marketplace" },
  { href: "/categories", label: "Categories" },
  { href: "/sell", label: "Sell" },
  { href: "/wallet", label: "Wallet" },
  { href: "/support", label: "Support" },
  { href: "/admin/dashboard", label: "Admin" },
];

const categories = ["All", "Technology", "Books", "Beauty", "Fashion", "Entertainment", "Events"];

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" aria-hidden="true" className="h-6 w-6">
      <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" className="h-6 w-6">
      <path strokeLinecap="round" d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true" className="h-5 w-5">
      <circle cx="11" cy="11" r="6.5" /><path strokeLinecap="round" d="m16 16 4 4" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" aria-hidden="true" className="h-6 w-6">
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.8 5.8a5.5 5.5 0 0 0-7.8 0L12 6.9l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 22l8.8-8.4a5.5 5.5 0 0 0 0-7.8Z" />
    </svg>
  );
}

export default function Navbar() {
  const { user, openAuth, logout } = useAuth();
  const { itemCount } = useCart();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const router = useRouter();

  useEffect(() => {
    if (!sidebarOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => event.key === "Escape" && setSidebarOpen(false);
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [sidebarOpen]);

  useEffect(() => {
    if (!searchOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => event.key === "Escape" && setSearchOpen(false);
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [searchOpen]);

  const handleLogout = () => {
    logout();
    setSidebarOpen(false);
    router.push("/");
  };

  const handleOpenAuth = (mode: "login" | "register") => {
    setSidebarOpen(false);
    openAuth(mode);
  };

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const search = query.trim();
    if (search) {
      setSearchOpen(false);
      router.push(`/marketplace/search?q=${encodeURIComponent(search)}`);
    }
  };

  return (
    <>
      <header className="border-b border-slate-200 bg-white">
        <div className="relative flex min-h-[72px] w-full items-center justify-between gap-6 px-4 py-3 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="-ml-2 inline-flex h-11 w-11 shrink-0 items-center justify-center text-black transition hover:text-brand-700"
            aria-label="Open navigation menu"
            aria-expanded={sidebarOpen}
          >
            <MenuIcon />
          </button>

          <Link href="/" className="absolute left-1/2 -translate-x-1/2 text-2xl font-bold tracking-tight text-black sm:text-3xl" aria-label="CampusMart home">
            CampusMart
          </Link>

          <div className="ml-auto flex min-w-0 items-center justify-end gap-2 sm:gap-4">
            <form onSubmit={handleSearch} className="relative hidden w-[clamp(14rem,27vw,31rem)] md:block" role="search">
              <label htmlFor="site-search" className="sr-only">Search CampusMart</label>
              <input
                id="site-search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search CampusMart"
                className="h-10 w-full border-0 bg-slate-100 py-2 pl-4 pr-11 text-sm text-slate-900 outline-none transition placeholder:text-slate-500 focus:bg-slate-50 focus:ring-2 focus:ring-slate-300"
                style={{ borderRadius: 5 }}
              />
              <button type="submit" className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-500 transition hover:text-brand-700" aria-label="Search">
                <SearchIcon />
              </button>
            </form>
            <button type="button" onClick={() => setSearchOpen(true)} className="inline-flex h-11 w-11 shrink-0 items-center justify-center text-black transition hover:text-brand-700 md:hidden" aria-label="Open search">
              <SearchIcon />
            </button>
            <Link href="/marketplace/favourites" className="inline-flex h-11 w-11 shrink-0 items-center justify-center text-black transition hover:text-brand-700" aria-label="Wishlist">
              <HeartIcon />
            </Link>
            <Link href="/cart" className="relative inline-flex h-11 w-11 shrink-0 items-center justify-center text-black transition hover:text-brand-700" aria-label="Cart">
              <CartIcon />
              {itemCount > 0 ? (
                <span className="absolute right-0 top-1 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent-400 px-1 text-[11px] font-bold leading-none text-black">
                  {itemCount > 9 ? "9+" : itemCount}
                </span>
              ) : null}
            </Link>
          </div>
        </div>

        <div>
          <nav className="flex w-full items-center justify-start gap-10 overflow-x-auto px-4 py-3.5 sm:px-6 md:justify-between lg:px-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Product categories">
            {categories.map((category) => (
              <button key={category} type="button" className="shrink-0 text-base font-bold text-black transition hover:text-brand-800">{category}</button>
            ))}
          </nav>
        </div>
      </header>

      <div className={`fixed inset-0 z-[60] transition md:hidden ${searchOpen ? "visible" : "invisible delay-200"}`} aria-hidden={!searchOpen}>
        <button
          type="button"
          className={`absolute inset-0 bg-slate-950/35 transition-opacity duration-200 ${searchOpen ? "opacity-100" : "opacity-0"}`}
          onClick={() => setSearchOpen(false)}
          aria-label="Close search"
          tabIndex={searchOpen ? 0 : -1}
        />
        <section className={`relative w-full bg-white px-4 pb-6 pt-4 shadow-xl transition-transform duration-200 ${searchOpen ? "translate-y-0" : "-translate-y-full"}`} aria-label="Search panel">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-black">Search CampusMart</h2>
            <button type="button" onClick={() => setSearchOpen(false)} className="inline-flex h-10 w-10 items-center justify-center text-black" aria-label="Close search">
              <CloseIcon />
            </button>
          </div>
          <form onSubmit={handleSearch} className="relative w-full" role="search">
            <label htmlFor="mobile-site-search" className="sr-only">Search CampusMart</label>
            <input
              id="mobile-site-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="What are you looking for?"
              className="h-12 w-full border-0 bg-slate-100 py-2 pl-4 pr-12 text-base text-slate-900 outline-none placeholder:text-slate-500 focus:ring-2 focus:ring-slate-300"
              style={{ borderRadius: 5 }}
              autoFocus={searchOpen}
            />
            <button type="submit" className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-black" aria-label="Submit search">
              <SearchIcon />
            </button>
          </form>
        </section>
      </div>

      <div className={`fixed inset-0 z-50 transition ${sidebarOpen ? "visible" : "invisible delay-300"}`} aria-hidden={!sidebarOpen}>
        <button
          type="button"
          className={`absolute inset-0 bg-slate-950/35 backdrop-blur-[2px] transition-opacity duration-300 ${sidebarOpen ? "opacity-100" : "opacity-0"}`}
          onClick={() => setSidebarOpen(false)}
          aria-label="Close navigation menu"
          tabIndex={sidebarOpen ? 0 : -1}
        />
        <aside className={`relative flex h-full w-[min(88vw,360px)] flex-col bg-white shadow-2xl transition-transform duration-300 ease-out ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`} aria-label="Main navigation">
          <div className="flex items-center justify-end px-5 py-4">
            <button type="button" onClick={() => setSidebarOpen(false)} className="inline-flex h-10 w-10 items-center justify-center text-slate-600 transition hover:text-slate-950" aria-label="Close navigation menu">
              <CloseIcon />
            </button>
          </div>

          <div className="p-5">
            {user ? (
              <div className="space-y-3">
                <p className="text-base text-slate-600">Signed in as <span className="font-semibold text-slate-900">{user.name}</span></p>
                <button type="button" onClick={handleLogout} className="w-full rounded-[10px] bg-slate-100 px-4 py-3 text-base font-semibold text-slate-700 transition hover:bg-slate-200 hover:text-black">Sign out</button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <button type="button" onClick={() => handleOpenAuth("login")} className="rounded-[10px] bg-slate-100 px-4 py-3 text-center text-base font-semibold text-slate-700 transition hover:bg-slate-200">Sign in</button>
                <button type="button" onClick={() => handleOpenAuth("register")} className="rounded-[10px] bg-accent-400 px-4 py-3 text-center text-base font-semibold text-black transition hover:bg-accent-500">Register</button>
              </div>
            )}
          </div>

          <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-4 py-5">
            {navLinks.map((item) => (
              <Link key={item.href} href={item.href} onClick={() => setSidebarOpen(false)} className="rounded-lg px-4 py-3.5 text-lg font-bold text-black transition hover:bg-slate-50 hover:text-brand-900">{item.label}</Link>
            ))}
          </nav>

          <div className="px-5 py-4">
            <p className="text-xs tracking-wide text-slate-500">© CampusMart 2026</p>
          </div>
        </aside>
      </div>
    </>
  );
}
