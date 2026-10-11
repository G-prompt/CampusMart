"use client";

import Link from "next/link";

import {
  useEffect,
  useState,
} from "react";

import {
  useParams,
} from "next/navigation";

import PageShell from "@/components/common/PageShell";

import {
  formatNaira,
} from "@/lib/products";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:5000";

type StorefrontUniversity = {
  id:
    | string
    | null;

  name:
    string;

  shortName:
    | string
    | null;

  state:
    | string
    | null;

  city:
    | string
    | null;

  managed:
    boolean;
};

type Storefront = {
  sellerId:
    string;

  ownerName:
    string;

  businessName:
    string;

  description:
    string;

  university:
    | StorefrontUniversity
    | null;

  badges: {
    studentVerified:
      boolean;

    vendorVerified:
      boolean;
  };

  memberSince:
    string;

  listingCount:
    number;
};

type StorefrontProduct = {
  id:
    number;

  slug:
    string;

  title:
    string;

  category:
    string;

  price:
    number;

  rating:
    number;

  description:
    string;

  images:
    string[];

  createdAt:
    string;
};

type StorefrontResponse = {
  success:
    boolean;

  storefront?:
    Storefront;

  products?:
    StorefrontProduct[];

  message?:
    string;
};

function formatMemberSince(
  value:
    string
) {
  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  return date.toLocaleDateString(
    "en-GB",
    {
      month:
        "short",

      year:
        "numeric",
    }
  );
}

function sellerInitials(
  value:
    string
) {
  const parts =
    value
      .trim()
      .split(/\s+/)
      .filter(
        Boolean
      );

  if (
    parts.length ===
    0
  ) {
    return "CM";
  }

  if (
    parts.length ===
    1
  ) {
    return parts[0]
      .slice(
        0,
        2
      )
      .toUpperCase();
  }

  return `${parts[0][0]}${parts[parts.length - 1][0]}`
    .toUpperCase();
}

