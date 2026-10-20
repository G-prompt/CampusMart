"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AdminShell from "@/components/admin/AdminShell";
import { useCampusMartConfirm } from "@/components/common/CampusMartConfirm";
import { matchesInstitutionSearch, institutionDisplayCode } from "@/lib/institutionSearch";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
const PAGE_SIZE = 25;

type Institution = {
  id: string;
  name: string;
  shortName: string;
  state: string;
  city: string;
  active: boolean;
  featuredInSignup: boolean;
  sellerApplicationsOpen: boolean;
  studentVerificationEnabled: boolean;
  manualReviewEnabled: boolean;
  primaryVerificationSource: string;
  institutionKind: string;
};

type Change = {
  id: string;
  key: "featuredInSignup" | "sellerApplicationsOpen";
  value: boolean;
};

function verificationLabel(institution: Institution): string {
  if (!institution.studentVerificationEnabled) return "Student verification off";
  if (institution.manualReviewEnabled && institution.primaryVerificationSource !== "none") {
    return "Automatic + manual review";
  }
  if (institution.manualReviewEnabled) return "Manual review available";
  if (institution.primaryVerificationSource !== "none") return "Automatic verification configured";
  return "Verification method not configured";
}

export default function CampusSettingsPage() {
  const confirm = useCampusMartConfirm();
  const [items, setItems] = useState<Institution[]>([]);
  const [search, setSearch] = useState("");
  const [state, setState] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [change, setChange] = useState<Change | null>(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const token = sessionStorage.getItem("campusmart-admin-token") ?? "";
      const response = await fetch(`${API}/api/admin/universities`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const body = await response.json();
      if (!response.ok || !body.success || !Array.isArray(body.universities)) {
        throw new Error(body.message || "Unable to load institutions.");
      }
      setItems(body.universities);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load institutions.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setPage(1); }, [search, state]);

  const states = useMemo(
    () => [...new Set(items.map((item) => item.state).filter(Boolean))].sort(),
    [items]
  );
  const filtered = useMemo(
    () => items.filter((item) =>
      (!state || item.state === state) &&
      (!search.trim() || matchesInstitutionSearch(item, search) ||
        `${item.state} ${item.city}`.toLowerCase().includes(search.trim().toLowerCase()))
    ),
    [items, search, state]
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visible = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const featured = items.filter((item) => item.featuredInSignup).length;
  const accepting = items.filter((item) => item.sellerApplicationsOpen).length;
  const editing = change ? items.find((item) => item.id === change.id) : undefined;

  function beginChange(item: Institution, key: Change["key"]) {
    setChange({ id: item.id, key, value: !item[key] });
    setReason("");
    setNotice("");
    setError("");
  }

  async function save() {
    if (!change || !editing || reason.trim().length < 15) return;
    const isSeller = change.key === "sellerApplicationsOpen";
    const action = change.value ? "Enable" : "Disable";
    const approved = await confirm({
      title: `${action} ${isSeller ? "seller applications" : "featured placement"}?`,
      description: `${editing.name}\n\n${isSeller
        ? "Opening seller applications also enables manual student verification for this institution. Applicants must still submit approved evidence and pass review before they can sell. Closing applications does not cancel pending reviews."
        : "Featured placement changes signup search priority. It does not grant seller access or student verification."}\n\nReason: ${reason.trim()}`,
      confirmLabel: "Save change",
      danger: !change.value,
    });
    if (!approved) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const token = sessionStorage.getItem("campusmart-admin-token") ?? "";
      const response = await fetch(`${API}/api/admin/universities/${change.id}/rollout`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ [change.key]: change.value, reason: reason.trim() }),
      });
      const body = await response.json();
      if (!response.ok || !body.success) throw new Error(body.message || "Unable to save setting.");
      setChange(null);
      setReason("");
      setNotice("Campus setting saved. The change is recorded in Audit & Records.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save setting.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminShell title="Campus Settings">
      <main className="mx-auto max-w-7xl space-y-4 p-4 sm:p-6">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-amber-700">Manage institutions</p>
          <h1 className="mt-1 text-xl font-black text-slate-950">Campus signup & selling</h1>
          <p className="mt-1 text-sm text-slate-600">
            Decide which campuses appear first in signup and where students may apply to sell.
          </p>
        </div>

        <section aria-label="Access rules" className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-black">Featured in signup</h2>
              <span className="rounded-lg bg-amber-50 px-2 py-1 text-xs font-bold text-amber-900">{featured} featured</span>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-600">
              Places a campus nearer the top of search. Other active campuses remain searchable.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-black">Accept seller applications</h2>
              <span className="rounded-lg bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-900">{accepting} open</span>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-600">
              Opening applications also enables manual student verification. It does <strong>not</strong> approve an applicant automatically.
              Certified roster and API settings remain separate in <strong>Universities → Manage → Verification</strong>.
            </p>
          </div>
        </section>

        <div className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-[minmax(0,1fr)_220px]">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search campus name or abbreviation (e.g. ABSU)"
            aria-label="Search institutions"
            className="min-w-0 rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
          />
          <select
            aria-label="Filter campuses by state"
            value={state}
            onChange={(event) => setState(event.target.value)}
            className="min-w-0 rounded-lg border border-slate-200 px-3 py-2.5 text-sm"
          >
            <option value="">All states and FCT</option>
            {states.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </div>

        {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        {notice && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}

        {change && editing && (
          <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <h2 className="text-sm font-black text-slate-950">
              {change.value ? "Enable" : "Disable"} {change.key === "featuredInSignup" ? "featured placement" : "seller applications"} — {editing.name}
            </h2>
            <p className="mt-1 text-xs text-slate-700">A Super Admin reason is required and will appear in Audit & Records.</p>
            {change.key === "sellerApplicationsOpen" && !editing.studentVerificationEnabled && (
              <p className="mt-2 rounded-lg border border-amber-200 bg-white p-2 text-xs text-amber-900">
                Opening applications will enable manual student verification for this campus. Students must still submit evidence and pass review before selling.
              </p>
            )}
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={2}
              placeholder="Reason for this change (at least 15 characters)"
              className="mt-3 w-full rounded-lg border border-slate-200 bg-white p-3 text-sm"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" onClick={() => { setChange(null); setReason(""); }} className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-bold">Cancel</button>
              <button type="button" disabled={saving || reason.trim().length < 15} onClick={() => void save()} className="rounded-lg bg-slate-950 px-4 py-2 text-xs font-bold text-white disabled:opacity-40">
                {saving ? "Saving…" : "Review & save"}
              </button>
            </div>
          </section>
        )}

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 p-3 text-xs text-slate-500">
            <span>{filtered.length} matches · {items.length} campuses in directory</span>
            <button type="button" onClick={() => void load()} className="rounded-lg border border-slate-200 px-3 py-2 font-semibold text-slate-800">Refresh</button>
          </div>
          <div className="divide-y divide-slate-100">
            {loading ? <p className="p-6 text-sm text-slate-600">Loading campuses…</p>
              : visible.length === 0 ? <p className="p-6 text-sm text-slate-600">No campuses match your search. Try another state or name.</p>
              : visible.map((institution) => (
                <article key={institution.id} className="grid gap-3 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-bold text-slate-950">{institution.name}</p>
                    <p className="text-xs text-slate-500">
                      {institutionDisplayCode(institution)} · {institution.state} · {institution.institutionKind}
                    </p>
                    <div className="flex flex-wrap gap-2 text-[11px] font-medium">
                      <span className={institution.active ? "text-emerald-700" : "text-slate-500"}>
                        {institution.active ? "Buyer signup listed" : "Hidden from buyer signup"}
                      </span>
                      <span className={institution.sellerApplicationsOpen ? "text-emerald-700" : "text-slate-500"}>
                        · {institution.sellerApplicationsOpen ? "Seller applications open" : "Seller applications closed"}
                      </span>
                      <span className="text-slate-500">· {verificationLabel(institution)}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => beginChange(institution, "featuredInSignup")}
                      className={`rounded-lg border px-3 py-2 text-xs font-semibold ${institution.featuredInSignup ? "border-amber-300 bg-amber-50 text-amber-900" : "border-slate-200"}`}>
                      {institution.featuredInSignup ? "★ Featured" : "Feature"}
                    </button>
                    <button type="button" onClick={() => beginChange(institution, "sellerApplicationsOpen")}
                      className={`rounded-lg border px-3 py-2 text-xs font-semibold ${institution.sellerApplicationsOpen ? "border-emerald-300 bg-emerald-50 text-emerald-900" : "border-slate-200"}`}>
                      {institution.sellerApplicationsOpen ? "Close applications" : "Allow applications"}
                    </button>
                    <Link href={`/admin/universities/${institution.id}`}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-900 hover:bg-slate-50">
                      Manage verification
                    </Link>
                  </div>
                </article>
              ))}
          </div>
          {!loading && totalPages > 1 && (
            <div className="flex items-center justify-between gap-3 border-t border-slate-200 p-3 text-xs">
              <span>Page {safePage} of {totalPages} · {PAGE_SIZE} per page</span>
              <div className="flex gap-2">
                <button type="button" disabled={safePage === 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-lg border border-slate-200 px-3 py-2 font-bold disabled:opacity-40">Previous</button>
                <button type="button" disabled={safePage === totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} className="rounded-lg border border-slate-200 px-3 py-2 font-bold disabled:opacity-40">Next</button>
              </div>
            </div>
          )}
        </section>
      </main>
    </AdminShell>
  );
}
