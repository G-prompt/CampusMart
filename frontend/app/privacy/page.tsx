import PageShell from "@/components/common/PageShell";

const bullets = [
  "We collect your name, email, school details, and wallet activity only to power the marketplace experience.",
  "Your payment information is handled through a secure fintech layer and is never stored in plain text in the demo interface.",
  "We use your data to improve buyer-vendor matching, fraud prevention, and protected checkout experiences."
];

export default function Page() {
  return (
    <PageShell title="Privacy" description="Review how CampusMart handles student account information, wallet activity, and protected payments.">
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
        <h2 className="text-lg font-semibold text-slate-950">What we protect</h2>
        <ul className="mt-4 space-y-3 text-sm leading-7 text-slate-600">
          {bullets.map((bullet) => (
            <li key={bullet} className="flex gap-3"><span className="mt-2 h-2.5 w-2.5 rounded-full bg-brand-700" /><span>{bullet}</span></li>
          ))}
        </ul>
      </div>
    </PageShell>
  );
}
