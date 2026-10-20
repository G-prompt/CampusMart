"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
const TOKEN = "campusmart-admin-token";

export type AdminRole =
  | "super_admin"
  | "verification_officer"
  | "university_manager"
  | "marketplace_moderator"
  | "customer_support"
  | "disputes"
  | "finance"
  | "technical_admin";

export type AdminProfile = {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  active: boolean;
};

export function adminRoleLabel(role: AdminRole): string {
  const labels: Record<AdminRole, string> = {
    super_admin: "Super Admin",
    verification_officer: "Verification Officer",
    university_manager: "University Manager",
    marketplace_moderator: "Marketplace Moderator",
    customer_support: "Customer Support",
    disputes: "Disputes Officer",
    finance: "Finance Officer",
    technical_admin: "Technical Admin",
  };
  return labels[role] || "Admin";
}

const pages: {
  label: string;
  hint: string;
  href: string;
  roles?: AdminRole[];
}[] = [
  { label: "Dashboard", hint: "Overview", href: "/admin" },
  {
    label: "Verification",
    hint: "Student cases",
    href: "/admin/verification",
    roles: ["super_admin", "verification_officer"],
  },
  {
    label: "Universities",
    hint: "Campus network",
    href: "/admin/universities",
    roles: ["super_admin", "university_manager"],
  },
  { label: "Campus Settings", hint: "Signup & selling", href: "/admin/campus-rollout", roles: ["super_admin", "university_manager"] },
  {
    label: "Analytics & Reports",
    hint: "Insights",
    href: "/admin/analytics",
    roles: ["super_admin"],
  },
  { label: "Marketplace", hint: "Reports & safety", href: "/admin/marketplace", roles: ["super_admin", "marketplace_moderator", "customer_support", "disputes"] },
  { label: "Seller Recognition", hint: "Badges & talent", href: "/admin/seller-recognition", roles: ["super_admin", "marketplace_moderator"] },
  {
    label: "Audit & Records",
    hint: "Accountability",
    href: "/admin/audit",
    roles: ["super_admin"],
  },
];

export default function AdminShell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [admin, setAdmin] = useState<AdminProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const openButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      const token = sessionStorage.getItem(TOKEN);
      if (!token) {
        router.replace("/admin/login");
        return;
      }
      try {
        const response = await fetch(`${API}/api/admin/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        const data = await response.json();
        if (!response.ok || !data.success || !data.admin) {
          sessionStorage.removeItem(TOKEN);
          router.replace("/admin/login");
          return;
        }
        if (alive) setAdmin(data.admin);
      } catch {
        if (alive) setError("Cannot connect to the Admin backend.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [router]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Lock the document (both html and body) while the drawer is visible.
  // Portal rendering keeps it outside any page scrolling/stacking context.
  useEffect(() => {
    if (!open) return;
    const html = document.documentElement;
    const body = document.body;
    const previousHtml = html.style.overflow;
    const previousBody = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      html.style.overflow = previousHtml;
      body.style.overflow = previousBody;
      document.removeEventListener("keydown", onKeyDown);
      openButtonRef.current?.focus();
    };
  }, [open]);

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-100 text-sm text-slate-600">
        Loading Admin workspace...
      </main>
    );
  }

  if (error && !admin) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-100 p-6">
        <div className="rounded-xl bg-white p-6 text-center">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 rounded-lg bg-slate-950 px-4 py-2 text-sm text-white"
          >
            Retry
          </button>
        </div>
      </main>
    );
  }

  if (!admin) return null;

  const permitted = pages.filter(
    (page) => !page.roles || page.roles.includes(admin.role)
  );

  const signOut = () => {
    sessionStorage.removeItem(TOKEN);
    setOpen(false);
    router.replace("/admin/login");
  };

  const menuContent = (
    <>
      <div className="shrink-0 border-b border-white/10 px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-400 text-sm font-black text-slate-950">
            CM
          </div>
          <div className="min-w-0">
            <p className="font-bold leading-5">CampusMart</p>
            <p className="text-xs text-slate-400">Admin workspace</p>
          </div>
        </div>
      </div>

      <nav
        aria-label="Admin navigation"
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4"
      >
        <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">
          Workspace
        </p>
        <div className="space-y-1">
          {permitted.map((page) => {
            const selected =
              page.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(page.href);
            return (
              <Link
                key={page.href}
                href={page.href}
                aria-current={selected ? "page" : undefined}
                onClick={() => setOpen(false)}
                className={`flex min-h-10 items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                  selected
                    ? "bg-white/15 font-bold text-white"
                    : "text-slate-300 hover:bg-white/10 hover:text-white"
                }`}
              >
                <span>{page.label}</span>
                <span
                  className={`text-[10px] ${
                    selected ? "text-amber-300" : "text-slate-500"
                  }`}
                >
                  {page.hint}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="shrink-0 border-t border-white/10 p-4">
        <p className="truncate text-sm font-semibold">{admin.name}</p>
        <p className="truncate text-xs text-slate-400">
          {adminRoleLabel(admin.role)}
        </p>
        <button
          type="button"
          onClick={signOut}
          className="mt-3 rounded-lg border border-white/15 px-4 py-2 text-xs font-bold text-slate-200 hover:bg-white/10"
        >
          Sign out
        </button>
      </div>
    </>
  );

  return (
    <div className="h-[100dvh] overflow-hidden bg-[#f2f5f9] text-slate-950">
      <div className="mx-auto flex h-full max-w-[1800px] overflow-hidden">
        <aside className="hidden h-full w-[235px] shrink-0 flex-col overflow-hidden bg-slate-950 text-white lg:flex">
          {menuContent}
        </aside>

        <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <header className="z-30 flex min-h-16 shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <button
                ref={openButtonRef}
                type="button"
                aria-label="Open Admin menu"
                aria-expanded={open}
                aria-controls="campusmart-admin-mobile-menu"
                onClick={() => setOpen(true)}
                className="grid size-9 shrink-0 place-items-center rounded-lg border border-slate-200 text-xl lg:hidden"
              >
                ☰
              </button>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold text-slate-500">
                  CampusMart Admin
                </p>
                <h1 className="truncate text-base font-black sm:text-lg">
                  {title}
                </h1>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="hidden text-xs text-slate-500 sm:block">
                {adminRoleLabel(admin.role)}
              </span>
              <span className="grid size-9 place-items-center rounded-full bg-slate-950 text-sm font-bold text-amber-300">
                {admin.name.slice(0, 1).toUpperCase()}
              </span>
            </div>
          </header>

          {/* This is the only region that scrolls the Admin page. */}
          <div id="admin-page-scroll" className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {children}
          </div>
        </section>
      </div>

      {mounted && open
        ? createPortal(
            <div
              id="campusmart-admin-mobile-menu"
              role="dialog"
              aria-modal="true"
              aria-label="Admin menu"
              className="fixed inset-0 z-[100] flex h-[100dvh] overflow-hidden lg:hidden"
            >
              <button
                type="button"
                aria-label="Close Admin menu"
                onClick={() => setOpen(false)}
                className="absolute inset-0 bg-slate-950/65"
              />
              <aside className="relative flex h-full w-[min(300px,88vw)] shrink-0 flex-col overflow-hidden bg-slate-950 text-white shadow-xl">
                <button
                  ref={closeButtonRef}
                  type="button"
                  aria-label="Close menu"
                  onClick={() => setOpen(false)}
                  className="absolute right-3 top-4 z-10 rounded-lg border border-white/20 bg-slate-950 px-3 py-1.5 text-sm"
                >
                  Close
                </button>
                {menuContent}
              </aside>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
