"use client";

import Link from "next/link";

import {
  useEffect,
  useState,
} from "react";

import PageShell from "@/components/common/PageShell";

import {
  useAuth,
} from "@/components/common/AuthContext";

import {
  formatNaira,
} from "@/lib/products";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:5000";

type VendorStats = {
  listingCount: number;
  orderCount: number;
  pendingOrderCount: number;
  itemCount: number;
  revenue: number;
};

export default function Page() {
  const {
    user,
    openAuth,
  } = useAuth();

  const [
    stats,
    setStats,
  ] =
    useState<VendorStats>({
      listingCount: 0,
      orderCount: 0,
      pendingOrderCount: 0,
      itemCount: 0,
      revenue: 0,
    });

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  useEffect(() => {
    if (
      user?.role !==
      "vendor"
    ) {
      setLoading(false);

      return;
    }

    const controller =
      new AbortController();

    const loadDashboard =
      async () => {
        try {
          setLoading(true);
          setError("");

          const token =
            localStorage.getItem(
              "campusmart-token"
            );

          if (!token) {
            throw new Error(
              "Your session is unavailable."
            );
          }

          const headers = {
            Authorization:
              `Bearer ${token}`,
          };

          /*
           * Load listings and order
           * statistics at the same time.
           */
          const [
            listingsResponse,
            ordersResponse,
          ] =
            await Promise.all([
              fetch(
                `${API_URL}/api/products/mine`,
                {
                  headers,
                  signal:
                    controller.signal,
                }
              ),

              fetch(
                `${API_URL}/api/orders/vendor`,
                {
                  headers,
                  signal:
                    controller.signal,
                }
              ),
            ]);

          const [
            listingsData,
            ordersData,
          ] =
            await Promise.all([
              listingsResponse.json(),
              ordersResponse.json(),
            ]);

          if (
            !listingsResponse.ok ||
            !listingsData.success
          ) {
            throw new Error(
              listingsData.message ||
                "Unable to load your listings."
            );
          }

          if (
            !ordersResponse.ok ||
            !ordersData.success
          ) {
            throw new Error(
              ordersData.message ||
                "Unable to load your orders."
            );
          }

          const listingCount =
            Array.isArray(
              listingsData.products
            )
              ? listingsData
                  .products
                  .length
              : 0;

          setStats({
            listingCount,

            orderCount:
              Number(
                ordersData.summary
                  ?.orderCount
              ) || 0,

            pendingOrderCount:
              Number(
                ordersData.summary
                  ?.pendingOrderCount
              ) || 0,

            itemCount:
              Number(
                ordersData.summary
                  ?.itemCount
              ) || 0,

            revenue:
              Number(
                ordersData.summary
                  ?.revenue
              ) || 0,
          });
        } catch (error) {
          if (
            error instanceof
              DOMException &&
            error.name ===
              "AbortError"
          ) {
            return;
          }

          console.error(
            "Vendor dashboard error:",
            error
          );

          setError(
            error instanceof Error
              ? error.message
              : "Unable to refresh shop statistics."
          );
        } finally {
          setLoading(false);
        }
      };

    loadDashboard();

    return () =>
      controller.abort();
  }, [user]);

  if (
    user?.role !==
    "vendor"
  ) {
    return (
      <PageShell
        title="Vendor dashboard"
        description="Manage your campus shop, listings, and incoming orders."
      >
        <div className="site-card max-w-md p-8 text-center">
          <h2 className="text-2xl font-bold text-slate-950">
            Vendor access
            required
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-600">
            Sign in with a
            vendor account to
            manage your shop.
          </p>

          <button
            type="button"
            onClick={() =>
              openAuth(
                "login",
                "vendor"
              )
            }
            className="mt-6 rounded-[10px] bg-accent-400 px-5 py-3 text-sm font-bold text-black"
          >
            Sign in as vendor
          </button>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Vendor dashboard"
      description="Manage your campus shop, listings, and incoming orders."
    >
      <div className="mb-6 flex flex-wrap gap-3">
        <Link
          href="/marketplace"
          className="rounded-[10px] bg-accent-400 px-5 py-3 text-sm font-bold text-black transition hover:bg-accent-500"
        >
          Explore marketplace
        </Link>

        <Link
          href="/vendor/orders"
          className="rounded-[10px] border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:border-black hover:text-black"
        >
          View orders
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <section className="site-card p-6 sm:p-8">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-700">
            Vendor account
          </p>

          <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-950">
            Welcome,{" "}
            {user.name}
          </h2>

          <p className="mt-3 max-w-xl text-sm leading-7 text-slate-600">
            Your shop is ready.
            Manage your listings
            and keep track of
            incoming CampusMart
            orders here.
          </p>

          <div className="mt-7 grid gap-4 sm:grid-cols-3">
            <Link
              href="/vendor/listings"
              className="rounded-xl bg-slate-50 p-4 transition hover:bg-slate-100"
            >
              <p className="text-sm text-slate-500">
                Your listings
              </p>

              <p className="mt-2 text-2xl font-bold text-slate-950">
                {loading
                  ? "—"
                  : stats.listingCount}
              </p>
            </Link>

            <Link
              href="/vendor/orders"
              className="rounded-xl bg-slate-50 p-4 transition hover:bg-slate-100"
            >
              <p className="text-sm text-slate-500">
                Orders
              </p>

              <p className="mt-2 text-2xl font-bold text-slate-950">
                {loading
                  ? "—"
                  : stats.orderCount}
              </p>

              {!loading &&
              stats.pendingOrderCount >
                0 ? (
                <p className="mt-1 text-xs font-semibold text-amber-700">
                  {
                    stats.pendingOrderCount
                  }{" "}
                  pending
                </p>
              ) : null}
            </Link>

            <Link
              href="/vendor/orders"
              className="rounded-xl bg-slate-50 p-4 transition hover:bg-slate-100"
            >
              <p className="text-sm text-slate-500">
                Revenue
              </p>

              <p className="mt-2 text-2xl font-bold text-slate-950">
                {loading
                  ? "—"
                  : formatNaira(
                      stats.revenue
                    )}
              </p>

              <p className="mt-1 text-xs text-slate-500">
                Paid & completed
              </p>
            </Link>
          </div>

          {!loading &&
          stats.orderCount >
            0 ? (
            <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 border-t border-slate-200 pt-4 text-sm text-slate-600">
              <span>
                <strong className="text-slate-950">
                  {
                    stats.itemCount
                  }
                </strong>{" "}
                {stats.itemCount ===
                1
                  ? "item"
                  : "items"}{" "}
                ordered
              </span>

              <span>
                <strong className="text-slate-950">
                  {
                    stats.pendingOrderCount
                  }
                </strong>{" "}
                pending
              </span>
            </div>
          ) : null}

          {error ? (
            <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-xs font-semibold text-red-600">
              {error}
            </p>
          ) : null}
        </section>

        <section className="site-card p-6 sm:p-8">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-700">
            Shop actions
          </p>

          <div className="mt-5 space-y-3">
            <Link
              href="/vendor/add-listing"
              className="flex items-center justify-between rounded-[10px] bg-accent-400 px-4 py-4 text-sm font-bold text-black transition hover:bg-accent-500"
            >
              <span>
                Add a product
              </span>

              <span aria-hidden="true">
                →
              </span>
            </Link>

            <Link
              href="/vendor/listings"
              className="flex items-center justify-between rounded-[10px] border border-slate-200 bg-white px-4 py-4 text-sm font-bold text-slate-950 transition hover:border-black"
            >
              <span>
                Manage listings
              </span>

              <span aria-hidden="true">
                →
              </span>
            </Link>

            <Link
              href="/vendor/orders"
              className="flex items-center justify-between rounded-[10px] border border-slate-200 bg-white px-4 py-4 text-sm font-bold text-slate-950 transition hover:border-black"
            >
              <span>
                View orders
              </span>

              <span aria-hidden="true">
                →
              </span>
            </Link>

            <Link
              href="/marketplace"
              className="flex items-center justify-between rounded-[10px] border border-slate-200 bg-white px-4 py-4 text-sm font-bold text-slate-950 transition hover:border-black"
            >
              <span>
                View marketplace
              </span>

              <span aria-hidden="true">
                →
              </span>
            </Link>
          </div>
        </section>
      </div>
    </PageShell>
  );
}