"use client";

import { useCallback, useEffect, useState } from "react";
import AdminShell from "@/components/admin/AdminShell";
import { useCampusMartConfirm } from "@/components/common/CampusMartConfirm";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
const KINDS = ["rising_star", "campus_favourite", "top_seller"] as const;
type Kind = typeof KINDS[number];
type Tab = Kind | "awarded";
const LABEL: Record<Kind, string> = { rising_star: "Rising Star", campus_favourite: "Campus Favourite", top_seller: "Top Seller" };
const DESCRIPTION: Record<Kind, string> = {
  rising_star: "Newer stores showing real traction in the last 30 days.",
  campus_favourite: "Shops chosen by many different students with strong review feedback.",
  top_seller: "Established, consistent performers with excellent buyer feedback.",
};
type Seller = { id: string; name: string; businessName: string; universityName: string | null;
  sales30?: number; buyers30?: number; sales90?: number; buyers90?: number;
  ratingCount?: number; averageRating?: number | null; eligibleNow: boolean; alreadyAwarded?: boolean;
  badge?: Kind; grantedAt?: string; checkedAt?: string; reason?: string };
type University = { id: string; name: string };
type Rule = { sales: number; buyers: number; days: number; rating: number; reviews: number };
const BADGE_COLORS: Record<Kind, string> = {
  rising_star: "border-amber-200 bg-amber-50 text-amber-900",
  campus_favourite: "border-rose-200 bg-rose-50 text-rose-900",
  top_seller: "border-violet-200 bg-violet-50 text-violet-900",
};
function fmtDate(value?: string) { return value ? new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"; }

export default function SellerRecognitionPage() {
  const confirm = useCampusMartConfirm();
  const [tab, setTab] = useState<Tab>("rising_star");
  const [universityId, setUniversityId] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [universities, setUniversities] = useState<University[]>([]);
  const [rules, setRules] = useState<Record<Kind, Rule> | null>(null);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [superAdmin, setSuperAdmin] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [draft, setDraft] = useState<{ seller: Seller; kind: Kind; active: boolean } | null>(null);
  const [reason, setReason] = useState("");
  const load = useCallback(async () => {
    const token = sessionStorage.getItem("campusmart-admin-token");
    if (!token) return;
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ mode: tab === "awarded" ? "awarded" : "candidates", kind: tab === "awarded" ? "rising_star" : tab,
        universityId, q: search, page: String(page) });
      const [response, me] = await Promise.all([
        fetch(`${API}/api/admin/seller-recognition?${params}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }),
        fetch(`${API}/api/admin/auth/me`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }),
      ]);
      const data = await response.json(); const auth = await me.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Could not load candidates.");
      setSuperAdmin(auth?.admin?.role === "super_admin"); setSellers(data.sellers || []);
      setUniversities(data.universities || []); setRules(data.rules || null); setTotal(data.total || 0);
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to load recognition candidates."); }
    finally { setLoading(false); }
  }, [tab, universityId, search, page]);
  useEffect(() => { void load(); }, [load]);
  async function changeBadge() {
    if (!draft || !superAdmin || busy || reason.trim().length < 15) return;
    const accepted = await confirm({ title: `${draft.active ? "Grant" : "Revoke"} ${LABEL[draft.kind]}`,
      description: `${draft.seller.businessName}\n\n${reason.trim()}\n\nThis decision is recorded in Audit & Records.`,
      confirmLabel: draft.active ? "Grant badge" : "Revoke badge", danger: !draft.active });
    if (!accepted) return;
    setBusy(true); setNotice(""); setError("");
    try {
      const response = await fetch(`${API}/api/admin/seller-recognition/${draft.seller.id}/badges/${draft.kind}`, {
        method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionStorage.getItem("campusmart-admin-token") || ""}` },
        body: JSON.stringify({ active: draft.active, reason: reason.trim(), confirm: "CONFIRM" }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Unable to update badge.");
      setNotice(`${LABEL[draft.kind]} ${draft.active ? "granted" : "revoked"}.`); setDraft(null); setReason(""); await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to update badge."); }
    finally { setBusy(false); }
  }
  return <AdminShell title="Seller Recognition"><main className="mx-auto max-w-7xl space-y-4 p-4 sm:p-6">
    <div><p className="text-[11px] font-bold uppercase tracking-widest text-amber-700">Campus achievement</p>
      <h2 className="text-xl font-black">Recognition candidates</h2>
      <p className="mt-1 text-sm text-slate-600">Real performance first. Admin makes the final award decision.</p></div>
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">Verified handoffs and buyer counts may still include test transactions until wallet reconciliation goes live. Candidates are advisory, not automatic awards.</div>
    <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Recognition categories">
      {[...KINDS, "awarded" as const].map(kind => <button key={kind} role="tab" aria-selected={tab === kind} onClick={() => { setTab(kind); setPage(1); setDraft(null); }}
        className={`shrink-0 rounded-xl border px-4 py-3 text-xs font-bold ${tab === kind ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-700"}`}>
        {kind === "awarded" ? "Awarded badges" : LABEL[kind]}</button>)}
    </div>
    {tab !== "awarded" && <div className={`rounded-xl border p-4 ${BADGE_COLORS[tab]}`}>
      <div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-sm">{LABEL[tab]} · Requirements</strong>
        {rules && <span className="text-xs font-bold">{rules[tab].sales}+ verified sales · {rules[tab].buyers}+ unique buyers · {rules[tab].days} days</span>}</div>
      <p className="mt-1 text-xs">{DESCRIPTION[tab]}{rules && rules[tab].reviews > 0 ? ` At least ${rules[tab].reviews} reviews averaging ${rules[tab].rating.toFixed(1)}+ stars.` : ""}</p>
    </div>}
    <div className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-[1fr_240px_auto]">
      <input aria-label="Search seller" className="min-w-0 rounded-lg border p-2.5 text-sm" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Find seller or store" />
      <select aria-label="University" className="min-w-0 rounded-lg border p-2.5 text-sm" value={universityId} onChange={e => { setUniversityId(e.target.value); setPage(1); }}><option value="">All universities</option>{universities.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
      <button className="rounded-lg border px-4 py-2 text-xs font-bold" onClick={() => void load()}>Refresh</button>
    </div>
    {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {notice && <p role="status" className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">{notice}</p>}
    {draft && <section className="rounded-xl border border-amber-300 bg-white p-4">
      <p className="text-sm font-black">{draft.active ? "Grant" : "Revoke"} {LABEL[draft.kind]} · {draft.seller.businessName}</p>
      <p className="mt-1 text-xs text-slate-600">Explain your decision. An existing badge can be revoked even when a seller is no longer eligible.</p>
      <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} className="mt-3 w-full rounded-lg border p-3 text-sm" placeholder="Mandatory audit reason (15+ characters)" />
      <div className="flex gap-2"><button className="rounded-lg border px-4 py-2 text-xs font-bold" onClick={() => setDraft(null)}>Cancel</button>
        <button disabled={busy || reason.trim().length < 15} onClick={() => void changeBadge()} className="rounded-lg bg-slate-950 px-4 py-2 text-xs font-bold text-white disabled:opacity-40">Review decision</button></div>
    </section>}
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex justify-between border-b px-4 py-3"><h3 className="text-sm font-black">{tab === "awarded" ? "Currently awarded" : `Eligible for ${LABEL[tab]}`}</h3><span className="text-xs text-slate-500">{total} records</span></div>
      {loading ? <p className="p-8 text-sm text-slate-500">Checking performance…</p> : sellers.length === 0 ?
        <p className="p-8 text-center text-sm text-slate-500">No eligible sellers in this category yet. Accounts with zero verified sales do not appear here.</p> :
        <div className="divide-y divide-slate-100">{sellers.map((seller, index) => <article key={`${seller.id}-${seller.badge || tab}-${index}`} className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h4 className="text-sm font-black">{seller.businessName}</h4>
            {tab === "awarded" && seller.badge && <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-bold text-amber-900">★ {LABEL[seller.badge]}</span>}
            {tab === "awarded" && !seller.eligibleNow && <span className="rounded-full bg-red-50 px-2 py-1 text-[11px] text-red-700">Review eligibility</span>}
            {seller.alreadyAwarded && <span className="rounded-full bg-green-50 px-2 py-1 text-[11px] text-green-800">Already awarded</span>}</div>
            <p className="mt-1 text-xs text-slate-500">{seller.name} · {seller.universityName || "Other institutions"}</p>
            {tab === "awarded" ? <p className="mt-1 text-xs text-slate-500">Awarded {fmtDate(seller.grantedAt)} · {seller.reason}</p> :
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-700">
                <span><b>{tab === "rising_star" ? seller.sales30 : seller.sales90}</b> verified sales</span>
                <span><b>{tab === "rising_star" ? seller.buyers30 : seller.buyers90}</b> different buyers</span>
                <span><b>{seller.averageRating === null ? "—" : seller.averageRating?.toFixed(1)}</b> average rating ({seller.ratingCount} reviews)</span>
                <span>Checked {fmtDate(seller.checkedAt)}</span>
              </div>}
          </div>
          {superAdmin && (tab === "awarded" ? seller.badge &&
            <button className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700" onClick={() => { setDraft({ seller, kind: seller.badge!, active: false }); setReason(""); }}>Review / revoke</button>
            : !seller.alreadyAwarded && <button className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-bold text-white" onClick={() => { setDraft({ seller, kind: tab, active: true }); setReason(""); }}>Review for award</button>)}
        </article>)}</div>}
    </section>
    <div className="flex items-center justify-between text-xs text-slate-500"><span>Page {page} · {total} results</span><div className="flex gap-2"><button className="rounded-lg border bg-white px-3 py-2 disabled:opacity-40" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</button><button className="rounded-lg border bg-white px-3 py-2 disabled:opacity-40" disabled={page * 20 >= total} onClick={() => setPage(p => p + 1)}>Next</button></div></div>
  </main></AdminShell>;
}
