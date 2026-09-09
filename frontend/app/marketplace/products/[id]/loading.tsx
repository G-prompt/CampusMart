export default function ProductLoading() {
  return (
    <main className="main-container py-10 sm:py-12 lg:py-14" role="status" aria-label="Loading product">
      <div className="h-4 w-28 animate-pulse rounded bg-slate-200" />
      <div className="mt-6 grid gap-10 lg:grid-cols-2">
        <div className="aspect-square animate-pulse rounded-xl bg-slate-200" />
        <div className="space-y-5 py-4"><div className="h-4 w-24 animate-pulse rounded bg-slate-200" /><div className="h-10 w-11/12 animate-pulse rounded bg-slate-200" /><div className="h-6 w-24 animate-pulse rounded bg-slate-200" /><div className="h-24 w-full animate-pulse rounded bg-slate-200" /><div className="h-12 w-full animate-pulse rounded bg-slate-200" /></div>
      </div>
    </main>
  );
}
