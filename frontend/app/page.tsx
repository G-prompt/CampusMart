import Link from "next/link";

const featureCards = [
  { title: "Marketplace", subtitle: "Discover products, services, and daily campus deals in one clear view." },
  { title: "Vendor Hub", subtitle: "Offer a calm, professional selling experience with structure and clarity." },
  { title: "Admin Tools", subtitle: "Monitor activity, subscriptions, and support without visual clutter." },
];

const highlights = ["Fast browsing with thoughtful content hierarchy", "Clear calls to action without overwhelming the page", "A balanced, modern system built for smooth navigation"];

export default function HomePage() {
  return (
    <main className="main-container py-14 lg:py-20">
      <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div className="space-y-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm">
            <span className="h-2.5 w-2.5 rounded-full bg-accent-600"></span>
            Built for students, vendors, and teams
          </div>
          <div className="space-y-5">
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl lg:text-[3.2rem]">
              Buy, sell, and move campus life forward with CampusMart.
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-slate-600">
              Give students a dependable place to discover essentials, support local sellers, and manage transactions with clarity from first click to delivery.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/marketplace" className="inline-flex items-center justify-center rounded-full bg-brand-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700">Explore marketplace</Link>
            <Link href="/vendor/dashboard" className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-50">Vendor dashboard</Link>
          </div>
          <div className="flex flex-wrap gap-4 pt-2 text-sm text-slate-600">
            <span className="rounded-full bg-slate-100 px-3 py-1.5">Trusted experience</span>
            <span className="rounded-full bg-slate-100 px-3 py-1.5">Responsive layouts</span>
            <span className="rounded-full bg-slate-100 px-3 py-1.5">Clear product flows</span>
          </div>
        </div>
        <div className="section-shell overflow-hidden p-0">
          <div className="h-full bg-gradient-to-br from-brand-800 to-accent-600 p-8 text-white sm:p-10">
            <p className="text-sm uppercase tracking-[0.3em] text-brand-100">CampusMart Experience</p>
            <h2 className="mt-6 text-2xl font-semibold sm:text-3xl">A campus marketplace designed to feel simple, trusted, and ready for daily use.</h2>
            <p className="mt-4 max-w-xl text-sm leading-7 text-slate-200">The experience is shaped around practical student needs, with clear navigation, thoughtful product presentation, and a smoother path from browsing to action.</p>
            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="rounded-[1.35rem] bg-white/10 p-5">
                <p className="text-sm font-semibold text-white">Clear vendor tools</p>
                <p className="mt-2 text-sm text-slate-200">Keep operations simple with a more focused dashboard layout.</p>
              </div>
              <div className="rounded-[1.35rem] bg-white/10 p-5">
                <p className="text-sm font-semibold text-white">Buyer-first browsing</p>
                <p className="mt-2 text-sm text-slate-200">Support quick decisions with a more deliberate content structure.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-16 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="site-card p-7 sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-700">Why it feels more refined</p>
          <p className="mt-4 text-lg font-semibold text-slate-950">The interface now uses better hierarchy, calmer spacing, and more intentional button styling.</p>
          <ul className="mt-6 space-y-3 text-sm text-slate-600">
            {highlights.map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="mt-1 h-2.5 w-2.5 rounded-full bg-accent-600"></span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {featureCards.map((card) => (
            <div key={card.title} className="site-card p-7 transition hover:-translate-y-1 hover:shadow-soft">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-700">{card.title}</p>
              <p className="mt-4 text-[15px] leading-7 text-slate-600">{card.subtitle}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
