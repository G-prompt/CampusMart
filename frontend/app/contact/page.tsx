import PageShell from "@/components/common/PageShell";

const contactOptions = [
  {
    title: "Support desk",
    body: "For order issues, wallet questions, or disputes, reach the CampusMart support team directly."
  },
  {
    title: "Vendor inquiries",
    body: "If you are onboarding a student business or campus brand, use the contact page to request a walkthrough."
  },
  {
    title: "Campus partnerships",
    body: "Schools, clubs, and residence associations can connect with the CampusMart team for pilot programs."
  }
];

export default function Page() {
  return (
    <PageShell title="Contact" description="Reach the CampusMart team for support, vendor onboarding, and campus partnerships.">
      <div className="space-y-4">
        {contactOptions.map((option) => (
          <div key={option.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <h2 className="text-lg font-semibold text-slate-950">{option.title}</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">{option.body}</p>
          </div>
        ))}
      </div>
    </PageShell>
  );
}
