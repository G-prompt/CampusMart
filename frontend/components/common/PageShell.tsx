interface PageShellProps {
  title: string;
  description: string;
  children?: React.ReactNode;
  actions?: React.ReactNode;
}

export default function PageShell({
  title,
  description,
  children,
  actions,
}: PageShellProps) {
  return (
    <main className="main-container py-12 lg:py-16">
      <section className="section-shell p-8 sm:p-10 lg:p-12">
        <div className="space-y-6">
          <div className="inline-flex items-center rounded-[10px] border border-slate-200 bg-white/80 px-4 py-1.5 text-sm font-semibold text-black shadow-sm">
            CampusMart
          </div>

          <div className="space-y-4">
            <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
              {title}
            </h1>

            <p className="max-w-3xl text-[15px] leading-7 text-slate-600">
              {description}
            </p>
          </div>

          {actions ? (
            <div className="flex flex-wrap gap-3 pt-2">
              {actions}
            </div>
          ) : null}

          {children ? (
            <div className="mt-8">
              {children}
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}