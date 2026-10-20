
"use client";

import { useCallback, useEffect, useState } from "react";
import AdminShell from "@/components/admin/AdminShell";
import { useCampusMartConfirm } from "@/components/common/CampusMartConfirm";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

type Tab = "cases" | "sellers" | "listings";

type Case = {
  id: string;
  targetType: "user" | "product" | "order";
  targetId: string;
  targetLabel: string | null;
  highestSeverity: string;
  reportCount: number;
  priority: string;
  priorityScore: number;
  status: string;
  lastReportedAt: string;
  universityId: string | null;
};

type Report = {
  id: string;
  category: string;
  severity: string;
  details: string;
  createdAt: string;
  reporter: { id: string; name: string };
};

type CaseDetail = Case & {
  reports: Report[];
  resolutionNote: string | null;
};

type Seller = {
  id: string;
  name: string;
  accountSuspendedAt: string | null;
  accountFlaggedAt: string | null;
  university: { name: string } | null;
  vendorProfile: {
    businessName: string;
    accessStatus: string;
    verified: boolean;
  } | null;
  studentVerificationStatus: string;
  sellerBadges: { kind: string }[];
};

type Listing = {
  id: number;
  title: string;
  category: string;
  price: number;
  isArchived: boolean;
  moderationHiddenAt: string | null;
  vendor: {
    id: string;
    name: string;
    vendorProfile: { businessName: string } | null;
  };
};

type University = {
  id: string;
  name: string;
};

type Action =
  | "flag"
  | "clear_flag"
  | "restrict_selling"
  | "suspend_selling"
  | "restore_selling"
  | "suspend_account"
  | "restore_account"
  | "hide_listing"
  | "restore_listing";

const ACTIONS_BY_TARGET: Record<Case["targetType"], Action[]> = {
  user: [
    "flag",
    "clear_flag",
    "restrict_selling",
    "suspend_selling",
    "restore_selling",
    "suspend_account",
    "restore_account",
  ],
  product: ["hide_listing", "restore_listing"],
  order: [],
};

const ACTION_LABEL: Record<Action, string> = {
  flag: "Flag for review",
  clear_flag: "Remove account flag",
  restrict_selling: "Restrict selling",
  suspend_selling: "Suspend selling",
  restore_selling: "Restore selling access",
  suspend_account: "Suspend entire account",
  restore_account: "Restore account",
  hide_listing: "Hide listing",
  restore_listing: "Restore listing",
};

const priorityClass = (value: string) =>
  value === "critical"
    ? "bg-red-100 text-red-800"
    : value === "high"
      ? "bg-orange-100 text-orange-800"
      : value === "medium"
        ? "bg-amber-100 text-amber-800"
        : "bg-slate-100 text-slate-700";

const dateTime = (d: string) =>
  new Date(d).toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });

const format = (s: string) =>
  s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

// ASCII-safe source. JavaScript renders the correct Unicode characters.
const SEPARATOR = " \u00B7 ";
const STAR = "\u2605";
const NAIRA = "\u20A6";
const ELLIPSIS = "\u2026";

