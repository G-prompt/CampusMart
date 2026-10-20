import PageShell from "@/components/common/PageShell";

const helpTopics = [
  {
    title:
      "Buying on CampusMart",

    body:
      "Browse available listings, save products, add items to your cart, place an order and coordinate the campus handoff through CampusMart.",
  },

  {
    title:
      "Selling on CampusMart",

    body:
      "Use the same CampusMart account you already have. Complete seller setup, publish listings, manage orders and keep buyer conversations in one place.",
  },

  {
    title:
      "Payments",

    body:
      "Online payment integration is not live yet. Current checkout creates the order and seller fulfilment record while payment remains pending.",
  },

  {
    title:
      "Messages and handoffs",

    body:
      "Keep order and listing conversations inside CampusMart. Seller access to private fulfilment details is controlled separately from normal marketplace messaging.",
  },
];

export default function Page() {
  return (
    <PageShell
      title="Help"
      description="Clear guidance for buying, selling, messaging and completing campus orders."
    >
      <div className="grid gap-4 md:grid-cols-2">
        {helpTopics.map(
          (
            topic
          ) => (
            <article
              key={
                topic.title
              }
              className="site-card p-6"
            >
              <h2 className="text-lg font-bold text-slate-950">
                {
                  topic.title
                }
              </h2>

              <p className="mt-2 text-sm leading-7 text-slate-600">
                {
                  topic.body
                }
              </p>
            </article>
          )
        )}
      </div>
    </PageShell>
  );
}