export default function Page() {
  const params =
    useParams();

  const vendorId =
    typeof params.vendorId ===
      "string"
      ? params.vendorId
      : "";

  const [
    storefront,
    setStorefront,
  ] =
    useState<
      Storefront | null
    >(
      null
    );

  const [
    products,
    setProducts,
  ] =
    useState<
      StorefrontProduct[]
    >(
      []
    );

  const [
    loading,
    setLoading,
  ] =
    useState(
      true
    );

  const [
    error,
    setError,
  ] =
    useState(
      ""
    );

  /*
   * =====================================================
   * LOAD PUBLIC STOREFRONT
   * =====================================================
   */

  useEffect(() => {
    if (
      !vendorId
    ) {
      setLoading(
        false
      );

      setError(
        "Seller storefront not available."
      );

      return;
    }

    const controller =
      new AbortController();

    const loadStorefront =
      async () => {
        try {
          setLoading(
            true
          );

          setError(
            ""
          );

          const response =
            await fetch(
              `${API_URL}/api/vendor/storefront/${encodeURIComponent(
                vendorId
              )}`,
              {
                signal:
                  controller.signal,

                cache:
                  "no-store",
              }
            );

          const data =
            await response.json() as
              StorefrontResponse;

          if (
            !response.ok ||
            !data.success ||
            !data.storefront
          ) {
            throw new Error(
              data.message ||
                "Seller storefront not available."
            );
          }

          setStorefront(
            data.storefront
          );

          setProducts(
            Array.isArray(
              data.products
            )
              ? data.products
              : []
          );
        } catch (
          storefrontError
        ) {
          if (
            storefrontError instanceof
              DOMException &&
            storefrontError.name ===
              "AbortError"
          ) {
            return;
          }

          console.error(
            "Storefront load error:",
            storefrontError
          );

          setStorefront(
            null
          );

          setProducts(
            []
          );

          setError(
            storefrontError instanceof
              Error
              ? storefrontError.message
              : "Seller storefront not available."
          );
        } finally {
          if (
            !controller.signal
              .aborted
          ) {
            setLoading(
              false
            );
          }
        }
      };

    void loadStorefront();

    return () => {
      controller.abort();
    };
  }, [
    vendorId,
  ]);

  /*
   * =====================================================
   * LOADING
   * =====================================================
   */

  if (
    loading
  ) {
    return (
      <PageShell
        title="Seller storefront"
        description="Loading this CampusMart seller."
      >
        <div className="animate-pulse space-y-6">
          <section className="site-card h-72 bg-slate-100" />

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              1,
              2,
              3,
            ].map(
              (
                item
              ) => (
                <div
                  key={
                    item
                  }
                  className="site-card h-[360px] bg-slate-100"
                />
              )
            )}
          </div>
        </div>
      </PageShell>
    );
  }

  /*
   * =====================================================
   * UNAVAILABLE STOREFRONT
   * =====================================================
   */

  if (
    error ||
    !storefront
  ) {
    return (
      <PageShell
        title="Seller storefront"
        description="Browse trusted sellers on CampusMart."
      >
        <div className="site-card mx-auto max-w-xl p-8 text-center sm:p-10">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-2xl">
            🏪
          </div>

          <h1 className="mt-5 text-2xl font-bold text-slate-950">
            Storefront unavailable
          </h1>

          <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-slate-600">
            This seller storefront is
            unavailable or is not
            currently active on
            CampusMart.
          </p>

          <Link
            href="/marketplace"
            className="mt-6 inline-flex rounded-[10px] bg-accent-400 px-5 py-3 text-sm font-bold text-black transition hover:bg-accent-500"
          >
            Browse marketplace
          </Link>
        </div>
      </PageShell>
    );
  }

  const university =
    storefront.university;

  const universityLabel =
    university
      ? university.shortName ||
        university.name
      : "";

  const locationLabel =
    university
      ? [
          university.city,
          university.state,
        ]
          .filter(
            Boolean
          )
          .join(
            ", "
          )
      : "";

  const memberSince =
    formatMemberSince(
      storefront.memberSince
    );

  const initials =
    sellerInitials(
      storefront.businessName
    );

  return (
    <PageShell
      title={
        storefront.businessName
      }
      description={`Shop from ${storefront.businessName} on CampusMart.`}
    >
      {/*
       * =================================================
       * STOREFRONT HEADER
       * =================================================
       */}

      <section className="site-card overflow-hidden">
        <div className="bg-slate-950 px-5 py-8 sm:px-8 sm:py-10">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-3xl border border-white/10 bg-white text-2xl font-black text-slate-950 shadow-xl">
              {
                initials
              }
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
                  {
                    storefront.businessName
                  }
                </h1>

                {storefront.badges
                  .vendorVerified ? (
                  <span className="rounded-full border border-blue-400/30 bg-blue-400/10 px-3 py-1 text-xs font-bold text-blue-200">
                    Verified vendor
                  </span>
                ) : null}

                {storefront.badges
                  .studentVerified ? (
                  <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-bold text-emerald-200">
                    Verified student
                  </span>
                ) : null}
              </div>

              <p className="mt-2 text-sm text-slate-300">
                Run by{" "}
                <span className="font-semibold text-white">
                  {
                    storefront.ownerName
                  }
                </span>
              </p>

              <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-slate-300">
                {universityLabel ? (
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                    🎓{" "}
                    {
                      universityLabel
                    }
                  </span>
                ) : null}

                {locationLabel ? (
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                    📍{" "}
                    {
                      locationLabel
                    }
                  </span>
                ) : null}

                {memberSince ? (
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                    Member since{" "}
                    {
                      memberSince
                    }
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 px-5 py-6 sm:px-8 lg:grid-cols-[1fr_auto] lg:items-start">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
              About this shop
            </p>

            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-700">
              {
                storefront.description
              }
            </p>
          </div>

          <div className="grid min-w-[180px] grid-cols-2 gap-3">
            <div className="rounded-2xl bg-slate-50 p-4 text-center">
              <p className="text-2xl font-black text-slate-950">
                {
                  storefront.listingCount
                }
              </p>

              <p className="mt-1 text-xs font-semibold text-slate-500">
                Active{" "}
                {storefront.listingCount ===
                1
                  ? "listing"
                  : "listings"}
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4 text-center">
              <p className="text-2xl font-black text-slate-950">
                {storefront.badges
                  .studentVerified
                  ? "✓"
                  : "—"}
              </p>

              <p className="mt-1 text-xs font-semibold text-slate-500">
                Student status
              </p>
            </div>
          </div>
        </div>
      </section>

      {/*
       * =================================================
       * LISTINGS
       * =================================================
       */}

      <section className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
              Shop listings
            </p>

            <h2 className="mt-2 text-2xl font-black text-slate-950">
              Available now
            </h2>
          </div>

          <Link
            href="/marketplace"
            className="text-sm font-bold text-slate-700 transition hover:text-black"
          >
            Browse all CampusMart →
          </Link>
        </div>

        {products.length >
        0 ? (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {products.map(
              (
                product
              ) => (
                <Link
                  key={
                    product.id
                  }
                  href={`/marketplace/products/${product.id}`}
                  className="site-card group overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg"
                >
                  {product.images
                    .length >
                  0 ? (
                    <img
                      src={
                        product
                          .images[0]
                      }
                      alt={
                        product.title
                      }
                      className="h-52 w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                    />
                  ) : (
                    <div className="flex h-52 items-center justify-center bg-slate-950 px-6 text-center text-sm font-bold text-white">
                      CampusMart
                      listing
                    </div>
                  )}

                  <div className="p-5">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                      {
                        product.category
                      }
                    </p>

                    <h3 className="mt-2 line-clamp-1 text-lg font-bold text-slate-950">
                      {
                        product.title
                      }
                    </h3>

                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">
                      {
                        product.description
                      }
                    </p>

                    <div className="mt-5 flex items-center justify-between gap-3">
                      <p className="text-lg font-black text-slate-950">
                        {formatNaira(
                          product.price
                        )}
                      </p>

                      <span className="text-sm font-bold text-slate-500 transition group-hover:text-black">
                        View →
                      </span>
                    </div>
                  </div>
                </Link>
              )
            )}
          </div>
        ) : (
          <div className="site-card mt-6 p-8 text-center">
            <h3 className="text-xl font-bold text-slate-950">
              No active listings
            </h3>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              This seller does not
              currently have any
              products available.
            </p>
          </div>
        )}
      </section>
    </PageShell>
  );
}