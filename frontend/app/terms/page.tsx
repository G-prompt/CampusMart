import PageShell from "@/components/common/PageShell";

const sections = [
  {
    title: "1. Acceptance of terms",
    body: "By using CampusMart, you agree to our community rules, payment policies, and dispute process for buyers, vendors, and administrators."
  },
  {
    title: "2. Marketplace conduct",
    body: "Students and vendors must provide accurate listings, honest pricing, and respectful communication while using the platform."
  },
  {
    title: "3. Payments and escrow",
    body: "CampusMart may hold funds in escrow until delivery is confirmed, and all fees are clearly shown before checkout."
  },
  {
    title: "4. Account responsibility",
    body: "Users are responsible for safeguarding their login details, wallet access, and transaction confirmations."
  }
];

export default function Page() {
  return (
    <PageShell title="Terms" description="Review the CampusMart rules that govern student buyers, vendors, and protected fintech transactions.">
      <div className="space-y-4">
        {sections.map((section) => (
          <div key={section.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <h2 className="text-lg font-semibold text-slate-950">{section.title}</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">{section.body}</p>
          </div>
        ))}
      </div>
    </PageShell>
  );
}
