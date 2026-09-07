interface PageShellProps { title: string; description: string; children?: React.ReactNode; }

export default function PageShell({ title, description, children }: PageShellProps) {
  return (
    <main className="main-container py-12 lg:py-16">
      <section className="section-shell p-8 sm:p-10 lg:p-12">
        <div className="space-y-6">
          <div className="inline-flex items-center rounded-[10px] border border-slate-200 bg-white/80 px-4 py-1.5 text-sm font-semibold text-black shadow-sm">CampusMart</div>
          <div className="space-y-4">
            <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">{title}</h1>
            <p className="max-w-3xl text-[15px] leading-7 text-slate-600">{description}</p>
          </div>
          <div className="flex flex-wrap gap-3 pt-2">
            <a href="/marketplace" className="inline-flex items-center justify-center rounded-[10px] bg-accent-400 px-5 py-2.5 text-sm font-bold text-black transition hover:bg-accent-500">Explore marketplace</a>
            <a href="/about" className="inline-flex items-center justify-center rounded-[10px] border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-50">Learn more</a>
          </div>
          {children ? <div className="mt-8">{children}</div> : null}
        </div>
      </section>
    </main>
  );
}
