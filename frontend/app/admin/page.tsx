"use client";

import {
  useEffect,
  useState,
} from "react";

import AdminShell, {
  type AdminProfile,
  adminRoleLabel,
} from "@/components/admin/AdminShell";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:5000";

const ADMIN_TOKEN_KEY =
  "campusmart-admin-token";

export default function AdminDashboardPage() {
  const [
    admin,
    setAdmin,
  ] =
    useState<
      AdminProfile | null
    >(null);

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
            response.ok &&
            data.success &&
            data.admin &&
            !cancelled
          ) {
            setAdmin(
              data.admin
            );
          }
        } catch (
          error
        ) {
          console.error(
            "Dashboard Admin profile load failed:",
            error
          );
        }
      };

    void loadAdmin();

    return () => {
      cancelled =
        true;
    };
  }, []);

  return (
    <AdminShell title="Dashboard">
      <div className="mx-auto max-w-[1500px] p-5 sm:p-8">
        <section className="overflow-hidden rounded-2xl bg-slate-950 p-6 text-white shadow-sm sm:p-8">
          <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-400">
                CampusMart
                Operations
              </p>

              <h2 className="mt-4 max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
                Welcome back
                {admin?.name
                  ? `, ${
                      admin.name.split(
                        " "
                      )[0]
                    }`
                  : ""}
                .
              </h2>

              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-400">
                Manage trust,
                verification,
                universities,
                marketplace
                operations,
                disputes and
                platform controls
                from one secure
                workspace.
              </p>
            </div>

            {admin ? (
              <div className="rounded-xl border border-white/10 bg-white/[0.05] px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">
                  Signed in as
                </p>

                <p className="mt-1 text-sm font-bold">
                  {adminRoleLabel(
                    admin.role
                  )}
                </p>
              </div>
            ) : null}
          </div>
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            {
              label:
                "Verification queue",
              value: "—",
              note:
                "Awaiting connection",
            },
            {
              label:
                "Active universities",
              value: "—",
              note:
                "Awaiting connection",
            },
            {
              label:
                "Marketplace reports",
              value: "—",
              note:
                "Coming later",
            },
            {
              label:
                "Open disputes",
              value: "—",
              note:
                "Coming later",
            },
          ].map(
            (item) => (
              <div
                key={
                  item.label
                }
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <p className="text-sm font-semibold text-slate-500">
                  {
                    item.label
                  }
                </p>

                <p className="mt-3 text-3xl font-bold tracking-tight">
                  {
                    item.value
                  }
                </p>

                <p className="mt-2 text-xs font-medium text-slate-400">
                  {
                    item.note
                  }
                </p>
              </div>
            )
          )}
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                  Priority
                </p>

                <h3 className="mt-2 text-xl font-bold">
                  Verification
                  operations
                </h3>

                <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
                  Student
                  verification is
                  currently the
                  first complete
                  Admin backend
                  workflow.
                </p>
              </div>

              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                Backend ready
              </span>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {[
                "View verification queue",
                "Open student case",
                "Review private evidence",
                "Approve identity",
                "Request more information",
                "Reject verification",
              ].map(
                (
                  item,
                  index
                ) => (
                  <div
                    key={
                      item
                    }
                    className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-xs font-bold text-amber-400">
                      {String(
                        index +
                          1
                      ).padStart(
                        2,
                        "0"
                      )}
                    </div>

                    <p className="text-sm font-semibold text-slate-700">
                      {item}
                    </p>
                  </div>
                )
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
              Admin account
            </p>

            {admin ? (
              <>
                <div className="mt-5">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-950 text-xl font-bold text-amber-400">
                    {admin.name
                      .slice(
                        0,
                        1
                      )
                      .toUpperCase()}
                  </div>

                  <h3 className="mt-4 text-lg font-bold">
                    {admin.name}
                  </h3>

                  <p className="mt-1 break-all text-sm text-slate-500">
                    {admin.email}
                  </p>
                </div>

                <div className="mt-6 space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
                    <span className="text-slate-500">
                      Role
                    </span>

                    <span className="text-right font-bold">
                      {adminRoleLabel(
                        admin.role
                      )}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">
                      Status
                    </span>

                    <span className="font-bold text-emerald-700">
                      Active
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <p className="mt-5 text-sm text-slate-500">
                Loading Admin
                profile...
              </p>
            )}
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <p className="text-sm font-bold text-amber-950">
            Admin foundation
            in progress
          </p>

          <p className="mt-1 text-sm leading-6 text-amber-800">
            Verification is
            the first module
            being connected.
            Other operational
            areas will become
            available as their
            workflows are
            completed.
          </p>
        </section>
      </div>
    </AdminShell>
  );
}