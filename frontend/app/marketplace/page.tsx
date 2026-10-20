"use client";

import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  useRouter,
  useSearchParams,
} from "next/navigation";

import AutoScrollProducts from "@/components/common/AutoScrollProducts";
import ProductCard from "@/components/common/ProductCard";

import {
  FilterIcon,
} from "@/components/common/icons";

import {
  useAuth,
} from "@/components/common/AuthContext";

import {
  categories,
  type Product,
} from "@/lib/products";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:5000";

const PAGE_SIZE =
  15;

const MAIN_CATEGORIES = [
  {
    label: "All",
    value: "All",
  },

  {
    label: "Clothes",
    value: "Clothes & Accessories",
  },

  {
    label: "Shoes & Bags",
    value: "Shoes & Bags",
  },

  {
    label: "Tech",
    value: "Technology",
  },
];

const RELATED_TERMS: Record<
  string,
  string[]
> = {
  iphone: [
    "phone",
    "smartphone",
    "apple",
    "charger",
    "cable",
    "case",
    "pouch",
    "powerbank",
    "earphones",
    "headphones",
  ],

  phone: [
    "iphone",
    "android",
    "smartphone",
    "charger",
    "cable",
    "case",
    "pouch",
    "powerbank",
    "earphones",
  ],

  laptop: [
    "computer",
    "charger",
    "mouse",
    "keyboard",
    "stand",
    "bag",
    "ssd",
    "storage",
    "adapter",
  ],

  computer: [
    "laptop",
    "keyboard",
    "mouse",
    "monitor",
    "charger",
    "ssd",
  ],

  shoe: [
    "shoes",
    "sneaker",
    "trainers",
    "bag",
    "clothes",
    "fashion",
  ],

  shoes: [
    "shoe",
    "sneaker",
    "trainers",
    "bag",
    "clothes",
    "fashion",
  ],

  book: [
    "books",
    "notes",
    "revision",
    "textbook",
    "academic",
    "stationery",
  ],

  books: [
    "book",
    "notes",
    "revision",
    "textbook",
    "academic",
    "stationery",
  ],

  food: [
    "drink",
    "snack",
    "meal",
    "breakfast",
    "lunch",
    "dinner",
  ],
};

type MarketplaceProduct =
  Product & {
    vendorId?: string;

    sellerCampus?:
      | string
      | null;

    sellerUniversityId?:
      | string
      | null;

    demandScore?: number;
  };

