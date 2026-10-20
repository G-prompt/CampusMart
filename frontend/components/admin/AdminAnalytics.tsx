"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
const TOKEN = "campusmart-admin-token";

type Daily = {
  date: string;
  newBuyerAccounts: number;
  newSellerAccounts: number;
  ordersPlaced: number;
  verifiedHandoffs: number;
};
export type Analytics = {
  success: true;
  period: { days: number; from: string; through: string; timezone: string };
  summary: {
    totalUsers: number;
    totalVendors: number;
    newAccounts: number;
    activeListings: number;
    universities: number;
    activeUniversities: number;
    totalOrders: number;
    ordersPlaced: number;
    verifiedHandoffs: number;
    openVerificationCases: number;
    verificationApprovalRate: number | null;
    averageReviewHours: number | null;
  };
  daily: Daily[];
  universities: {
    id: string; name: string; shortName: string;
    users: number; sellers: number; activeListings: number; buyerOrders: number;
  }[];
  categories: { name: string; activeListings: number }[];
  verification: {
    pending: number; underReview: number; studentAction: number;
    approvedInPeriod: number; rejectedInPeriod: number;
  };
  caveat: string;
};

type Period = 7 | 30 | 90 | "all";

function useAdminAnalytics(days: Period) {
  const [data, setData] = useState<Analytics | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const token = sessionStorage.getItem(TOKEN);
    if (!token) {
      setError("Please sign in to your Admin account.");
      setLoading(false);
      return () => controller.abort();
    }
    (async () => {
      try {
        const response = await fetch(`${API}/api/admin/analytics?days=${days}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
          signal: controller.signal,
        });
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.message || "Unable to load analytics.");
        }
        if (!controller.signal.aborted) setData(result as Analytics);
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : "Unable to load analytics.");
          setData(null);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [days, refresh]);

  const reload = useCallback(() => setRefresh(value => value + 1), []);
  return { data, error, loading, reload };
}

function MetricCard({ label, value, note, href }: {
  label: string; value: string | number; note?: string; href?: string;
}) {
  const body = <>
    <p className="text-xs font-medium text-slate-500">{label}</p>
    <p className="mt-1.5 text-2xl font-black tabular-nums text-slate-950">{value}</p>
    {note && <p className="mt-1 text-[11px] text-slate-500">{note}</p>}
  </>;
  const className = "block min-w-0 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4";
  return href
    ? <Link href={href} className={`${className} transition hover:border-slate-400`}>{body}</Link>
    : <div className={className}>{body}</div>;
}

function ChartLegend({ first, second }: { first: string; second: string }) {
  return <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-600">
    <span><span className="mr-1.5 inline-block size-2.5 rounded-full bg-amber-500" />{first}</span>
    <span><span className="mr-1.5 inline-block size-2.5 rounded-full bg-slate-900" />{second}</span>
  </div>;
}

function TrendChart({ data, firstKey, secondKey, firstLabel, secondLabel, title }: {
  data: Daily[];
  firstKey: "ordersPlaced" | "newBuyerAccounts";
  secondKey: "verifiedHandoffs" | "newSellerAccounts";
  firstLabel: string; secondLabel: string; title: string;
}) {
  const w = 740, h = 224, left = 43, right = 14, top = 17, bottom = 31;
  const plotW = w - left - right, plotH = h - top - bottom;
  const highest = Math.max(1, ...data.flatMap(row => [row[firstKey], row[secondKey]]));
  const maxValue = Math.max(1, Math.ceil(highest * 1.15));
  const x = (index: number) => left + (data.length <= 1 ? plotW / 2 : index / (data.length - 1) * plotW);
  const y = (value: number) => top + (1 - value / maxValue) * plotH;
  const line = (key: typeof firstKey | typeof secondKey) => data.map((item, i) =>
    `${i === 0 ? "M" : "L"}${x(i).toFixed(2)} ${y(item[key]).toFixed(2)}`).join(" ");
  const markers = data.length <= 7 ? data.map((row, index) => ({ row, index }))
    : data.filter((_, index) => index % Math.max(1, Math.floor(data.length / 5)) === 0 || index === data.length - 1)
        .map(row => ({ row, index: data.indexOf(row) }));
  return <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <h3 className="text-sm font-black">{title}</h3>
      <ChartLegend first={firstLabel} second={secondLabel} />
    </div>
    <div className="mt-3 overflow-x-auto">
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`${title}: ${firstLabel} and ${secondLabel} by day, UTC`} className="min-w-[280px] w-full">
        <title>{title}</title>
        {[0, 0.5, 1].map((fraction) => {
          const label = Math.round(maxValue * (1 - fraction));
          const gy = top + fraction * plotH;
          return <g key={fraction}>
            <line x1={left} x2={w - right} y1={gy} y2={gy} stroke="#e2e8f0" strokeDasharray="4 5" />
            <text x={left - 8} y={gy + 4} textAnchor="end" fontSize="11" fill="#64748b">{label}</text>
          </g>;
        })}
        {data.length > 0 && <>
          <path d={line(firstKey)} stroke="#d97706" fill="none" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d={line(secondKey)} stroke="#0f172a" fill="none" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
        </>}
        {markers.map(({ row, index }) =>
          <text key={row.date} x={x(index)} y={h - 6} textAnchor="middle" fontSize="10" fill="#64748b">
            {row.date.slice(5)}
          </text>
        )}
      </svg>
    </div>
    <p className="mt-1 text-[11px] text-slate-500">Daily counts in UTC · Hover-independent, screen-reader-labelled chart</p>
  </div>;
}

function safeCell(value: string | number): string {
  let raw = String(value);
  // Defend CSV exports against spreadsheet formula injection.
  if (/^[\s]*[=+@\-]/.test(raw)) raw = "'" + raw;
  return `"${raw.replace(/"/g, '""')}"`;
}

function exportDailyCsv(data: Analytics) {
  const rows = [
    ["Date UTC", "New buyer-role accounts", "New seller-role accounts", "Orders placed", "Verified seller handoffs"],
    ...data.daily.map(row => [row.date, row.newBuyerAccounts, row.newSellerAccounts, row.ordersPlaced, row.verifiedHandoffs]),
  ];
  const csv = rows.map(row => row.map(safeCell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `campusmart-analytics-${data.period.from}-to-${data.period.through}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function TopUniversities({ data }: { data: Analytics["universities"] }) {
  return <section className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white">
    <div className="border-b border-slate-100 px-4 py-3.5">
      <h3 className="text-sm font-black">University comparison</h3>
      <p className="mt-1 text-xs text-slate-500">All universities by registered users. Orders grouped by buyer university.</p>
    </div>
    {data.length === 0 ? <p className="p-4 text-sm text-slate-500">No universities yet.</p> :
      <div className="max-h-[390px] overflow-auto"><table className="w-full min-w-[540px] text-left text-xs">
        <thead className="sticky top-0 z-10 bg-slate-50 text-slate-500"><tr>
          <th scope="col" className="px-4 py-2.5 font-semibold">University</th>
          <th scope="col" className="px-3 py-2.5 text-right font-semibold">Users</th>
          <th scope="col" className="px-3 py-2.5 text-right font-semibold">Sellers</th>
          <th scope="col" className="px-3 py-2.5 text-right font-semibold">Listings</th>
          <th scope="col" className="px-4 py-2.5 text-right font-semibold">Orders*</th>
        </tr></thead>
        <tbody className="divide-y divide-slate-100">{data.map(row => <tr key={row.id}>
          <td className="px-4 py-3 font-semibold"><Link href={`/admin/universities/${row.id}`} className="hover:underline">{row.name}</Link></td>
          <td className="px-3 py-3 text-right tabular-nums">{row.users}</td>
          <td className="px-3 py-3 text-right tabular-nums">{row.sellers}</td>
          <td className="px-3 py-3 text-right tabular-nums">{row.activeListings}</td>
          <td className="px-4 py-3 text-right tabular-nums">{row.buyerOrders}</td>
        </tr>)}</tbody>
      </table></div>}
    <p className="px-4 py-2 text-[11px] text-slate-500">*Orders created during selected period, not paid sales.</p>
  </section>;
}

function CategoryBars({ categories }: { categories: Analytics["categories"] }) {
  const largest = Math.max(1, ...categories.map(row => row.activeListings));
  return <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
    <h3 className="text-sm font-black">Active listings by category</h3>
    <p className="mt-1 text-xs text-slate-500">Current inventory, excluding archived listings.</p>
    {categories.length === 0 ? <p className="mt-4 text-sm text-slate-500">No active listings yet.</p> :
      <div className="mt-4 space-y-3">{categories.map(item => <div key={item.name}>
        <div className="mb-1 flex justify-between gap-2 text-xs"><span className="truncate font-semibold">{item.name}</span><span className="tabular-nums text-slate-500">{item.activeListings}</span></div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-slate-900" style={{width:`${Math.max(1, item.activeListings / largest * 100)}%`}} /></div>
      </div>)}</div>}
  </section>;
}

export function AnalyticsPreview() {
  const { data, loading, error } = useAdminAnalytics(30);
  if (loading) return <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">Loading platform activity...</div>;
  if (error || !data) return <div role="alert" className="rounded-xl border border-red-200 bg-white p-4 text-sm text-red-700">{error || "Analytics unavailable"}</div>;
  return <div className="space-y-3">
    <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
      <MetricCard label="New accounts · 30d" value={data.summary.newAccounts} />
      <MetricCard label="Orders placed · 30d" value={data.summary.ordersPlaced} />
      <MetricCard label="Seller handoffs · 30d" value={data.summary.verifiedHandoffs} />
      <MetricCard label="Active listings" value={data.summary.activeListings} />
    </div>
    <TrendChart data={data.daily} title="Order activity · last 30 days" firstKey="ordersPlaced" secondKey="verifiedHandoffs" firstLabel="Orders placed" secondLabel="Verified seller handoffs" />
    <div className="flex items-center justify-between gap-3"><p className="text-[11px] text-slate-500">Operational data may include test records.</p><Link href="/admin/analytics" className="text-xs font-bold text-amber-800 hover:underline">Explore analytics →</Link></div>
  </div>;
}

export function AnalyticsWorkspace() {
  const [days, setDays] = useState<Period>(30);
  const { data, error, loading, reload } = useAdminAnalytics(days);
  const totalDecisions = data ? data.verification.approvedInPeriod + data.verification.rejectedInPeriod : 0;
  const readiness = useMemo(() => data ? [
    { label: "Pending", value: data.verification.pending },
    { label: "Under review", value: data.verification.underReview },
    { label: "Student action", value: data.verification.studentAction },
  ] : [], [data]);

  return <div className="mx-auto max-w-7xl space-y-4 p-4 sm:p-6">
    <header className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-[11px] font-bold uppercase tracking-widest text-amber-700">Business intelligence</p>
        <h2 className="mt-1 text-xl font-black">Analytics & Reports</h2>
        <p className="mt-1 text-xs text-slate-500">Operational performance across the CampusMart network.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="analytics-days">Date range</label>
        <select id="analytics-days" value={days} onChange={e => setDays(e.target.value === "all" ? "all" : Number(e.target.value) as Period)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold">
          <option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option><option value="all">All time</option>
        </select>
        <button type="button" onClick={reload} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold hover:bg-slate-50">Refresh</button>
        <button type="button" disabled={!data || loading} onClick={() => data && exportDailyCsv(data)} className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-bold text-white disabled:opacity-40">Export CSV</button>
      </div>
    </header>
    {loading && !data ? <p className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500">Loading analytics...</p> : null}
    {error && <p role="alert" className="rounded-xl border border-red-200 bg-white p-4 text-sm text-red-700">{error}</p>}
    {data && !error && <>
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
        <strong>Operational data only.</strong> {data.caveat}
      </div>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <MetricCard label="New accounts" value={data.summary.newAccounts} note="During period · current account roles" />
        <MetricCard label="Orders placed" value={data.summary.ordersPlaced} note="Includes unpaid / test orders" />
        <MetricCard label="Verified seller handoffs" value={data.summary.verifiedHandoffs} note="Each seller portion counted separately" />
        <MetricCard label="Active listings" value={data.summary.activeListings} note="Current snapshot" />
        <MetricCard label="Total users" value={data.summary.totalUsers} note={`${data.summary.totalVendors} seller accounts`} />
        <MetricCard label="Active universities" value={data.summary.activeUniversities} note={`${data.summary.universities} total`} />
        <MetricCard label="Open verification cases" value={data.summary.openVerificationCases} href="/admin/verification" note="Current queue" />
        <MetricCard label="Verification approval rate" value={data.summary.verificationApprovalRate == null ? "—" : `${data.summary.verificationApprovalRate}%`} note={`${totalDecisions} decisions this period`} />
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <TrendChart data={data.daily} title="Order activity" firstKey="ordersPlaced" secondKey="verifiedHandoffs" firstLabel="Orders placed" secondLabel="Verified seller handoffs" />
        <TrendChart data={data.daily} title="Account growth" firstKey="newBuyerAccounts" secondKey="newSellerAccounts" firstLabel="Buyer-role accounts" secondLabel="Seller-role accounts" />
      </div>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <TopUniversities data={data.universities} />
        <CategoryBars categories={data.categories} />
      </div>
      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-sm font-black">Verification operations</h3><p className="text-xs text-slate-500">Queue is live; decisions and average review time use selected period.</p></div><Link href="/admin/verification" className="text-xs font-bold text-amber-800 hover:underline">Open queue →</Link></div>
        <div className="mt-3 grid grid-cols-3 gap-2">{readiness.map(item => <div key={item.label} className="rounded-lg bg-slate-50 p-3"><p className="text-[11px] text-slate-500">{item.label}</p><p className="mt-1 text-xl font-black tabular-nums">{item.value}</p></div>)}</div>
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-slate-600"><span>Approved: <strong>{data.verification.approvedInPeriod}</strong></span><span>Rejected: <strong>{data.verification.rejectedInPeriod}</strong></span><span>Avg review time: <strong>{data.summary.averageReviewHours == null ? "Not available" : `${data.summary.averageReviewHours}h`}</strong></span></div>
      </section>
      <p className="text-[11px] text-slate-500">Period {data.period.from} to {data.period.through} ({data.period.timezone}). Financial reporting and true revenue analytics will be introduced after verified wallet top-ups and reconciliation are operational.</p>
    </>}
  </div>;
}
