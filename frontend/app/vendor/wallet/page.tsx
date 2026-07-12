import PageShell from "@/components/common/PageShell";

const transactions = [
  { title: "Laptop stand sale", amount: "+₦18,500", status: "Completed" },
  { title: "Service commission", amount: "-₦2,000", status: "Settled" },
  { title: "Campus bundle payout", amount: "+₦5,400", status: "Processing" },
];

export default function Page() {
  return (
    <PageShell title="Vendor wallet" description="Track your real-time balance, payout progress, and secure transfer activity.">
      <div className="grid gap-8 lg:grid-cols-[1fr_0.8fr]">
        <div className="site-card p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-700">Vendor balance</p>
          <h2 className="mt-3 text-3xl font-semibold text-slate-950">₦82,400</h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">Your wallet is ready for secure student transactions with low handling charges designed for campus sellers.</p>

          <div className="mt-6 space-y-3">
            {transactions.map((entry) => (
              <div key={entry.title} className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3">
                <div>
                  <p className="font-semibold text-slate-950">{entry.title}</p>
                  <p className="text-sm text-slate-600">{entry.status}</p>
                </div>
                <p className="text-sm font-semibold text-slate-950">{entry.amount}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="site-card p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-700">Fee policy</p>
          <div className="mt-4 space-y-3 text-sm text-slate-600">
            <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3"><span>Below ₦10k</span><span className="font-semibold text-slate-950">₦20</span></div>
            <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3"><span>₦10k to ₦49,999</span><span className="font-semibold text-slate-950">₦50</span></div>
            <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3"><span>₦50k+</span><span className="font-semibold text-slate-950">₦100</span></div>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
