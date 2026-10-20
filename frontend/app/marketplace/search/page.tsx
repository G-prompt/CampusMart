"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";

import {
  useRouter,
} from "next/navigation";

import ProductCard from "@/components/common/ProductCard";

import type {
  Product,
} from "@/lib/products";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:5000";

const PAGE_SIZE =
  15;

function normalise(
  value:
    string
) {
  return value
    .toLowerCase()
    .replace(
      /&/g,
      " "
    )
    .replace(
      /[^a-z0-9]+/g,
      " "
    )
    .trim();
}

export default function SearchPage() {
  const router =
    useRouter();

  const [
    query,
    setQuery,
  ] =
    useState(
      ""
    );

  const [
    submittedQuery,
    setSubmittedQuery,
  ] =
    useState(
      ""
    );

  const [
    products,
    setProducts,
  ] =
    useState<Product[]>(
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

  const [
    page,
    setPage,
  ] =
    useState(
      1
    );

  useEffect(() => {
    const initialQuery =
      new URLSearchParams(
        window.location.search
      ).get(
        "q"
      ) ??
      "";

    setQuery(
      initialQuery
    );

    setSubmittedQuery(
      initialQuery
    );
  }, []);

  useEffect(() => {
    const controller =
      new AbortController();

    const load =
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
              `${API_URL}/api/products`,
              {
                cache:
                  "no-store",

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
                "Unable to load marketplace listings."
            );
          }

          setProducts(
            Array.isArray(
              data.products
            )
              ? data.products
              : []
          );
        } catch (
          loadError
        ) {
          if (
            loadError instanceof
              DOMException &&
            loadError.name ===
              "AbortError"
          ) {
            return;
          }

          setError(
            loadError instanceof
              Error
              ? loadError.message
              : "Unable to search listings."
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

    void load();

    return () =>
      controller.abort();
  }, []);

  const matches =
    useMemo(
      () => {
        const clean =
          normalise(
            submittedQuery
          );

        if (
          !clean
        ) {
          return products;
        }

        const terms =
          clean.split(
            /\s+/
          );

        return products
          .map(
            (
              product
            ) => {
              const title =
                normalise(
                  product.title
                );

              const category =
                normalise(
                  product.category
                );

              const seller =
                normalise(
                  product.seller
                );

              const description =
                normalise(
                  product.description
                );

              let score =
                0;

              if (
                title.includes(
                  clean
                )
              ) {
                score +=
                  100;
              }

              if (
                category.includes(
                  clean
                )
              ) {
                score +=
                  50;
              }

              for (
                const term of
                terms
              ) {
                if (
                  title.includes(
                    term
                  )
                ) {
                  score +=
                    20;
                }

                if (
                  category.includes(
                    term
                  )
                ) {
                  score +=
                    12;
                }

                if (
                  description.includes(
                    term
                  )
                ) {
                  score +=
                    6;
                }

                if (
                  seller.includes(
                    term
                  )
                ) {
                  score +=
                    3;
                }
              }

              return {
                product,
                score,
              };
            }
          )
          .filter(
            (
              item
            ) =>
              item.score >
              0
          )
          .sort(
            (
              first,
              second
            ) =>
              second.score -
              first.score
          )
          .map(
            (
              item
            ) =>
              item.product
          );
      },
      [
        products,
        submittedQuery,
      ]
    );

  useEffect(() => {
    setPage(
      1
    );
  }, [
    submittedQuery,
  ]);

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        matches.length /
          PAGE_SIZE
      )
    );

  const pageProducts =
    matches.slice(
      (
        page -
        1
      ) *
        PAGE_SIZE,

      page *
        PAGE_SIZE
    );

  const handleSubmit =
    (
      event:
        FormEvent<HTMLFormElement>
    ) => {
      event.preventDefault();

      const next =
        query.trim();

      setSubmittedQuery(
        next
      );

      router.replace(
        next
          ? `/marketplace/search?q=${encodeURIComponent(
              next
            )}`
          : "/marketplace/search",
        {
          scroll:
            false,
        }
      );
    };

  return (
    <main className="main-container pb-28 pt-5 lg:pb-32">
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/marketplace"
          className="text-xs font-black text-slate-500 hover:text-black"
        >
          ← CampusMart
        </Link>

        <Link
          href="/marketplace"
          className="text-xs font-black text-slate-500 hover:text-black"
        >
          Browse all
        </Link>
      </div>

      <form
        onSubmit={
          handleSubmit
        }
        className="mt-5 flex gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2"
      >
        <input
          value={
            query
          }
          onChange={(
            event
          ) =>
            setQuery(
              event.target.value
            )
          }
          className="min-w-0 flex-1 rounded-xl border-0 bg-white px-4 py-3 text-sm outline-none"
          placeholder="Search CampusMart"
        />

        <button
          type="submit"
          className="rounded-xl bg-black px-5 py-3 text-sm font-black text-white"
        >
          Search
        </button>
      </form>

      {!loading &&
      !error ? (
        <p className="mt-5 text-xs font-semibold text-slate-500">
          {submittedQuery
            ? `${matches.length} result${
                matches.length ===
                1
                  ? ""
                  : "s"
              } for “${submittedQuery}”`
            : `${matches.length} available listings`}
        </p>
      ) : null}

      {loading ? (
        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({
            length:
              15,
          }).map(
            (
              _,
              index
            ) => (
              <div
                key={
                  index
                }
                className="aspect-[0.72] animate-pulse rounded-xl bg-slate-100"
              />
            )
          )}
        </div>
      ) : null}

      {error ? (
        <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-6 text-sm font-semibold text-red-700">
          {
            error
          }
        </div>
      ) : null}

      {!loading &&
      !error &&
      pageProducts.length >
        0 ? (
        <>
          <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
            {pageProducts.map(
              (
                product
              ) => (
                <ProductCard
                  key={
                    product.id
                  }
                  product={
                    product
                  }
                />
              )
            )}
          </div>

          {totalPages >
          1 ? (
            <div className="mt-7 grid grid-cols-3 items-center border-t border-slate-200 pt-5">
              <div>
                {page >
                1 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setPage(
                        (
                          current
                        ) =>
                          current -
                          1
                      );

                      window.scrollTo({
                        top:
                          0,
                        behavior:
                          "smooth",
                      });
                    }}
                    className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-black"
                  >
                    ← Previous
                  </button>
                ) : null}
              </div>

              <p className="text-center text-xs font-bold text-slate-400">
                {page} /{" "}
                {
                  totalPages
                }
              </p>

              <div className="text-right">
                {page <
                totalPages ? (
                  <button
                    type="button"
                    onClick={() => {
                      setPage(
                        (
                          current
                        ) =>
                          current +
                          1
                      );

                      window.scrollTo({
                        top:
                          0,
                        behavior:
                          "smooth",
                      });
                    }}
                    className="rounded-full bg-[#4A1724] px-4 py-2 text-xs font-black text-white"
                  >
                    Next →
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      {!loading &&
      !error &&
      pageProducts.length ===
        0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-300 p-10 text-center">
          <h2 className="text-xl font-black">
            No close matches yet
          </h2>

          <Link
            href="/marketplace"
            className="mt-5 inline-flex rounded-xl bg-accent-400 px-5 py-3 text-sm font-black"
          >
            Explore marketplace
          </Link>
        </div>
      ) : null}
    </main>
  );
}