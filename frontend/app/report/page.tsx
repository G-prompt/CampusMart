"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import PageShell from "@/components/common/PageShell";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

const reasons = [
  ["suspected_fraud", "Suspected scam or fraud"],
  ["non_delivery", "Order not handed over"],
  ["misleading_listing", "Misleading product description"],
  ["harassment", "Harassment or bullying"],
  ["unsafe_meetup", "Threats or unsafe meetup"],
  ["prohibited_item", "Prohibited or unsafe item"],
  ["impersonation", "Fake identity or impersonation"],
  ["privacy_violation", "Personal information shared without permission"],
  ["payment_dispute", "Payment or refund concern"],
  ["other", "Something else"],
] as const;

type ReportType = "user" | "product" | "order";
type Target = {
  targetType: ReportType;
  targetId: string;
  targetLabel: string;
  secondaryLabel: string | null;
};

const typeLabel: Record<ReportType, string> = {
  user: "Seller / account",
  product: "Listing",
  order: "Order",
};

export default function ReportMarketplacePage() {
  const [context, setContext] = useState<Target | null>(null);
  const [contextLoading, setContextLoading] = useState(true);
  const [contextError, setContextError] = useState("");
  const [category, setCategory] = useState<string>("suspected_fraud");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function loadContext() {
      const params = new URLSearchParams(window.location.search);
      const targetType = params.get("targetType");
      const targetId = params.get("targetId");
      if (!targetId || !["user", "product", "order"].includes(targetType || "")) {
        if (!cancelled) {
          setContextError("To report a concern, open the seller, listing or order and select Report.");
          setContextLoading(false);
        }
        return;
      }
      try {
        const token = localStorage.getItem("campusmart-token");
        if (!token) throw new Error("Please sign in to report a concern.");
        const query = new URLSearchParams({ targetType: targetType!, targetId });
        const response = await fetch(`${API}/api/marketplace/reports/target?${query}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.message || "Report target not found.");
        if (!cancelled) setContext(data as Target);
      } catch (cause) {
        if (!cancelled) setContextError(cause instanceof Error ? cause.message : "Unable to load report details.");
      } finally {
        if (!cancelled) setContextLoading(false);
      }
    }
    void loadContext();
    return () => { cancelled = true; };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!context || busy) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const token = localStorage.getItem("campusmart-token");
      if (!token) throw new Error("Sign in before submitting a report.");
      const response = await fetch(`${API}/api/marketplace/reports`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          targetType: context.targetType,
          targetId: context.targetId,
          category,
          details: details.trim(),
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.message || "Unable to send report.");
      setSuccess("Your report has been received. Our safety team will review it.");
      setDetails("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to send report.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell title="Report a concern" description="Help us keep CampusMart safe. Your report goes privately to the authorised team.">
      <div className="mx-auto max-w-xl pb-28">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          {contextLoading ? (
            <p role="status" className="text-sm text-slate-600">Loading report details…</p>
          ) : contextError ? (
            <div className="space-y-4">
              <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{contextError}</p>
              <Link href="/marketplace" className="inline-flex rounded-lg bg-slate-950 px-4 py-2 text-sm font-bold text-white">Browse marketplace</Link>
            </div>
          ) : context && (
            <>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Reporting {typeLabel[context.targetType]}</p>
                <p className="mt-1 break-words text-sm font-black text-slate-950">{context.targetLabel}</p>
                {context.secondaryLabel && <p className="mt-0.5 text-xs text-slate-600">{context.secondaryLabel}</p>}
                <p className="mt-2 text-[11px] text-slate-500">Linked automatically — you cannot change the reported item here.</p>
              </div>
              <p className="my-4 text-xs leading-5 text-slate-600">We determine report priority using the issue type, independent reports and the evidence. Reporting never automatically suspends someone.</p>
              {error && <p role="alert" className="mb-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
              {success && <p role="status" className="mb-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{success}</p>}
              <form onSubmit={submit} className="space-y-4">
                <label className="block text-sm font-bold text-slate-900">
                  What happened?
                  <select required value={category} onChange={event => setCategory(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm">
                    {reasons.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                </label>
                <label className="block text-sm font-bold text-slate-900">
                  Tell us what happened
                  <textarea required minLength={20} maxLength={2000} rows={4} value={details} onChange={event => setDetails(event.target.value)} className="mt-1.5 w-full resize-y rounded-xl border border-slate-200 px-3 py-3 text-sm font-normal" placeholder="Include what happened and when. Do not share passwords, card details or private ID documents." />
                  <span className="mt-1 flex justify-between text-[11px] font-normal text-slate-500"><span>At least 20 characters</span><span>{details.length}/2000</span></span>
                </label>
                <button disabled={busy || details.trim().length < 20 || Boolean(success)} className="w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40">{busy ? "Sending report…" : success ? "Report sent" : "Submit report"}</button>
              </form>
              {success && <Link href="/marketplace" className="mt-4 inline-block text-sm font-semibold text-slate-700 underline">Return to marketplace</Link>}
            </>
          )}
        </section>
      </div>
    </PageShell>
  );
}
