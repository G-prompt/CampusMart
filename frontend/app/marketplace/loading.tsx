function SkeletonCard() {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white" aria-hidden="true">
      <div className="aspect-[4/3] animate-pulse bg-slate-200" />
      <div className="space-y-3 p-4">
        <div className="h-4 w-20 animate-pulse rounded bg-slate-200" />
        <div className="h-5 w-11/12 animate-pulse rounded bg-slate-200" />
        <div className="h-5 w-1/3 animate-pulse rounded bg-slate-200" />
      </div>
    </div>
  );
}

export default function MarketplaceLoading() {
  return (
    <main className="main-container py-10 sm:py-12 lg:py-14" role="status" aria-label="Loading marketplace listings">
      <div className="flex gap-2.5">
        {["w-14", "w-20", "w-16", "w-24", "w-28"].map((width) => <div key={width} className={`${width} h-9 animate-pulse rounded-[10px] bg-slate-200`} />)}
      </div>
      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => <SkeletonCard key={index} />)}
      </div>
    </main>
  );
}