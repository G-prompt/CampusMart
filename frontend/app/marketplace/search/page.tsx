import PageShell from "@/components/common/PageShell";

const results = [
  { title: "Study desk lamp", category: "Study tools", price: "₦4,900" },
  { title: "Campus meal credits", category: "Daily essentials", price: "₦9,700" },
  { title: "Resume review service", category: "Services", price: "₦3,600" },
];

export default function Page() {
  return (
    <PageShell title="Search" description="Search listings by keyword, category, or campus need.">
      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
        <input className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-brand-600" placeholder="Try: calculator, printing, laptop" />
        <div className="mt-5 space-y-3">
          {results.map((result) => (
            <div key={result.title} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <div>
                <p className="font-semibold text-slate-950">{result.title}</p>
                <p className="mt-1 text-sm text-slate-600">{result.category}</p>
              </div>
              <span className="text-sm font-semibold text-brand-900">{result.price}</span>
            </div>
          ))}
        </div>
      </div>
    </PageShell>
  );
}