export default function AdminMarketplacePage() {
  const confirm = useCampusMartConfirm();

  const [tab, setTab] = useState<Tab>("cases");
  const [cases, setCases] = useState<Case[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [universities, setUniversities] = useState<University[]>([]);
  const [status, setStatus] = useState("open");
  const [universityId, setUniversityId] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [detail, setDetail] = useState<CaseDetail | null>(null);

  const [draft, setDraft] = useState<{
    id: string;
    action: string;
    isStatus: boolean;
  } | null>(null);

  const [reason, setReason] = useState("");
  const [ackOpenOrders, setAckOpenOrders] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [superAdmin, setSuperAdmin] = useState(false);

  const headers = () => ({
    Authorization: `Bearer ${
      sessionStorage.getItem("campusmart-admin-token") || ""
    }`,
  });

  const load = useCallback(async () => {
    const token = sessionStorage.getItem("campusmart-admin-token");
    if (!token) return;

    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({ page: String(page) });

      if (tab === "cases") {
        if (status) params.set("status", status);
        if (universityId) params.set("universityId", universityId);
      } else {
        if (q) params.set("q", q);
        if (universityId && tab === "sellers") {
          params.set("universityId", universityId);
        }
      }

      const [response, who] = await Promise.all([
        fetch(`${API}/api/admin/marketplace/${tab}?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        }),
        fetch(`${API}/api/admin/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        }),
      ]);

      const data = await response.json();
      const me = await who.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Unable to load marketplace operations."
        );
      }

      setSuperAdmin(me?.admin?.role === "super_admin");
      setTotal(data.total || 0);

      if (tab === "cases") {
        setCases(data.cases || []);
        setUniversities(data.universities || []);
      }

      if (tab === "sellers") {
        setSellers(data.sellers || []);
      }

      if (tab === "listings") {
        setListings(data.listings || []);
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Unable to load marketplace data."
      );
    } finally {
      setLoading(false);
    }
  }, [tab, page, status, q, universityId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function openCase(id: string) {
    setError("");
    setDetail(null);

    try {
      const r = await fetch(
        `${API}/api/admin/marketplace/cases/${id}`,
        {
          headers: headers(),
          cache: "no-store",
        }
      );

      const data = await r.json();

      if (!r.ok || !data.success) {
        throw new Error(data.message || "Could not load reports.");
      }

      setDetail(data.case);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not load case details."
      );
    }
  }

  async function execute() {
    if (!draft || busy || reason.trim().length < 15) return;

    const accepted = await confirm({
      title: draft.isStatus
        ? `Change case to ${format(draft.action)}`
        : ACTION_LABEL[draft.action as Action],
      description: `Reason: ${reason.trim()}\n\nRestricted or suspended users may be unable to complete existing order handoffs. Review outstanding orders before confirming. This decision will be recorded under Audit & Records.`,
      danger: /suspend|restrict|hide|dismiss/.test(draft.action),
      confirmLabel: "Confirm and record",
    });

    if (!accepted) return;

    setBusy(true);
    setError("");
    setNotice("");

    try {
      const route = draft.isStatus
        ? `/cases/${draft.id}`
        : `/cases/${draft.id}/actions`;

      const response = await fetch(
        `${API}/api/admin/marketplace${route}`,
        {
          method: draft.isStatus ? "PATCH" : "POST",
          headers: {
            ...headers(),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            ...(draft.isStatus
              ? { status: draft.action }
              : { action: draft.action }),
            reason: reason.trim(),
            confirm: "CONFIRM",
            acknowledgeOpenOrders: ackOpenOrders,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Operation failed.");
      }

      setNotice("Action recorded successfully.");
      setDraft(null);
      setReason("");
      setAckOpenOrders(false);

      if (detail) await openCase(detail.id);
      await load();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Operation failed."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell title="Marketplace">
      <main className="mx-auto max-w-7xl space-y-4 p-4 sm:p-6">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-amber-700">
            Trust & marketplace operations
          </p>

          <h2 className="text-xl font-black">
            Marketplace Management
          </h2>

          <p className="mt-1 text-sm text-slate-600">
            Prioritised reports and linked seller/listing records.
            Any enforcement requires an investigated case and a
            recorded reason.
          </p>
        </div>

        <div
          className="flex flex-wrap gap-2"
          role="tablist"
          aria-label="Marketplace management views"
        >
          {(["cases", "sellers", "listings"] as Tab[]).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              onClick={() => {
                setTab(t);
                setPage(1);
                setDetail(null);
                setDraft(null);
              }}
              className={`rounded-lg px-4 py-2.5 text-xs font-bold ${
                tab === t
                  ? "bg-slate-950 text-white"
                  : "border border-slate-200 bg-white text-slate-700"
              }`}
            >
              {t === "cases"
                ? "Reports & Safety"
                : t === "sellers"
                  ? "Seller directory"
                  : "Listings"}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-white p-3">
          {tab === "cases" ? (
            <>
              <select
                aria-label="Case status"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
                className="rounded-lg border px-3 py-2 text-xs"
              >
                <option value="">All statuses</option>
                {[
                  "open",
                  "investigating",
                  "action_taken",
                  "dismissed",
                  "closed",
                ].map((v) => (
                  <option key={v} value={v}>
                    {format(v)}
                  </option>
                ))}
              </select>

              <select
                aria-label="University"
                value={universityId}
                onChange={(e) => {
                  setUniversityId(e.target.value);
                  setPage(1);
                }}
                className="max-w-64 rounded-lg border px-3 py-2 text-xs"
              >
                <option value="">All universities</option>
                {universities.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </>
          ) : (
            <input
              aria-label="Search"
              placeholder={
                tab === "sellers"
                  ? "Find seller or store"
                  : "Find product title"
              }
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm"
            />
          )}

          <button
            onClick={() => void load()}
            className="rounded-lg border px-4 py-2 text-xs font-bold"
          >
            Refresh
          </button>

          <span className="ml-auto text-xs text-slate-500">
            {total} records
          </span>
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
          >
            {error}
          </p>
        )}

        {notice && (
          <p
            role="status"
            className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800"
          >
            {notice}
          </p>
        )}

        {draft && (
          <section className="rounded-xl border border-amber-200 bg-white p-4">
            <p className="text-sm font-black">
              Review:{" "}
              {draft.isStatus
                ? format(draft.action)
                : ACTION_LABEL[draft.action as Action]}
            </p>

            <p className="mt-1 text-xs text-slate-600">
              Explain what evidence supports this decision.
              Suspensions require a Super Admin.
            </p>

            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-3 w-full rounded-lg border p-3 text-sm"
              placeholder="Mandatory audit reason (15-2000 characters)"
            />

            {!draft.isStatus &&
              /suspend|restrict/.test(draft.action) && (
                <label className="my-3 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
                  <input
                    type="checkbox"
                    checked={ackOpenOrders}
                    onChange={(event) =>
                      setAckOpenOrders(event.target.checked)
                    }
                    className="mt-0.5"
                  />

                  <span>
                    I have checked the impact this action may have
                    on outstanding buyer orders and seller handoffs.
                    If any orders are open, I explicitly acknowledge
                    that risk.
                  </span>
                </label>
              )}

            <div className="flex gap-2">
              <button
                className="rounded-lg border px-4 py-2 text-xs font-bold"
                onClick={() => {
                  setDraft(null);
                  setAckOpenOrders(false);
                }}
              >
                Cancel
              </button>

              <button
                disabled={busy || reason.trim().length < 15}
                onClick={() => void execute()}
                className="rounded-lg bg-slate-950 px-4 py-2 text-xs font-bold text-white disabled:opacity-40"
              >
                Review & confirm
              </button>
            </div>
          </section>
        )}

        <section className="overflow-hidden rounded-xl border bg-white">
          {loading ? (
            <p className="p-8 text-sm text-slate-500">
              Loading{ELLIPSIS}
            </p>
          ) : tab === "cases" ? (
            cases.length === 0 ? (
              <p className="p-8 text-center text-sm text-slate-500">
                No reports match the selected filters.
              </p>
            ) : (
              <div className="divide-y">
                {cases.map((c) => (
                  <div
                    key={c.id}
                    className="flex flex-wrap items-center justify-between gap-3 p-4"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-2 py-1 text-[11px] font-bold uppercase ${priorityClass(
                            c.priority
                          )}`}
                        >
                          {c.priority}
                        </span>

                        <strong className="text-sm">
                          {c.targetLabel ||
                            `${c.targetType} ${c.targetId.slice(
                              0,
                              12
                            )}`}
                        </strong>

                        <span className="text-xs text-slate-500">
                          {format(c.targetType)}
                          {SEPARATOR}
                          {format(c.status)}
                        </span>
                      </div>

                      <p className="mt-1 text-xs text-slate-600">
                        {c.reportCount} distinct reporter
                        {c.reportCount === 1 ? "" : "s"}
                        {SEPARATOR}
                        Latest {dateTime(c.lastReportedAt)}
                        {SEPARATOR}
                        Score {c.priorityScore}
                      </p>
                    </div>

                    <button
                      className="rounded-lg border px-4 py-2 text-xs font-bold"
                      onClick={() => void openCase(c.id)}
                    >
                      Open case
                    </button>
                  </div>
                ))}
              </div>
            )
          ) : tab === "sellers" ? (
            sellers.length === 0 ? (
              <p className="p-8 text-center text-sm text-slate-500">
                No sellers match these filters.
              </p>
            ) : (
              <div className="divide-y">
                {sellers.map((s) => (
                  <div
                    key={s.id}
                    className="flex flex-wrap items-center justify-between gap-3 p-4"
                  >
                    <div>
                      <p className="text-sm font-bold">
                        {s.vendorProfile?.businessName || s.name}
                      </p>

                      <p className="text-xs text-slate-600">
                        {s.name}
                        {SEPARATOR}
                        {s.university?.name || "No institution"}
                        {SEPARATOR}
                        {s.vendorProfile?.accessStatus ||
                          "No seller profile"}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {s.accountFlaggedAt && (
                        <span className="rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-800">
                          Flagged
                        </span>
                      )}

                      {s.accountSuspendedAt && (
                        <span className="rounded-full bg-red-100 px-2 py-1 text-xs text-red-800">
                          Account suspended
                        </span>
                      )}

                      {s.sellerBadges.map((b) => (
                        <span
                          key={b.kind}
                          className="rounded-full bg-amber-50 px-2 py-1 text-xs"
                        >
                          {STAR} {format(b.kind)}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : listings.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-500">
              No listings match these filters.
            </p>
          ) : (
            <div className="divide-y">
              {listings.map((l) => (
                <div
                  key={l.id}
                  className="flex flex-wrap items-center justify-between gap-3 p-4"
                >
                  <div>
                    <p className="text-sm font-bold">
                      {l.title}
                    </p>

                    <p className="text-xs text-slate-500">
                      {l.vendor.vendorProfile?.businessName ||
                        l.vendor.name}
                      {SEPARATOR}
                      {l.category}
                      {SEPARATOR}
                      {NAIRA}
                      {l.price.toLocaleString("en-NG")}
                    </p>
                  </div>

                  <span
                    className={`rounded-full px-2 py-1 text-xs ${
                      l.moderationHiddenAt
                        ? "bg-red-100 text-red-700"
                        : l.isArchived
                          ? "bg-slate-100 text-slate-600"
                          : "bg-green-50 text-green-800"
                    }`}
                  >
                    {l.moderationHiddenAt
                      ? "Admin hidden"
                      : l.isArchived
                        ? "Archived"
                        : "Published"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {detail && (
          <section
            className="rounded-xl border bg-white p-4"
            aria-label="Case details"
          >
            <div className="flex flex-wrap justify-between gap-2">
              <div>
                <h3 className="text-base font-black">
                  {detail.targetLabel ||
                    `${format(detail.targetType)} report`}
                </h3>

                <p className="mt-1 text-xs text-slate-500">
                  {detail.reportCount} unique reports
                  {SEPARATOR}
                  {format(detail.status)}
                  {SEPARATOR}
                  {format(detail.highestSeverity)}
                </p>
              </div>

              <button
                className="rounded-lg border px-3 py-2 text-xs font-bold"
                onClick={() => setDetail(null)}
              >
                Close details
              </button>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {(
                [
                  "investigating",
                  "action_taken",
                  "dismissed",
                  "closed",
                ] as const
              ).map((st) => (
                <button
                  key={st}
                  className="rounded-lg border px-3 py-2 text-xs font-semibold"
                  onClick={() => {
                    setDraft({
                      id: detail.id,
                      action: st,
                      isStatus: true,
                    });
                    setReason("");
                    setAckOpenOrders(false);
                  }}
                >
                  {format(st)}
                </button>
              ))}
            </div>

            {ACTIONS_BY_TARGET[detail.targetType].length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2 border-t pt-3">
                {ACTIONS_BY_TARGET[detail.targetType]
                  .filter(
                    (a) =>
                      superAdmin ||
                      ![
                        "suspend_selling",
                        "restore_selling",
                        "suspend_account",
                        "restore_account",
                      ].includes(a)
                  )
                  .map((action) => (
                    <button
                      key={action}
                      className={`rounded-lg border px-3 py-2 text-xs font-bold ${
                        /suspend|restrict|hide/.test(action)
                          ? "border-red-200 text-red-700"
                          : ""
                      }`}
                      onClick={() => {
                        setDraft({
                          id: detail.id,
                          action,
                          isStatus: false,
                        });
                        setReason("");
                        setAckOpenOrders(false);
                      }}
                    >
                      {ACTION_LABEL[action]}
                    </button>
                  ))}
              </div>
            )}

            <h4 className="mt-5 text-sm font-black">
              Reports (newest first)
            </h4>

            <div className="mt-2 max-h-96 divide-y overflow-auto rounded-lg border">
              {detail.reports.map((r) => (
                <div className="p-3" key={r.id}>
                  <p className="text-xs font-semibold">
                    {format(r.category)}
                    {SEPARATOR}
                    {format(r.severity)}
                    {SEPARATOR}
                    {dateTime(r.createdAt)}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    Reporter: {r.reporter.name}
                  </p>

                  <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-700">
                    {r.details}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>
            Page {page} of{" "}
            {Math.max(1, Math.ceil(total / 25))}
          </span>

          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => {
                setPage((p) => p - 1);
                setDetail(null);
              }}
              className="rounded-lg border bg-white px-3 py-2 disabled:opacity-40"
            >
              Previous
            </button>

            <button
              disabled={page * 25 >= total}
              onClick={() => {
                setPage((p) => p + 1);
                setDetail(null);
              }}
              className="rounded-lg border bg-white px-3 py-2 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>

        <p className="text-xs text-slate-500">
          No account is automatically suspended based on report volume.
          All moderation decisions require an Admin reason and are
          retained in Audit & Records.
        </p>
      </main>
    </AdminShell>
  );
}
