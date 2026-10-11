"use client";

import {
  useEffect,
  useState,
} from "react";

import type {
  ReactNode,
} from "react";

import {
  usePathname,
  useRouter,
} from "next/navigation";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:5000";

const ADMIN_TOKEN_KEY =
  "campusmart-admin-token";

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

type NavigationItem = {
  label: string;
  description: string;
  href: string;
  enabled: boolean;
};

const navigation: NavigationItem[] = [
  {
    label: "Dashboard",
    description:
      "Overview and activity",
    href: "/admin",
    enabled: true,
  },
  {
    label: "Verification",
    description:
      "Student identity reviews",
    href:
      "/admin/verification",
    enabled: true,
  },
  {
    label: "Universities",
    description:
      "Campus management",
    href:
      "/admin/universities",
    enabled: false,
  },
  {
    label: "Marketplace",
    description:
      "Listings and moderation",
    href:
      "/admin/marketplace",
    enabled: false,
  },
  {
    label: "Users",
    description:
      "Buyers and sellers",
    href:
      "/admin/users",
    enabled: false,
  },
  {
    label: "Disputes",
    description:
      "Cases and resolutions",
    href:
      "/admin/disputes",
    enabled: false,
  },
  {
    label: "Finance",
    description:
      "Fees and settlements",
    href:
      "/admin/finance",
    enabled: false,
  },
  {
    label:
      "Staff & Permissions",
    description:
      "Admin access control",
    href:
      "/admin/staff",
    enabled: false,
  },
  {
    label: "Settings",
    description:
      "Platform configuration",
    href:
      "/admin/settings",
    enabled: false,
  },
];

export function adminRoleLabel(
  role: AdminRole
) {
  switch (role) {
    case "super_admin":
      return "Super Admin";

    case "verification_officer":
      return "Verification Officer";

    case "university_manager":
      return "University Manager";

    case "marketplace_moderator":
      return "Marketplace Moderator";

    case "customer_support":
      return "Customer Support";

    case "disputes":
      return "Disputes";

    case "finance":
      return "Finance";

    case "technical_admin":
      return "Technical Admin";

    default:
      return "Admin";
  }
}

