import PageShell from "@/components/common/PageShell";

const categories = [
  { name: "Study tools", count: "42 listings" },
  { name: "Tech", count: "18 listings" },
  { name: "Daily essentials", count: "27 listings" },
  { name: "Services", count: "13 listings" },
];

export default function Page() {
  return (
    <PageShell title="Categories" description="Browse campus-friendly product categories and discover what’s trending right now.">
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {categories.map((category) => (
          <div key={category.name} className="site-card p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-700">{category.count}</p>
            <h2 className="mt-3 text-xl font-semibold text-slate-950">{category.name}</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">Fresh listings from trusted student vendors and campus partners.</p>
          </div>
        ))}
      </div>
    </PageShell>
  );
}
