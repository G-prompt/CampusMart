import PageShell from "@/components/common/PageShell";

const services = [
  { title: "Resume review", price: "₦3,600", detail: "Fast feedback from verified student mentors" },
  { title: "Event setup", price: "₦7,200", detail: "Campus event helpers for clubs and societies" },
  { title: "Photography package", price: "₦10,000", detail: "Portfolio and event photo support" },
];

export default function Page() {
  return (
    <PageShell title="Services" description="Find campus services and local experts for your next opportunity.">
      <div className="grid gap-5 md:grid-cols-3">
        {services.map((service) => (
          <div key={service.title} className="site-card p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-700">Service</p>
            <h2 className="mt-3 text-xl font-semibold text-slate-950">{service.title}</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">{service.detail}</p>
            <p className="mt-4 text-lg font-semibold text-brand-900">{service.price}</p>
          </div>
        ))}
      </div>
    </PageShell>
  );
}