function AdminNavigation({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  const router =
    useRouter();

  return (
    <nav className="flex-1 overflow-y-auto p-4">
      <p className="px-3 pb-3 pt-2 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-600">
        Workspace
      </p>

      <div className="space-y-1">
        {navigation.map(
          (item) => {
            const active =
              item.href ===
              "/admin"
                ? pathname ===
                  "/admin"
                : pathname.startsWith(
                    item.href
                  );

            return (
              <button
                key={
                  item.href
                }
                type="button"
                disabled={
                  !item.enabled
                }
                onClick={() => {
                  if (
                    !item.enabled
                  ) {
                    return;
                  }

                  onNavigate?.();

                  router.push(
                    item.href
                  );
                }}
                className={`w-full rounded-xl px-3 py-3 text-left transition ${
                  active
                    ? "bg-white/10 text-white"
                    : item.enabled
                      ? "text-slate-300 hover:bg-white/[0.06] hover:text-white"
                      : "cursor-default text-slate-500"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p
                      className={`truncate text-sm font-semibold ${
                        active
                          ? "text-white"
                          : item.enabled
                            ? "text-slate-300"
                            : "text-slate-500"
                      }`}
                    >
                      {item.label}
                    </p>

                    <p className="mt-0.5 truncate text-xs text-slate-600">
                      {
                        item.description
                      }
                    </p>
                  </div>

                  {!item.enabled ? (
                    <span className="shrink-0 rounded-full border border-white/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-slate-600">
                      Soon
                    </span>
                  ) : null}
                </div>
              </button>
            );
          }
        )}
      </div>
    </nav>
  );
}

export default function AdminShell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const router =
    useRouter();

  const pathname =
    usePathname();

  const [
    admin,
    setAdmin,
  ] =
    useState<
      AdminProfile | null
    >(null);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    mobileMenuOpen,
    setMobileMenuOpen,
  ] =
    useState(false);

  useEffect(() => {
    let cancelled =
      false;

    const loadAdmin =
      async () => {
        const token =
          sessionStorage.getItem(
            ADMIN_TOKEN_KEY
          );

        if (!token) {
          router.replace(
            "/admin/login"
          );

          return;
        }

        try {
          const response =
            await fetch(
              `${API_URL}/api/admin/auth/me`,
              {
                headers: {
                  Authorization:
                    `Bearer ${token}`,
                },

                cache:
                  "no-store",
              }
            );

          const data =
            await response.json();

          if (
            !response.ok ||
            !data.success ||
            !data.admin
          ) {
            sessionStorage.removeItem(
              ADMIN_TOKEN_KEY
            );

            router.replace(
              "/admin/login"
            );

            return;
          }

          if (!cancelled) {
            setAdmin(
              data.admin
            );
          }
        } catch (
          requestError
        ) {
          console.error(
            "Admin session load failed:",
            requestError
          );

          if (!cancelled) {
            setError(
              "Unable to connect to the CampusMart Admin service."
            );
          }
        } finally {
          if (!cancelled) {
            setLoading(
              false
            );
          }
        }
      };

    void loadAdmin();

    return () => {
      cancelled =
        true;
    };
  }, [
    router,
  ]);

  useEffect(() => {
    setMobileMenuOpen(
      false
    );
  }, [
    pathname,
  ]);

  useEffect(() => {
    if (
      !mobileMenuOpen
    ) {
      return;
    }

    const previousOverflow =
      document.body.style
        .overflow;

    document.body.style.overflow =
      "hidden";

    return () => {
      document.body.style.overflow =
        previousOverflow;
    };
  }, [
    mobileMenuOpen,
  ]);

  const signOut =
    () => {
      sessionStorage.removeItem(
        ADMIN_TOKEN_KEY
      );

      router.replace(
        "/admin/login"
      );
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-300 border-t-slate-950" />

          <p className="mt-4 text-sm font-semibold text-slate-600">
            Loading CampusMart
            Admin...
          </p>
        </div>
      </main>
    );
  }

  if (
    error &&
    !admin
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 px-6">
        <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-bold text-slate-950">
            Admin unavailable
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-600">
            {error}
          </p>

          <button
            type="button"
            onClick={() =>
              window.location.reload()
            }
            className="mt-6 rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white"
          >
            Try again
          </button>
        </div>
      </main>
    );
  }

  if (!admin) {
    return null;
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <div className="flex min-h-screen">
        <aside className="hidden w-[280px] shrink-0 flex-col border-r border-slate-800 bg-slate-950 text-white lg:flex">
          <div className="border-b border-white/10 px-6 py-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400 text-sm font-black text-slate-950">
                CM
              </div>

              <div>
                <p className="font-bold">
                  CampusMart
                </p>

                <p className="text-xs text-slate-500">
                  Admin Console
                </p>
              </div>
            </div>
          </div>

          <AdminNavigation
            pathname={
              pathname
            }
          />

          <div className="border-t border-white/10 p-4">
            <div className="rounded-xl bg-white/[0.05] p-4">
              <p className="truncate text-sm font-bold">
                {admin.name}
              </p>

              <p className="mt-1 truncate text-xs text-slate-500">
                {admin.email}
              </p>

              <div className="mt-3 inline-flex rounded-full border border-amber-400/20 bg-amber-400/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-300">
                {adminRoleLabel(
                  admin.role
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={
                signOut
              }
              className="mt-3 w-full rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-white/[0.06] hover:text-white"
            >
              Sign out
            </button>
          </div>
        </aside>

        {mobileMenuOpen ? (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              aria-label="Close Admin menu"
              onClick={() =>
                setMobileMenuOpen(
                  false
                )
              }
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-[2px]"
            />

            <aside className="relative flex h-full w-[min(320px,88vw)] flex-col bg-slate-950 text-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400 text-sm font-black text-slate-950">
                    CM
                  </div>

                  <div>
                    <p className="font-bold">
                      CampusMart
                    </p>

                    <p className="text-xs text-slate-500">
                      Admin Console
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  aria-label="Close menu"
                  onClick={() =>
                    setMobileMenuOpen(
                      false
                    )
                  }
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 text-lg text-slate-300"
                >
                  ×
                </button>
              </div>

              <AdminNavigation
                pathname={
                  pathname
                }
                onNavigate={() =>
                  setMobileMenuOpen(
                    false
                  )
                }
              />

              <div className="border-t border-white/10 p-4">
                <div className="rounded-xl bg-white/[0.05] p-4">
                  <p className="truncate text-sm font-bold">
                    {admin.name}
                  </p>

                  <p className="mt-1 truncate text-xs text-slate-500">
                    {admin.email}
                  </p>

                  <p className="mt-2 text-xs font-semibold text-amber-300">
                    {adminRoleLabel(
                      admin.role
                    )}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={
                    signOut
                  }
                  className="mt-3 w-full rounded-xl border border-white/10 px-4 py-3 text-sm font-semibold text-slate-300"
                >
                  Sign out
                </button>
              </div>
            </aside>
          </div>
        ) : null}

        <section className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
            <div className="flex min-h-[72px] items-center justify-between gap-4 px-5 sm:px-8">
              <div className="flex min-w-0 items-center gap-3">
                <button
                  type="button"
                  aria-label="Open Admin menu"
                  onClick={() =>
                    setMobileMenuOpen(
                      true
                    )
                  }
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-xl font-bold text-slate-800 shadow-sm lg:hidden"
                >
                  ☰
                </button>

                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-500 lg:hidden">
                    CampusMart Admin
                  </p>

                  <h1 className="truncate text-lg font-bold tracking-tight sm:text-xl">
                    {title}
                  </h1>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="hidden text-right sm:block">
                  <p className="text-sm font-bold">
                    {admin.name}
                  </p>

                  <p className="text-xs text-slate-500">
                    {adminRoleLabel(
                      admin.role
                    )}
                  </p>
                </div>

                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-950 text-sm font-bold text-amber-400">
                  {admin.name
                    .slice(
                      0,
                      1
                    )
                    .toUpperCase()}
                </div>
              </div>
            </div>
          </header>

          {children}
        </section>
      </div>
    </main>
  );
}