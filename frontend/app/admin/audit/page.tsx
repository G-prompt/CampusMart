"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AdminShell from "@/components/admin/AdminShell";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
const TOKEN = "campusmart-admin-token";

type AuditEvent = {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  reason: string | null;
  beforeState: string | null;
  afterState: string | null;
  outcome: string;
  createdAt: string;
  actor: { name: string; email: string; role: string };
};
const nameFor = (value: string) => value.replace(/[_\.]/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/\b\w/g, char => char.toUpperCase());
const sensitive = /token|password|secret|hash|cipher|credential|authorization|privateKey|apiKey/i;

function readable(value: unknown): string {
  if (value == null || value === "") return "Not set";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string") return nameFor(value);
  if (Array.isArray(value)) return `${value.length} items`;
  if (typeof value === "object") return "Record changed";
  return String(value);
}
function snapshot(value: string | null) {
  if (!value?.trim()) return [] as { label: string; value: string }[];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return [{ label: "Value", value: readable(parsed) }];
    }
    return Object.entries(parsed as Record<string, unknown>)
      .filter(([key]) => !sensitive.test(key))
      .slice(0, 18)
      .map(([key, item]) => ({ label: nameFor(key), value: readable(item) }));
  } catch {
    return [{ label: "Summary", value: value.length > 300 ? `${value.slice(0, 300)}…` : value }];
  }
}
function RecordSummary({ title, value }: { title: string; value: string | null }) {
  const rows = snapshot(value);
  return <div className="rounded-lg border border-slate-200 bg-white p-3">
    <p className="text-xs font-black text-slate-900">{title}</p>
    {rows.length === 0 ? <p className="mt-2 text-xs text-slate-500">No recorded state</p> :
      <dl className="mt-2 space-y-2">{rows.map((row, index) =>
        <div key={`${row.label}-${index}`} className="flex flex-wrap justify-between gap-x-4 gap-y-0.5 text-xs">
          <dt className="text-slate-500">{row.label}</dt>
          <dd className="max-w-full break-words font-semibold text-slate-900">{row.value}</dd>
        </div>
      )}</dl>}
  </div>;
}

export default function AdminAudit() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [targetType, setTargetType] = useState("");
  const [next, setNext] = useState<string | null>(null);
  const [pageCursors, setPageCursors] = useState<(string | null)[]>([null]);
  const [pageIndex, setPageIndex] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async (cursor: string | null) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ limit: "30" });
      if (cursor) params.set("cursor", cursor);
      if (targetType) params.set("targetType", targetType);
      const token = sessionStorage.getItem(TOKEN) || "";
      const response = await fetch(`${API}/api/admin/audit?${params}`, {
        headers: { Authorization: `Bearer ${token}` }, cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Unable to load audit events.");
      setEvents(Array.isArray(data.events) ? data.events : []);
      setNext(data.nextCursor || null);
      setExpanded(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load audit events.");
    } finally { setLoading(false); }
  }, [targetType]);

  useEffect(() => {
    setPageCursors([null]);
    setPageIndex(0);
    void load(null);
  }, [load]);

  const shown = useMemo(() => {
    const query = search.toLowerCase().trim();
    if (!query) return events;
    return events.filter(item => `${item.actor.name} ${item.actor.email} ${item.action} ${item.targetType} ${item.targetId} ${item.reason || ""}`.toLowerCase().includes(query));
  }, [events, search]);

  const nextPage = () => {
    if (!next || loading) return;
    setPageCursors(previous => [...previous.slice(0, pageIndex + 1), next]);
    setPageIndex(previous => previous + 1);
    void load(next);
  };
  const previousPage = () => {
    if (pageIndex < 1 || loading) return;
    const index = pageIndex - 1;
    setPageIndex(index);
    void load(pageCursors[index] || null);
  };

  return <AdminShell title="Audit & Records">
    <main className="mx-auto max-w-6xl space-y-4 p-4 sm:p-6">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-widest text-amber-700">Super Admin · Read-only</p>
        <h1 className="mt-1 text-xl font-black">Audit & Records</h1>
        <p className="mt-1 text-xs text-slate-600">Who acted, what changed and why. Audit history is preserved.</p>
      </div>
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex flex-wrap gap-2 border-b p-3">
          <input aria-label="Search this audit page" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search this page…" className="min-w-40 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm" />
          <select aria-label="Audit module" value={targetType} onChange={event => setTargetType(event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
            <option value="">All modules</option>
            <option value="university">Universities</option>
            <option value="verification_appeal">Verification</option>
            <option value="marketplace_case">Safety cases</option>
            <option value="user">Accounts</option>
            <option value="product">Listings</option>
          </select>
          <button onClick={() => void load(pageCursors[pageIndex] || null)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold">Refresh</button>
        </div>
        {error ? <p role="alert" className="p-5 text-sm text-red-700">{error}</p> : loading ?
          <p role="status" className="p-6 text-sm text-slate-500">Loading records…</p> : shown.length === 0 ?
          <p className="p-8 text-center text-sm text-slate-500">No records match this view.</p> :
          <div className="divide-y divide-slate-100">
            {shown.map(item => <article key={item.id} className="p-3 sm:p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-black text-slate-950">{nameFor(item.action)}</h2>
                  <p className="mt-1 text-xs text-slate-600">{item.actor.name} · {new Date(item.createdAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500">{nameFor(item.targetType)} · {item.targetId}</p>
                </div>
                <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${item.outcome === "success" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>{nameFor(item.outcome)}</span>
                <button aria-expanded={expanded === item.id} onClick={() => setExpanded(expanded === item.id ? null : item.id)} className="rounded-lg border px-3 py-2 text-xs font-bold">{expanded === item.id ? "Close" : "View changes"}</button>
              </div>
              {expanded === item.id && <div className="mt-3 space-y-3 rounded-xl bg-slate-50 p-3">
                <div className="text-xs"><strong>Responsible admin:</strong> {item.actor.name} ({item.actor.email})</div>
                <div className="text-xs"><strong>Reason:</strong> {item.reason?.trim() || "Routine operation"}</div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <RecordSummary title="Before" value={item.beforeState} />
                  <RecordSummary title="After" value={item.afterState} />
                </div>
                <p className="text-[11px] text-slate-500">This is a readable summary of the saved audit snapshots, not an editable record.</p>
              </div>}
            </article>)}
          </div>}
        <div className="flex items-center justify-between border-t p-3 text-xs text-slate-500">
          <span>Page {pageIndex + 1} · {events.length} records loaded</span>
          <div className="flex gap-2">
            <button disabled={pageIndex === 0 || loading} onClick={previousPage} className="rounded-lg border px-3 py-1.5 font-semibold disabled:opacity-30">Previous</button>
            <button disabled={!next || loading} onClick={nextPage} className="rounded-lg border px-3 py-1.5 font-semibold disabled:opacity-30">Next</button>
          </div>
        </div>
      </section>
    </main>
  </AdminShell>;
}
