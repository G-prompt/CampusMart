"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import PageShell from "@/components/common/PageShell";
import { useAuth } from "@/components/common/AuthContext";
import { saveListing } from "@/lib/listings";
import { categories } from "@/lib/products";

export default function Page() {
  const router = useRouter();
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Technology");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState("");
  const [error, setError] = useState("");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (user?.role !== "vendor") {
      setError("Sign in with a vendor account to publish a listing.");
      return;
    }
    const numericPrice = Number(price);
    if (!title.trim() || !description.trim() || !Number.isFinite(numericPrice) || numericPrice <= 0) {
      setError("Add a title, description, and valid price before publishing.");
      return;
    }
    saveListing({ title: title.trim(), category, price: numericPrice, description: description.trim(), images: image.trim() ? [image.trim()] : [] }, user.name);
    router.push("/vendor/listings");
  };

  return (
    <PageShell title="Add listing" description="Create a detailed product or service listing for campus buyers.">
      <form onSubmit={submit} className="site-card max-w-3xl space-y-5 p-6 sm:p-8">
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="text-sm font-semibold text-slate-700">Product or service name<input required value={title} onChange={(event) => setTitle(event.target.value)} className="mt-2 w-full rounded-[10px] border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-black focus:bg-white" placeholder="e.g. Calculus revision pack" /></label>
          <label className="text-sm font-semibold text-slate-700">Category<select value={category} onChange={(event) => setCategory(event.target.value)} className="mt-2 w-full rounded-[10px] border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-black focus:bg-white">{categories.filter((item) => item !== "All").map((item) => <option key={item}>{item}</option>)}</select></label>
        </div>
        <label className="block text-sm font-semibold text-slate-700">Price in naira<input required type="number" min="1" value={price} onChange={(event) => setPrice(event.target.value)} className="mt-2 w-full rounded-[10px] border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-black focus:bg-white" placeholder="15000" /></label>
        <label className="block text-sm font-semibold text-slate-700">Description<textarea required rows={6} value={description} onChange={(event) => setDescription(event.target.value)} className="mt-2 w-full resize-y rounded-[10px] border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-black focus:bg-white" placeholder="Describe condition, what is included, delivery or pickup details, and anything buyers should know." /></label>
        <label className="block text-sm font-semibold text-slate-700">Product image URL <span className="font-normal text-slate-500">(optional)</span><input type="url" value={image} onChange={(event) => setImage(event.target.value)} className="mt-2 w-full rounded-[10px] border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-black focus:bg-white" placeholder="https://..." /></label>
        {error ? <p className="text-sm font-semibold text-red-600" role="alert">{error}</p> : null}
        <button type="submit" className="inline-flex w-full items-center justify-center rounded-[10px] bg-accent-400 px-5 py-3.5 text-sm font-bold text-black transition hover:bg-accent-500 sm:w-auto">Publish listing</button>
      </form>
    </PageShell>
  );
}