function normalise(
  value: string
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

function tokens(
  value: string
) {
  return normalise(
    value
  )
    .split(
      /\s+/
    )
    .filter(
      (
        token
      ) =>
        token.length >
        1
    );
}

function expandedTerms(
  query: string
) {
  const base =
    tokens(
      query
    );

  const expanded =
    new Set<string>(
      base
    );

  for (
    const token of
    base
  ) {
    for (
      const related of
      RELATED_TERMS[
        token
      ] ?? []
    ) {
      expanded.add(
        related
      );
    }
  }

  return Array.from(
    expanded
  );
}

function searchScore(
  product:
    MarketplaceProduct,
  query: string
) {
  const cleanedQuery =
    normalise(
      query
    );

  if (
    !cleanedQuery
  ) {
    return 0;
  }

  const title =
    normalise(
      product.title
    );

  const category =
    normalise(
      product.category
    );

  const description =
    normalise(
      product.description
    );

  const seller =
    normalise(
      product.seller
    );

  let score =
    0;

  if (
    title.includes(
      cleanedQuery
    )
  ) {
    score += 100;
  }

  if (
    category.includes(
      cleanedQuery
    )
  ) {
    score += 55;
  }

  if (
    description.includes(
      cleanedQuery
    )
  ) {
    score += 30;
  }

  const directTerms =
    tokens(
      query
    );

  const allTerms =
    expandedTerms(
      query
    );

  for (
    const term of
    directTerms
  ) {
    if (
      title.includes(
        term
      )
    ) {
      score += 22;
    }

    if (
      category.includes(
        term
      )
    ) {
      score += 14;
    }

    if (
      description.includes(
        term
      )
    ) {
      score += 8;
    }

    if (
      seller.includes(
        term
      )
    ) {
      score += 3;
    }
  }

  for (
    const term of
    allTerms
  ) {
    if (
      directTerms.includes(
        term
      )
    ) {
      continue;
    }

    if (
      title.includes(
        term
      )
    ) {
      score += 7;
    }

    if (
      category.includes(
        term
      )
    ) {
      score += 5;
    }

    if (
      description.includes(
        term
      )
    ) {
      score += 2;
    }
  }

  return score;
}

function MarketplaceContent() {
  const router =
    useRouter();

  const searchParams =
    useSearchParams();

  const {
    user,
  } =
    useAuth();

  const userUniversityId =
    user?.universityId
      ?.trim() || "";

  const userCampus =
    user?.campus
      ?.trim() || "";

  const universityLabel =
    user?.university
      ?.shortName ||
    user?.university
      ?.name ||
    userCampus ||
    "";

  const [
    activeCategory,
    setActiveCategory,
  ] =
    useState(
      "All"
    );

  const [
    sortBy,
    setSortBy,
  ] =
    useState(
      "newest"
    );

  const [
    maxPrice,
    setMaxPrice,
  ] =
    useState(
      "all"
    );

  const [
    filtersOpen,
    setFiltersOpen,
  ] =
    useState(
      false
    );

  const [
    moreCategoriesOpen,
    setMoreCategoriesOpen,
  ] =
    useState(
      false
    );

  const [
    products,
    setProducts,
  ] =
    useState<
      MarketplaceProduct[]
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

  const [
    currentPage,
    setCurrentPage,
  ] =
    useState(
      1
    );

  const [
    recentSearches,
    setRecentSearches,
  ] =
    useState<
      string[]
    >(
      []
    );

  const filterCloseRef =
    useRef<HTMLButtonElement>(
      null
    );

  const marketRef =
    useRef<HTMLElement>(
      null
    );

  const searchQuery =
    (
      searchParams.get(
        "q"
      ) ?? ""
    ).trim();

  useEffect(() => {
    const requestedCategory =
      searchParams.get(
        "category"
      ) ?? "All";

    setActiveCategory(
      categories.includes(
        requestedCategory
      )
        ? requestedCategory
        : "All"
    );

    setSortBy(
      searchParams.get(
        "sort"
      ) ?? "newest"
    );

    setMaxPrice(
      searchParams.get(
        "maxPrice"
      ) ?? "all"
    );
  }, [
    searchParams,
  ]);

  useEffect(() => {
    try {
      const stored =
        JSON.parse(
          localStorage.getItem(
            "campusmart-search-history"
          ) ?? "[]"
        );

      setRecentSearches(
        Array.isArray(
          stored
        )
          ? stored
              .filter(
                (
                  value
                ) =>
                  typeof value ===
                  "string"
              )
              .slice(
                0,
                8
              )
          : []
      );
    } catch {
      setRecentSearches(
        []
      );
    }
  }, []);

  useEffect(() => {
    if (
      !searchQuery
    ) {
      return;
    }

    setRecentSearches(
      (
        previous
      ) => {
        const next =
          [
            searchQuery,

            ...previous.filter(
              (
                item
              ) =>
                normalise(
                  item
                ) !==
                normalise(
                  searchQuery
                )
            ),
          ].slice(
            0,
            8
          );

        localStorage.setItem(
          "campusmart-search-history",
          JSON.stringify(
            next
          )
        );

        return next;
      }
    );
  }, [
    searchQuery,
  ]);

  useEffect(() => {
    const controller =
      new AbortController();

    const loadProducts =
      async () => {
        try {
          setLoading(
            true
          );

          setError(
            ""
          );

          const params =
            new URLSearchParams();

          if (
            userUniversityId
          ) {
            params.set(
              "universityId",
              userUniversityId
            );
          } else if (
            userCampus
          ) {
            params.set(
              "campus",
              userCampus
            );
          }

          const response =
            await fetch(
              `${API_URL}/api/products${
                params.toString()
                  ? `?${params.toString()}`
                  : ""
              }`,
              {
                signal:
                  controller.signal,

                cache:
                  "no-store",
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

          console.error(
            "Marketplace products error:",
            loadError
          );

          setError(
            "Unable to load marketplace listings."
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

    void loadProducts();

    return () => {
      controller.abort();
    };
  }, [
    userUniversityId,
    userCampus,
  ]);

  useEffect(() => {
    if (
      !filtersOpen
    ) {
      return;
    }

    const closeOnEscape =
      (
        event:
          KeyboardEvent
      ) => {
        if (
          event.key ===
          "Escape"
        ) {
          setFiltersOpen(
            false
          );
        }
      };

    document.body.style.overflow =
      "hidden";

    window.addEventListener(
      "keydown",
      closeOnEscape
    );

    filterCloseRef.current
      ?.focus();

    return () => {
      document.body.style.overflow =
        "";

      window.removeEventListener(
        "keydown",
        closeOnEscape
      );
    };
  }, [
    filtersOpen,
  ]);

  const replaceParams =
    (
      updates: Record<
        string,
        string | null
      >
    ) => {
      const params =
        new URLSearchParams(
          searchParams.toString()
        );

      Object.entries(
        updates
      ).forEach(
        (
          [
            key,
            value,
          ]
        ) => {
          if (
            !value
          ) {
            params.delete(
              key
            );
          } else {
            params.set(
              key,
              value
            );
          }
        }
      );

      router.replace(
        `/marketplace${
          params.toString()
            ? `?${params.toString()}`
            : ""
        }`,
        {
          scroll:
            false,
        }
      );
    };

  const selectCategory =
    (
      category: string
    ) => {
      setActiveCategory(
        category
      );

      setCurrentPage(
        1
      );

      setMoreCategoriesOpen(
        false
      );

      replaceParams({
        category:
          category ===
          "All"
            ? null
            : category,
      });
    };

  const resetFilters =
    () => {
      setSortBy(
        "newest"
      );

      setMaxPrice(
        "all"
      );

      setCurrentPage(
        1
      );

      replaceParams({
        sort:
          null,

        maxPrice:
          null,
      });
    };

  const eligibleProducts =
    useMemo(
      () =>
        products.filter(
          (
            product
          ) =>
            maxPrice ===
              "all" ||
            product.price <=
              Number(
                maxPrice
              )
        ),
      [
        products,
        maxPrice,
      ]
    );

  const isLocalProduct =
    (
      product:
        MarketplaceProduct
    ) => {
      if (
        userUniversityId &&
        product.sellerUniversityId
      ) {
        return (
          userUniversityId ===
          product.sellerUniversityId
        );
      }

      if (
        userCampus &&
        product.sellerCampus
      ) {
        return (
          normalise(
            userCampus
          ) ===
          normalise(
            product.sellerCampus
          )
        );
      }

      return false;
    };

  const normalSort =
    (
      first:
        MarketplaceProduct,
      second:
        MarketplaceProduct
    ) => {
      if (
        sortBy ===
        "price-low"
      ) {
        return (
          first.price -
          second.price
        );
      }

      if (
        sortBy ===
        "price-high"
      ) {
        return (
          second.price -
          first.price
        );
      }

      if (
        sortBy ===
        "rating"
      ) {
        return (
          second.rating -
          first.rating
        );
      }

      return (
        second.id -
        first.id
      );
    };

  const selectedCategoryCount =
    activeCategory ===
    "All"
      ? eligibleProducts.length
      : eligibleProducts.filter(
          (
            product
          ) =>
            product.category ===
            activeCategory
        ).length;

  const searchMatchCount =
    searchQuery
      ? eligibleProducts.filter(
          (
            product
          ) =>
            searchScore(
              product,
              searchQuery
            ) >
            0
        ).length
      : 0;

  const rankedProducts =
    useMemo(
      () =>
        [
          ...eligibleProducts,
        ].sort(
          (
            first,
            second
          ) => {
            const firstSearch =
              searchScore(
                first,
                searchQuery
              );

            const secondSearch =
              searchScore(
                second,
                searchQuery
              );

            const firstCategory =
              activeCategory ===
                "All" ||
              first.category ===
                activeCategory;

            const secondCategory =
              activeCategory ===
                "All" ||
              second.category ===
                activeCategory;

            const firstRelevant =
              searchQuery
                ? firstSearch >
                  0
                : firstCategory;

            const secondRelevant =
              searchQuery
                ? secondSearch >
                  0
                : secondCategory;

            if (
              firstRelevant !==
              secondRelevant
            ) {
              return firstRelevant
                ? -1
                : 1;
            }

            const firstLocal =
              isLocalProduct(
                first
              );

            const secondLocal =
              isLocalProduct(
                second
              );

            if (
              firstLocal !==
              secondLocal
            ) {
              return firstLocal
                ? -1
                : 1;
            }

            if (
              firstSearch !==
              secondSearch
            ) {
              return (
                secondSearch -
                firstSearch
              );
            }

            if (
              firstCategory !==
              secondCategory
            ) {
              return firstCategory
                ? -1
                : 1;
            }

            return normalSort(
              first,
              second
            );
          }
        ),
      [
        eligibleProducts,
        activeCategory,
        searchQuery,
        sortBy,
        userUniversityId,
        userCampus,
      ]
    );

  const popularProducts =
    useMemo(
      () =>
        [
          ...eligibleProducts,
        ]
          .filter(
            (
              product
            ) =>
              Number(
                product.demandScore ??
                  0
              ) >
              0
          )
          .sort(
            (
              first,
              second
            ) => {
              const firstLocal =
                isLocalProduct(
                  first
                );

              const secondLocal =
                isLocalProduct(
                  second
                );

              if (
                firstLocal !==
                secondLocal
              ) {
                return firstLocal
                  ? -1
                  : 1;
              }

              const scoreDifference =
                Number(
                  second.demandScore ??
                    0
                ) -
                Number(
                  first.demandScore ??
                    0
                );

              if (
                scoreDifference !==
                0
              ) {
                return scoreDifference;
              }

              return (
                second.id -
                first.id
              );
            }
          )
          .slice(
            0,
            15
          ),
      [
        eligibleProducts,
        userUniversityId,
        userCampus,
      ]
    );

  const recommendationSeed =
    searchQuery ||
    recentSearches[0] ||
    "";

  const youMayLike =
    useMemo(
      () => {
        if (
          !recommendationSeed
        ) {
          return [];
        }

        const exactQuery =
          normalise(
            searchQuery
          );

        return [
          ...eligibleProducts,
        ]
          .map(
            (
              product
            ) => ({
              product,

              score:
                searchScore(
                  product,
                  recommendationSeed
                ),
            })
          )
          .filter(
            (
              item
            ) => {
              if (
                item.score <=
                0
              ) {
                return false;
              }

              if (
                exactQuery &&
                normalise(
                  item.product.title
                ).includes(
                  exactQuery
                )
              ) {
                return false;
              }

              return true;
            }
          )
          .sort(
            (
              first,
              second
            ) => {
              const firstLocal =
                isLocalProduct(
                  first.product
                );

              const secondLocal =
                isLocalProduct(
                  second.product
                );

              if (
                firstLocal !==
                secondLocal
              ) {
                return firstLocal
                  ? -1
                  : 1;
              }

              return (
                second.score -
                first.score
              );
            }
          )
          .slice(
            0,
            15
          )
          .map(
            (
              item
            ) =>
              item.product
          );
      },
      [
        eligibleProducts,
        recommendationSeed,
        searchQuery,
        userUniversityId,
        userCampus,
      ]
    );

  useEffect(() => {
    setCurrentPage(
      1
    );
  }, [
    activeCategory,
    maxPrice,
    sortBy,
    searchQuery,
  ]);

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        rankedProducts.length /
          PAGE_SIZE
      )
    );

  useEffect(() => {
    if (
      currentPage >
      totalPages
    ) {
      setCurrentPage(
        totalPages
      );
    }
  }, [
    currentPage,
    totalPages,
  ]);

  const pageProducts =
    rankedProducts.slice(
      (
        currentPage -
        1
      ) *
        PAGE_SIZE,

      currentPage *
        PAGE_SIZE
    );

  const changePage =
    (
      nextPage: number
    ) => {
      setCurrentPage(
        nextPage
      );

      window.requestAnimationFrame(
        () => {
          marketRef.current
            ?.scrollIntoView({
              behavior:
                "smooth",

              block:
                "start",
            });
        }
      );
    };

  const mainCategoryValues =
    MAIN_CATEGORIES.map(
      (
        item
      ) =>
        item.value
    );

  const moreCategories =
    categories.filter(
      (
        category
      ) =>
        !mainCategoryValues.includes(
          category
        )
    );

  const categoryHasNoListings =
    !searchQuery &&
    activeCategory !==
      "All" &&
    selectedCategoryCount ===
      0;

  const searchHasNoMatches =
    Boolean(
      searchQuery
    ) &&
    searchMatchCount ===
      0;

  let mainHeading =
    "Explore the marketplace";

  let mainDescription =
    universityLabel
      ? `Showing nearby listings from ${universityLabel} first, then expanding across CampusMart.`
      : "Explore available listings from CampusMart sellers.";

  if (
    searchQuery
  ) {
    mainHeading =
      searchHasNoMatches
        ? `No exact matches for “${searchQuery}”`
        : `Results for “${searchQuery}”`;

    mainDescription =
      searchHasNoMatches
        ? "We couldn't find an exact match, so here are other things you may like."
        : universityLabel
          ? `Relevant listings from ${universityLabel} are prioritised first.`
          : "The closest matches are shown first.";
  } else if (
    activeCategory !==
    "All"
  ) {
    mainHeading =
      categoryHasNoListings
        ? `No ${activeCategory} yet`
        : activeCategory;

    mainDescription =
      categoryHasNoListings
        ? maxPrice ===
          "all"
          ? "Nothing has been listed in this category yet. You may like these instead."
          : "Nothing in this category matches your current filters. You may like these instead."
        : `Showing ${activeCategory} first, then continuing with other marketplace finds.`;
  }

  return (
    <main className="main-container pb-28 pt-4 sm:pt-5 lg:pb-32">
      <section className="sticky top-[70px] z-30 -mx-2 py-3 sm:top-[78px] sm:-mx-3">
        <div className="mx-auto flex w-fit max-w-full items-center justify-center rounded-[24px] border border-white/80 bg-[#FBF6ED]/90 p-1.5 shadow-[0_14px_45px_rgba(74,23,36,0.15)] backdrop-blur-2xl">
          {MAIN_CATEGORIES.map(
            (
              item
            ) => (
              <button
                key={
                  item.value
                }
                type="button"
                onClick={() =>
                  selectCategory(
                    item.value
                  )
                }
                className={`whitespace-nowrap rounded-[17px] px-2.5 py-2 text-[10px] font-black transition min-[390px]:px-3 min-[390px]:text-[11px] sm:px-4 sm:text-sm ${
                  activeCategory ===
                  item.value
                    ? "bg-[#4A1724] text-white shadow-sm"
                    : "text-[#755861] hover:bg-[#F0E2D6] hover:text-[#4A1724]"
                }`}
              >
                {
                  item.label
                }
              </button>
            )
          )}

          <div className="relative">
            <button
              type="button"
              onClick={() =>
                setMoreCategoriesOpen(
                  (
                    open
                  ) =>
                    !open
                )
              }
              className={`whitespace-nowrap rounded-[17px] px-2.5 py-2 text-[10px] font-black transition min-[390px]:px-3 min-[390px]:text-[11px] sm:px-4 sm:text-sm ${
                moreCategories.includes(
                  activeCategory
                )
                  ? "bg-[#4A1724] text-white shadow-sm"
                  : "text-[#755861] hover:bg-[#F0E2D6] hover:text-[#4A1724]"
              }`}
            >
              More{" "}

              <span
                className={`inline-block transition-transform ${
                  moreCategoriesOpen
                    ? "rotate-180"
                    : ""
                }`}
              >
                ⌄
              </span>
            </button>

            {moreCategoriesOpen ? (
              <div className="absolute right-0 top-[calc(100%+0.65rem)] w-[270px] overflow-hidden rounded-2xl border border-[#E5D8CC] bg-[#FBF6ED]/95 p-2 shadow-2xl backdrop-blur-2xl sm:left-1/2 sm:right-auto sm:-translate-x-1/2">
                <div className="max-h-[390px] overflow-y-auto">
                  {moreCategories.map(
                    (
                      category
                    ) => (
                      <button
                        key={
                          category
                        }
                        type="button"
                        onClick={() =>
                          selectCategory(
                            category
                          )
                        }
                        className={`block w-full rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${
                          activeCategory ===
                          category
                            ? "bg-[#4A1724] text-white"
                            : "text-slate-700 hover:bg-[#F0E2D6]"
                        }`}
                      >
                        {
                          category
                        }
                      </button>
                    )
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {!loading &&
      !error &&
      !searchQuery &&
      activeCategory ===
        "All" &&
      popularProducts.length >
        0 ? (
        <section className="mt-7">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#8A6670]">
            Campus demand
          </p>

          <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
            Most popular
          </h2>

          <p className="mt-1 max-w-xl text-xs leading-5 text-slate-500 sm:text-sm">
            What students
            {universityLabel
              ? ` at ${universityLabel}`
              : ""}
            {" "}
            are actually buying.
          </p>

          <div className="mt-4">
            <AutoScrollProducts
              products={
                popularProducts
              }
            />
          </div>
        </section>
      ) : null}

      <section
        ref={
          marketRef
        }
        className="scroll-mt-[150px] pt-10"
      >
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-4">
          <div className="max-w-2xl">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#8A6670]">
              CampusMart
            </p>

            <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
              {
                mainHeading
              }
            </h1>

            <p className="mt-2 text-xs leading-5 text-slate-500 sm:text-sm">
              {
                mainDescription
              }
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setFiltersOpen(
                  true
                )
              }
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-xs font-black text-slate-700 shadow-sm md:hidden"
            >
              <FilterIcon />

              Filter
            </button>

            <div className="hidden items-center gap-2 md:flex">
              <label className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600">
                Price{" "}

                <select
                  value={
                    maxPrice
                  }
                  onChange={(
                    event
                  ) => {
                    setMaxPrice(
                      event.target.value
                    );

                    replaceParams({
                      maxPrice:
                        event.target.value ===
                        "all"
                          ? null
                          : event.target.value,
                    });
                  }}
                  className="bg-transparent font-black text-black outline-none"
                >
                  <option value="all">
                    Any
                  </option>

                  <option value="10000">
                    Under ₦10k
                  </option>

                  <option value="20000">
                    Under ₦20k
                  </option>

                  <option value="30000">
                    Under ₦30k
                  </option>
                </select>
              </label>

              <label className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600">
                Sort{" "}

                <select
                  value={
                    sortBy
                  }
                  onChange={(
                    event
                  ) => {
                    setSortBy(
                      event.target.value
                    );

                    replaceParams({
                      sort:
                        event.target.value ===
                        "newest"
                          ? null
                          : event.target.value,
                    });
                  }}
                  className="bg-transparent font-black text-black outline-none"
                >
                  <option value="newest">
                    Newest
                  </option>

                  <option value="rating">
                    Top rated
                  </option>

                  <option value="price-low">
                    Price low
                  </option>

                  <option value="price-high">
                    Price high
                  </option>
                </select>
              </label>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="mt-5 grid grid-cols-2 gap-2.5 min-[520px]:grid-cols-3 lg:grid-cols-5 lg:gap-3">
            {Array.from({
              length:
                PAGE_SIZE,
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
          <p className="mt-10 text-center text-sm font-semibold text-red-600">
            {
              error
            }
          </p>
        ) : null}

        {!loading &&
        !error ? (
          <>
            <div className="mt-5 grid grid-cols-2 gap-2.5 min-[520px]:grid-cols-3 lg:grid-cols-5 lg:gap-3">
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
                    compact
                  />
                )
              )}
            </div>

            {pageProducts.length ===
            0 ? (
              <div className="mt-8 rounded-2xl border border-dashed border-slate-300 p-8 text-center">
                <p className="font-bold text-slate-900">
                  Nothing available right now.
                </p>
              </div>
            ) : null}

            {rankedProducts.length >
            PAGE_SIZE ? (
              <div className="mt-8 grid grid-cols-3 items-center border-t border-slate-200 pt-5">
                <div>
                  {currentPage >
                  1 ? (
                    <button
                      type="button"
                      onClick={() =>
                        changePage(
                          currentPage -
                            1
                        )
                      }
                      className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 transition hover:border-slate-400"
                    >
                      ← Previous
                    </button>
                  ) : null}
                </div>

                <p className="text-center text-xs font-bold text-slate-400">
                  {
                    currentPage
                  }
                  {" / "}
                  {
                    totalPages
                  }
                </p>

                <div className="text-right">
                  {currentPage <
                  totalPages ? (
                    <button
                      type="button"
                      onClick={() =>
                        changePage(
                          currentPage +
                            1
                        )
                      }
                      className="rounded-full bg-[#4A1724] px-4 py-2 text-sm font-black text-white transition hover:bg-[#351019]"
                    >
                      Next →
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </section>

      {!loading &&
      !error &&
      youMayLike.length >
        0 &&
      !categoryHasNoListings &&
      !searchHasNoMatches ? (
        <section className="mt-12 border-t border-slate-200 pt-8">
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#8A6670]">
            For you
          </p>

          <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">
            You may like
          </h2>

          <p className="mt-1 text-xs text-slate-500">
            Related to what you&apos;ve been looking for.
          </p>

          <div className="mt-4">
            <AutoScrollProducts
              products={
                youMayLike
              }
            />
          </div>
        </section>
      ) : null}

      {filtersOpen ? (
        <div
          className="fixed inset-0 z-[80] md:hidden"
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            onClick={() =>
              setFiltersOpen(
                false
              )
            }
            className="absolute inset-0 bg-slate-950/35 backdrop-blur-[2px]"
            aria-label="Close filters"
          />

          <section className="absolute inset-x-3 bottom-3 rounded-[24px] border border-white/80 bg-white/95 p-5 shadow-2xl backdrop-blur-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black">
                Filters
              </h2>

              <button
                ref={
                  filterCloseRef
                }
                type="button"
                onClick={() =>
                  setFiltersOpen(
                    false
                  )
                }
                className="text-sm font-black text-slate-500"
              >
                Done
              </button>
            </div>

            <div className="mt-5 space-y-3">
              <label className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold">
                Maximum price

                <select
                  value={
                    maxPrice
                  }
                  onChange={(
                    event
                  ) => {
                    setMaxPrice(
                      event.target.value
                    );

                    replaceParams({
                      maxPrice:
                        event.target.value ===
                        "all"
                          ? null
                          : event.target.value,
                    });
                  }}
                  className="bg-transparent font-black outline-none"
                >
                  <option value="all">
                    Any
                  </option>

                  <option value="10000">
                    ₦10k
                  </option>

                  <option value="20000">
                    ₦20k
                  </option>

                  <option value="30000">
                    ₦30k
                  </option>
                </select>
              </label>

              <label className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold">
                Sort

                <select
                  value={
                    sortBy
                  }
                  onChange={(
                    event
                  ) => {
                    setSortBy(
                      event.target.value
                    );

                    replaceParams({
                      sort:
                        event.target.value ===
                        "newest"
                          ? null
                          : event.target.value,
                    });
                  }}
                  className="bg-transparent font-black outline-none"
                >
                  <option value="newest">
                    Newest
                  </option>

                  <option value="rating">
                    Top rated
                  </option>

                  <option value="price-low">
                    Price low
                  </option>

                  <option value="price-high">
                    Price high
                  </option>
                </select>
              </label>
            </div>

            <button
              type="button"
              onClick={
                resetFilters
              }
              className="mt-4 text-sm font-black text-slate-500 underline underline-offset-4"
            >
              Reset
            </button>
          </section>
        </div>
      ) : null}
    </main>
  );
}

export default function Page() {
  return (
    <Suspense
      fallback={
        <main className="main-container py-10">
          <div className="h-64 animate-pulse rounded-2xl bg-slate-100" />
        </main>
      }
    >
      <MarketplaceContent />
    </Suspense>
  );
}