import PageShell from "@/components/common/PageShell";

const helpTopics = [
  {
    title: "Buying on CampusMart",
    body: "Browse listings, compare student offers, and checkout with confidence using the secure wallet and protected transfer flow."
  },
  {
    title: "Selling as a vendor",
    body: "Create listings, manage orders, and keep buyers updated from a clean vendor dashboard built for daily campus operations."
  },
  {
    title: "Payments and disputes",
    body: "Review fee details before checkout and raise concerns through the support flow if a transaction needs follow-up."
  }
];

export default function Page() {
  return (
    <PageShell title="Help" description="Find clear guidance for buyers, vendors, and campus admins using CampusMart.">
      <div className="space-y-4">
        {helpTopics.map((topic) => (
          <div key={topic.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <h2 className="text-lg font-semibold text-slate-950">{topic.title}</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">{topic.body}</p>
          </div>
        ))}
      </div>
    </PageShell>
  );
}
