import PageShell from "@/components/common/PageShell";

const favourites = [
  { title: "Campus printing package", price: "₦5,400" },
  { title: "Engineering calculator bundle", price: "₦12,800" },
  { title: "Laptop stand + charger", price: "₦18,500" },
];

export default function Page() {
  return (
    <PageShell title="Favourites" description="Save your preferred listings for later and revisit them anytime.">
      <div className="space-y-4">
        {favourites.map((item) => (
          <div key={item.title} className="site-card flex items-center justify-between p-5">
            <div>
              <p className="font-semibold text-slate-950">{item.title}</p>
              <p className="mt-1 text-sm text-slate-600">Saved for quick checkout</p>
            </div>
            <span className="rounded-full bg-brand-100 px-3 py-1 text-sm font-semibold text-brand-900">{item.price}</span>
          </div>
        ))}
      </div>
    </PageShell>
  );
}
