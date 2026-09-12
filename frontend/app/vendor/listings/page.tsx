"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import PageShell from "@/components/common/PageShell";
import { useAuth } from "@/components/common/AuthContext";
import { deleteListing, getStoredListings } from "@/lib/listings";
import { formatNaira } from "@/lib/products";

export default function Page() {
  const { user, openAuth } = useAuth();
  const [listings, setListings] = useState(() => getStoredListings());
  useEffect(() => { const load = () => setListings(getStoredListings()); load(); window.addEventListener("campusmart-listings-change", load); return () => window.removeEventListener("campusmart-listings-change", load); }, []);
  const mine = listings.filter((listing) => listing.seller === user?.name);
  if (user?.role !== "vendor") return <PageShell title="Vendor listings" description="Review and edit your active marketplace listings."><div className="site-card max-w-md p-8 text-center"><h2 className="text-2xl font-bold text-slate-950">Vendor access required</h2><button type="button" onClick={() => openAuth("register", "vendor")} className="mt-6 rounded-[10px] bg-accent-400 px-5 py-3 text-sm font-bold text-black">Create vendor account</button></div></PageShell>;
  return <PageShell title="Vendor listings" description="Review and manage the products customers see in the marketplace."><div className="flex flex-wrap items-center justify-between gap-4"><p className="text-sm text-slate-600">{mine.length} published listing{mine.length === 1 ? "" : "s"}</p><Link href="/vendor/add-listing" className="rounded-[10px] bg-accent-400 px-5 py-3 text-sm font-bold text-black">Add listing</Link></div>{mine.length ? <div className="mt-6 grid gap-4 md:grid-cols-2">{mine.map((listing) => <article key={listing.id} className="site-card p-5"><p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">{listing.category}</p><h2 className="mt-2 text-xl font-bold text-slate-950">{listing.title}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{listing.description}</p><div className="mt-5 flex items-center justify-between gap-3"><span className="text-lg font-bold text-slate-950">{formatNaira(listing.price)}</span><button type="button" onClick={() => { deleteListing(listing.id); setListings(getStoredListings()); }} className="text-sm font-bold text-red-600">Remove</button></div></article>)}</div> : <div className="site-card mt-6 p-8 text-center"><h2 className="text-xl font-bold text-slate-950">Your shop is empty</h2><p className="mt-2 text-sm text-slate-600">Publish your first product and it will appear here and in the marketplace.</p></div>}</PageShell>;
}
