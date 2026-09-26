"use client";

import Link from "next/link";
import {
  useEffect,
  useState,
} from "react";

import PageShell from "@/components/common/PageShell";
import { useAuth } from "@/components/common/AuthContext";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:5000";

export default function Page() {
  const { user, openAuth } = useAuth();

  const [
    listingCount,
    setListingCount,
  ] = useState<number | null>(
    null
  );

  const [countError, setCountError] =
    useState("");

  useEffect(() => {
    if (user?.role !== "vendor") {
      return;
    }

    const controller =
      new AbortController();

    const loadDashboard =
      async () => {
        try {
          setCountError("");

          const token =
            localStorage.getItem(
              "campusmart-token"
            );

          if (!token) {
            throw new Error(
              "Session unavailable."
            );
          }

          const response =
            await fetch(
              `${API_URL}/api/products/mine`,
              {
                headers: {
                  Authorization:
                    `Bearer ${token}`,
                },
                signal:
                  controller.signal,
              }
            );

          const data =
            await response.json();

          if (
            !response.ok ||
            !data.success
          ) {
            throw new Error(
              data.message ||
                "Unable to load dashboard."
            );
          }

          setListingCount(
            Array.isArray(
              data.products
            )
              ? data.products.length
              : 0
          );
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

          setCountError(
            "Unable to refresh shop statistics."
          );

          setListingCount(0);
        }
      };

    loadDashboard();

    return () =>
      controller.abort();
  }, [user]);

  if (user?.role !== "vendor") {
    return (
      <PageShell
        title="Vendor dashboard"
        description="Manage your campus shop, listings, and incoming orders."
      >
        <div className="site-card max-w-md p-8 text-center">
          <h2 className="text-2xl font-bold text-slate-950">
            Vendor access required
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-600">
            Sign in with a vendor account
            to manage your shop.
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
          href="/support"
          className="rounded-[10px] border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:border-black hover:text-black"
        >
          Learn more
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <section className="site-card p-6 sm:p-8">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-700">
            Vendor account
          </p>

          <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-950">
            Welcome, {user.name}
          </h2>

          <p className="mt-3 max-w-xl text-sm leading-7 text-slate-600">
            Your shop is ready.
            Publish clear, detailed
            listings so campus buyers
            can find and trust what
            you offer.
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
                {listingCount === null
                  ? "—"
                  : listingCount}
              </p>
            </Link>

            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-sm text-slate-500">
                Orders
              </p>

              <p className="mt-2 text-2xl font-bold text-slate-950">
                0
              </p>
            </div>

            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-sm text-slate-500">
                Revenue
              </p>

              <p className="mt-2 text-2xl font-bold text-slate-950">
                ₦0
              </p>
            </div>
          </div>

          {countError ? (
            <p className="mt-4 text-xs font-semibold text-red-600">
              {countError}
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