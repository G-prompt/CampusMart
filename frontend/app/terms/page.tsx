import PageShell from "@/components/common/PageShell";

const sections = [
  {
    title:
      "1. Acceptance of terms",

    body:
      "By using CampusMart, you agree to the marketplace rules and account requirements that apply to buyers and sellers.",
  },

  {
    title:
      "2. Marketplace conduct",

    body:
      "Users must provide accurate listing information, communicate respectfully and avoid misleading buyers or sellers about products, prices or fulfilment.",
  },

  {
    title:
      "3. Orders and current payment status",

    body:
      "CampusMart can create and track marketplace orders and seller fulfilment. Online payment integration is not live yet, so an order may remain in a pending payment state until payment functionality is introduced.",
  },

  {
    title:
      "4. Campus handoff",

    body:
      "Buyers and sellers may coordinate physical campus handoffs through CampusMart. Order completion and private fulfilment information are handled separately from ordinary marketplace messaging.",
  },

  {
    title:
      "5. Account responsibility",

    body:
      "Users are responsible for protecting their sign-in details and for keeping their account, university and seller information accurate.",
  },
];

export default function Page() {
  return (
    <PageShell
      title="Terms"
      description="Review the current CampusMart marketplace and account rules."
    >
      <div className="space-y-4">
        {sections.map(
          (
            section
          ) => (
            <section
              key={
                section.title
              }
              className="site-card p-5"
            >
              <h2 className="text-lg font-bold text-slate-950">
                {
                  section.title
                }
              </h2>

              <p className="mt-2 text-sm leading-7 text-slate-600">
                {
                  section.body
                }
              </p>
            </section>
          )
        )}
      </div>
    </PageShell>
  );
}