"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import PageShell from "@/components/common/PageShell";
import { useAuth } from "@/components/common/AuthContext";

import {
  formatNaira,
  type Product,
} from "@/lib/products";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:5000";

export default function Page() {
  const { user, openAuth } = useAuth();

  const [listings, setListings] =
    useState<Product[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [deletingId, setDeletingId] =
    useState<number | null>(null);

  useEffect(() => {
    if (user?.role !== "vendor") {
      setLoading(false);
      return;
    }

    const controller =
      new AbortController();

    const loadListings = async () => {
      try {
        setLoading(true);
        setError("");

        const token =
          localStorage.getItem(
            "campusmart-token"
          );

        if (!token) {
          throw new Error(
            "Your session could not be verified. Please sign in again."
          );
        }

        const response = await fetch(
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
              "Unable to load your listings."
          );
        }

        setListings(
          Array.isArray(data.products)
            ? data.products
            : []
        );
      } catch (error) {
        if (
          error instanceof DOMException &&
          error.name === "AbortError"
        ) {
          return;
        }

        console.error(
          "Vendor listings error:",
          error
        );

        setError(
          error instanceof Error
            ? error.message
            : "Unable to load your listings."
        );
      } finally {
        if (
          !controller.signal.aborted
        ) {
          setLoading(false);
        }
      }
    };

    loadListings();

    return () =>
      controller.abort();
  }, [user]);

  const removeListing = async (
    listingId: number
  ) => {
    const confirmed =
      window.confirm(
        "Remove this listing from CampusMart?"
      );

    if (!confirmed) return;

    try {
      setDeletingId(listingId);
      setError("");

      const token =
        localStorage.getItem(
          "campusmart-token"
        );

      if (!token) {
        throw new Error(
          "Your session could not be verified. Please sign in again."
        );
      }

      const response = await fetch(
        `${API_URL}/api/products/${listingId}`,
        {
          method: "DELETE",
          headers: {
            Authorization:
              `Bearer ${token}`,
          },
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
            "Unable to remove listing."
        );
      }

      setListings((current) =>
        current.filter(
          (listing) =>
            listing.id !== listingId
        )
      );
    } catch (error) {
      console.error(
        "Delete listing error:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "Unable to remove listing."
      );
    } finally {
      setDeletingId(null);
    }
  };

  if (user?.role !== "vendor") {
    return (
      <PageShell
        title="Vendor listings"
        description="Review and manage your active marketplace listings."
      >
        <div className="site-card max-w-md p-8 text-center">
          <h2 className="text-2xl font-bold text-slate-950">
            Vendor access required
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-600">
            Sign in with a vendor account
            to manage your CampusMart
            listings.
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
      title="My listings"
      description="Review and manage the products customers see in the marketplace."
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-slate-600">
          <span className="font-bold text-black">
            {listings.length}
          </span>{" "}
          published{" "}
          {listings.length === 1
            ? "listing"
            : "listings"}
        </p>

        <Link
          href="/vendor/add-listing"
          className="rounded-[10px] bg-accent-400 px-5 py-3 text-sm font-bold text-black transition hover:bg-accent-500"
        >
          Add listing
        </Link>
      </div>

      {error ? (
        <div
          className="mt-6 rounded-[10px] border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {[1, 2].map((item) => (
            <div
              key={item}
              className="site-card h-[420px] animate-pulse bg-slate-100"
            />
          ))}
        </div>
      ) : listings.length ? (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {listings.map((listing) => (
            <article
              key={listing.id}
              className="site-card overflow-hidden"
            >
              {listing.images.length ? (
                <img
                  src={listing.images[0]}
                  alt={listing.title}
                  className="h-44 w-full object-cover"
                />
              ) : (
                <div className="flex h-44 items-center justify-center bg-slate-950 px-6 text-center text-sm font-bold text-white">
                  CampusMart listing image
                </div>
              )}

              <div className="p-5">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                  {listing.category}
                </p>

                <h2 className="mt-2 text-xl font-bold text-slate-950">
                  {listing.title}
                </h2>

                <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">
                  {listing.description}
                </p>

                <p className="mt-4 text-lg font-bold text-slate-950">
                  {formatNaira(
                    listing.price
                  )}
                </p>

                <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
                  <Link
                    href={`/marketplace/products/${listing.id}`}
                    className="rounded-[9px] border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:border-black hover:text-black"
                  >
                    View
                  </Link>

                  <Link
                    href={`/vendor/edit-listing?id=${listing.id}`}
                    className="rounded-[9px] border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:border-black hover:text-black"
                  >
                    Edit
                  </Link>

                  <button
                    type="button"
                    disabled={
                      deletingId ===
                      listing.id
                    }
                    onClick={() =>
                      removeListing(
                        listing.id
                      )
                    }
                    className="rounded-[9px] px-4 py-2 text-sm font-bold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {deletingId ===
                    listing.id
                      ? "Removing..."
                      : "Remove"}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="site-card mt-6 p-8 text-center">
          <h2 className="text-xl font-bold text-slate-950">
            Your shop is empty
          </h2>

          <p className="mt-2 text-sm text-slate-600">
            Publish your first product
            and it will appear here and
            in the marketplace.
          </p>

          <Link
            href="/vendor/add-listing"
            className="mt-6 inline-flex rounded-[10px] bg-accent-400 px-5 py-3 text-sm font-bold text-black"
          >
            Add your first listing
          </Link>
        </div>
      )}
    </PageShell>
  );
}