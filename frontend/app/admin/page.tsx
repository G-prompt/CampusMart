"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AdminShell, {
  type AdminProfile,
  adminRoleLabel,
} from "@/components/admin/AdminShell";
import { AnalyticsPreview } from "@/components/admin/AdminAnalytics";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
const TOKEN = "campusmart-admin-token";

type DashboardStats = {
  queue?: number;
  universities?: number;
  activeUniversities?: number;
  recent?: { id: string; action: string; createdAt: string; actor: { name: string } }[];
};

const quickLink = "flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2.5 text-xs font-bold transition hover:bg-slate-50";

export default function AdminDashboardPage() {
  const [admin, setAdmin] = useState<AdminProfile | null>(null);
  const [stats, setStats] = useState<DashboardStats>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const token = sessionStorage.getItem(TOKEN);
        if (!token) return;
        const headers = { Authorization: `Bearer ${token}` };
        const response = await fetch(`${API}/api/admin/auth/me`, {
          headers, cache: "no-store", signal: controller.signal,
        });
        const body = await response.json();
        if (!response.ok || !body.success || !body.admin) {
          throw new Error("Unable to load Admin profile.");
        }
        if (controller.signal.aborted) return;
        const current: AdminProfile = body.admin;
        setAdmin(current);
        const next: DashboardStats = {};
        await Promise.all([
          (["super_admin", "verification_officer"].includes(current.role)
            ? fetch(`${API}/api/admin/verification/appeals`, { headers, signal: controller.signal })
                .then(r => r.ok ? r.json() : null)
                .then(data => { if (Array.isArray(data?.appeals)) next.queue = data.appeals.length; })
            : Promise.resolve()),
          (["super_admin", "university_manager"].includes(current.role)
            ? fetch(`${API}/api/admin/universities`, { headers, signal: controller.signal })
                .then(r => r.ok ? r.json() : null)
                .then(data => {
                  if (Array.isArray(data?.universities)) {
                    next.universities = data.universities.length;
                    next.activeUniversities = data.universities.filter((u: { active: boolean }) => u.active).length;
                  }
                })
            : Promise.resolve()),
          (current.role === "super_admin"
            ? fetch(`${API}/api/admin/audit?limit=5`, { headers, signal: controller.signal })
                .then(r => r.ok ? r.json() : null)
                .then(data => { if (Array.isArray(data?.events)) next.recent = data.events; })
            : Promise.resolve()),
        ]);
        if (!controller.signal.aborted) setStats(next);
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : "Unable to load dashboard.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, []);

  const verificationAccess = admin && ["super_admin", "verification_officer"].includes(admin.role);
  const universityAccess = admin && ["super_admin", "university_manager"].includes(admin.role);
  const superAdmin = admin?.role === "super_admin";

  return <AdminShell title="Dashboard">
    <div className="mx-auto max-w-7xl space-y-4 p-4 sm:p-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-amber-700">Operations overview</p>
          <h2 className="mt-1 text-xl font-black sm:text-2xl">Welcome back{admin ? `, ${admin.name.split(" ")[0]}` : ""}.</h2>
          <p className="mt-1 text-xs text-slate-500">See what needs attention and act quickly.</p>
        </div>
        {admin && <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold">{adminRoleLabel(admin.role)}</span>}
      </header>
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-white p-3 text-xs text-red-700">{error}</p>}

      {superAdmin ? <AnalyticsPreview /> :
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {verificationAccess && <Link href="/admin/verification" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs text-slate-500">Open verification cases</p><p className="mt-1 text-2xl font-black">{loading ? "…" : stats.queue ?? "—"}</p></Link>}
          {universityAccess && <Link href="/admin/universities" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs text-slate-500">Universities</p><p className="mt-1 text-2xl font-black">{loading ? "…" : stats.universities ?? "—"}</p></Link>}
          {universityAccess && <Link href="/admin/universities" className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs text-slate-500">Active campuses</p><p className="mt-1 text-2xl font-black">{loading ? "…" : stats.activeUniversities ?? "—"}</p></Link>}
        </div>
      }

      <div className="grid gap-3 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
          <h3 className="text-sm font-black">Quick actions</h3>
          <p className="mt-1 text-xs text-slate-500">Go straight to the work you need.</p>
          <div className="mt-3 grid gap-2">
            {verificationAccess && <Link className={quickLink} href="/admin/verification">Review student cases <span aria-hidden="true">→</span></Link>}
            {universityAccess && <Link className={quickLink} href="/admin/universities">Manage universities <span aria-hidden="true">→</span></Link>}
            {superAdmin && <Link className={quickLink} href="/admin/analytics">Analytics & Reports <span aria-hidden="true">→</span></Link>}
            {superAdmin && <Link className={quickLink} href="/admin/audit">Audit & Records <span aria-hidden="true">→</span></Link>}
            {!verificationAccess && !universityAccess && !superAdmin && <p className="text-xs text-slate-500">Your available tools will appear here when enabled by the platform.</p>}
          </div>
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
          <div className="flex justify-between gap-2"><h3 className="text-sm font-black">Recent Admin activity</h3>{superAdmin && <Link href="/admin/audit" className="text-xs font-bold text-amber-800 hover:underline">All records →</Link>}</div>
          {!superAdmin
            ? <p className="mt-3 text-xs text-slate-500">Case history is available within authorised workflows.</p>
            : stats.recent?.length
              ? <div className="mt-2 divide-y divide-slate-100">{stats.recent.map(event => <div key={event.id} className="py-2.5"><p className="text-xs font-semibold">{event.action.replace(/\./g, " ")}</p><p className="mt-1 text-[11px] text-slate-500">{event.actor.name} · {new Date(event.createdAt).toLocaleString()}</p></div>)}</div>
              : <p className="mt-3 text-xs text-slate-500">{loading ? "Loading activity..." : "No recent Admin events."}</p>}
        </section>
      </div>
    </div>
  </AdminShell>;
}
