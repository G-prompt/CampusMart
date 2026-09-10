export default function FavouritesLoading() {
  return (
    <main className="main-container py-12" role="status" aria-label="Loading saved listings">
      <div className="section-shell p-8"><div className="h-8 w-40 animate-pulse rounded bg-slate-200" /><div className="mt-3 h-4 w-72 animate-pulse rounded bg-slate-200" /><div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 3 }, (_, index) => <div key={index} className="overflow-hidden rounded-xl border border-slate-200"><div className="aspect-[4/3] animate-pulse bg-slate-200" /><div className="space-y-3 p-4"><div className="h-4 w-20 animate-pulse rounded bg-slate-200" /><div className="h-5 w-10/12 animate-pulse rounded bg-slate-200" /><div className="h-5 w-1/3 animate-pulse rounded bg-slate-200" /></div></div>)}</div></div>
    </main>
  );
}
