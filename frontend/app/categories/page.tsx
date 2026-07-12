import PageShell from "@/components/common/PageShell";

const categories = [
    { name: "Electronics", count: "128 listings", description: "Phones, laptops, chargers, accessories and smart devices." },
    { name: "Fashion", count: "95 listings", description: "School outfits, shoes, bags and accessories." },
    { name: "Books & Supplies", count: "147 listings", description: "Course books, guides, stationery and school materials." },
    { name: "Home & Hostel", count: "84 listings", description: "Beds, fans, kitchen items, decor and hostel essentials." },
    { name: "Health & Beauty", count: "61 listings", description: "Personal care products, cosmetics and wellness essentials." },
    { name: "Services", count: "74 listings", description: "Tutoring, cleaning, delivery, printing and event support." },
];

export default function Page() {
    return (
        <PageShell title="Categories" description="Explore all the major product classes on CampusMart, from electronics to services and everything in between.">
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {categories.map((category) => (
                    <div key={category.name} className="site-card p-6">
                        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-700">{category.count}</p>
                        <h2 className="mt-3 text-xl font-semibold text-slate-950">{category.name}</h2>
                        <p className="mt-2 text-sm leading-7 text-slate-600">{category.description}</p>
                        <a href="/marketplace" className="mt-4 inline-flex text-sm font-semibold text-brand-900">Browse this category →</a>
                    </div>
                ))}
            </div>
        </PageShell>
    );
}
