import PageShell from "@/components/common/PageShell";

const metrics = [
  { label: "Active vendors", value: "248", detail: "+18% this term" },
  { label: "Escrow balance", value: "₦4.8M", detail: "Protected funds" },
  { label: "Student buyers", value: "12.6K", detail: "Live accounts" },
];

const resourceRows = [
  { name: "Verified inventory", value: "₦9.2M", trend: "+12%" },
  { name: "Service listings", value: "₦3.6M", trend: "+8%" },
  { name: "Campus subscriptions", value: "₦5.8M", trend: "+15%" },
];

const focusAreas = [
  { title: "Fraud prevention", value: "94%", description: "Risk checks completed before payouts" },
  { title: "Vendor onboarding", value: "72 hrs", description: "Average approval window for new sellers" },
  { title: "Student support", value: "4.9/5", description: "Satisfaction score from campus buyers" },
];

export default function Page() {
  return (
    <PageShell title="Admin dashboard" description="Monitor strategic growth, resource valuation, wallet protection, and marketplace health from one intelligent command center.">
      <div className="grid gap-8 xl:grid-cols-[1.25fr_0.75fr]">
        <section className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            {metrics.map((item) => (
              <div key={item.label} className="site-card p-5">
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">{item.label}</p>
                <p className="mt-3 text-3xl font-semibold text-slate-950">{item.value}</p>
                <p className="mt-2 text-sm text-slate-600">{item.detail}</p>
              </div>
            ))}
          </div>

          <div className="site-card p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-700">Resource valuation</p>
                <h2 className="mt-2 text-2xl font-semibold text-slate-950">₦18.4M tracked marketplace assets</h2>
              </div>
              <div className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-700">+13.8% this month</div>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {resourceRows.map((row) => (
                <div key={row.name} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm text-slate-600">{row.name}</p>
                  <p className="mt-3 text-xl font-semibold text-slate-950">{row.value}</p>
                  <p className="mt-1 text-sm font-medium text-emerald-600">{row.trend}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="site-card p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-700">Operational focus</p>
            <div className="mt-5 space-y-4">
              {focusAreas.map((item) => (
                <div key={item.title} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-semibold text-slate-950">{item.title}</h3>
                    <span className="rounded-full bg-brand-100 px-3 py-1 text-sm font-semibold text-brand-700">{item.value}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <aside className="space-y-6">
          <div className="site-card p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-700">Wallet protection</p>
            <h3 className="mt-3 text-xl font-semibold text-slate-950">Smart fee engine is live</h3>
            <p className="mt-3 text-sm leading-7 text-slate-600">Transfers below ₦10,000 cost ₦20, mid-tier sends cost ₦50, and larger transfers cost ₦100 to protect both vendors and buyers.</p>
            <div className="mt-5 space-y-3 text-sm text-slate-600">
              <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3"><span>Low value</span><span className="font-semibold text-slate-950">₦20</span></div>
              <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3"><span>Mid value</span><span className="font-semibold text-slate-950">₦50</span></div>
              <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3"><span>High value</span><span className="font-semibold text-slate-950">₦100</span></div>
            </div>
          </div>

          <div className="site-card p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-700">Recent admin actions</p>
            <ul className="mt-4 space-y-3 text-sm text-slate-600">
              <li className="rounded-2xl border border-slate-200 p-3">Verified 14 new campus vendors.</li>
              <li className="rounded-2xl border border-slate-200 p-3">Cleared 3 disputed orders with escrow support.</li>
              <li className="rounded-2xl border border-slate-200 p-3">Adjusted student pricing for weekend promotions.</li>
            </ul>
          </div>
        </aside>
      </div>
    </PageShell>
  );
}
