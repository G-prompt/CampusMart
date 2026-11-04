import Image from "next/image";
import Link from "next/link";

import PageShell from "@/components/common/PageShell";

const categories = [
    {
        name: "Food & Drink",
        value: "Food & Drink",
        image: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&q=85&w=900",
        description: "Meals, snacks, drinks and campus food finds.",
    },
    {
        name: "Fashion",
        value: "Clothes & Accessories",
        image: "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&q=85&w=900",
        description: "Clothing and everyday style for campus life.",
    },
    {
        name: "Electronics",
        value: "Technology",
        image: "https://images.unsplash.com/photo-1498049794561-7780e7231661?auto=format&fit=crop&q=85&w=900",
        description: "Phones, computers, audio gear and accessories.",
    },
    {
        name: "Shoes & Bags",
        value: "Shoes & Bags",
        image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=85&w=900",
        description: "Footwear and bags for class, work and weekends.",
    },
    {
        name: "Books",
        value: "Books",
        image: "https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&q=85&w=900",
        description: "Textbooks, course materials and good reads.",
    },
    {
        name: "Home & Hostel",
        value: "Home & Hostel Essentials",
        image: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&q=85&w=900",
        description: "Useful things to make your room feel like home.",
    },
    {
        name: "Beauty & Care",
        value: "Hair & Beauty",
        image: "https://images.unsplash.com/photo-1596462502278-27bfdc403348?auto=format&fit=crop&q=85&w=900",
        description: "Beauty and personal-care essentials.",
    },
    {
        name: "Cosmetics & Deodorants",
        value: "Cosmetics & Deodorants",
        image: "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&q=85&w=900",
        description: "Cosmetics, fragrances and everyday care.",
    },
    {
        name: "Printing & Stationery",
        value: "Printing & Stationery",
        image: "https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&q=85&w=900",
        description: "Notes, printing, stationery and study supplies.",
    },
    {
        name: "Fitness & Sports",
        value: "Fitness & Sports",
        image: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&q=85&w=900",
        description: "Sportswear, training gear and active-campus finds.",
    },
    {
        name: "Events",
        value: "Events",
        image: "https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&q=85&w=900",
        description: "Tickets and experiences happening around campus.",
    },
    {
        name: "Other Finds",
        value: "Other",
        image: "https://images.unsplash.com/photo-1473181488821-2d23949a045a?auto=format&fit=crop&q=85&w=900",
        description: "Useful things that do not fit another category.",
    },
];

export default function Page() {
    return (
        <PageShell
            title="Shop by category"
            description="Find what you need by browsing the kinds of products students buy and sell every day."
        >
            <section aria-label="Product categories" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {categories.map((category) => (
                    <Link
                        key={category.value}
                        href={`/marketplace?category=${encodeURIComponent(category.value)}`}
                        className="group overflow-hidden rounded-2xl border border-[#292C32] bg-[#111317] transition hover:-translate-y-1 hover:border-accent-400/60 hover:shadow-[0_18px_40px_rgba(0,0,0,0.3)]"
                    >
                        <div className="relative aspect-[16/10] overflow-hidden bg-[#181A1F]">
                            <Image
                                src={category.image}
                                alt={category.name}
                                fill
                                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                                className="object-cover transition duration-500 group-hover:scale-105"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                            <span className="absolute bottom-4 left-4 text-xl font-black text-white">
                                {category.name}
                            </span>
                        </div>
                        <div className="flex items-center justify-between gap-3 p-4">
                            <p className="text-sm leading-6 text-slate-400">{category.description}</p>
                            <span aria-hidden="true" className="shrink-0 text-lg font-bold text-accent-400 transition-transform group-hover:translate-x-1">
                                →
                            </span>
                        </div>
                    </Link>
                ))}
            </section>

            <Link
                href="/marketplace/services"
                className="group mt-6 flex items-center justify-between gap-4 overflow-hidden rounded-2xl border border-accent-400/30 bg-gradient-to-r from-[#21170F] to-[#111317] p-5 transition hover:border-accent-400/70 sm:p-6"
            >
                <div>
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-accent-400">Campus services</p>
                    <h2 className="mt-1 text-lg font-black text-white">Find help from people nearby</h2>
                    <p className="mt-1 text-sm text-slate-400">Tutoring, grooming, repairs, cleaning and more.</p>
                </div>
                <span aria-hidden="true" className="shrink-0 text-xl font-bold text-accent-400 transition-transform group-hover:translate-x-1">
                    →
                </span>
            </Link>
        </PageShell>
    );
}
