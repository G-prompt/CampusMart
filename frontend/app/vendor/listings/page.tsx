
"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import PageShell from "@/components/common/PageShell";
import { useAuth } from "@/components/common/AuthContext";
import { useCampusMartConfirm } from "@/components/common/CampusMartConfirm";
import { formatNaira, type Product } from "@/lib/products";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

const PAGE_SIZE = 10;

type SellerNextAction =
  | "not_a_seller"
  | "complete_university_details"
  | "add_matric_number"
  | "verify_student_identity"
  | "complete_seller_profile"
  | "seller_access_pending"
  | "seller_access_restricted"
  | "seller_access_suspended"
  | "ready_to_sell";

type SellerEligibility = {
  canSell: boolean;
  nextRequiredAction: SellerNextAction;
  message: string;
};

type VendorProduct = Product & {
  isArchived: boolean;
  archivedAt: string | null;
  moderationHidden?: boolean;
};

type ListingFilter = "all" | "published" | "archived";

type ListingAction =
  | {
      id: number;
      type: "archive" | "restore";
    }
  | null;

function getSetupAction(action: SellerNextAction) {
  switch (action) {
    case "complete_university_details":
      return {
        label: "Complete university details",
        href: "/profile",
      };

    case "add_matric_number":
      return {
        label: "Add matric number",
        href: "/profile",
      };

    case "verify_student_identity":
      return {
        label: "Complete verification",
        href: "/profile",
      };

    case "complete_seller_profile":
      return {
        label: "Complete seller profile",
        href: "/profile",
      };

    default:
      return {
        label: "Review account",
        href: "/profile",
      };
  }
}

function formatArchivedDate(value: string | null) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function Page() {
  const campusMartConfirm = useCampusMartConfirm();
  const { user, openAuth } = useAuth();

  const topRef = useRef<HTMLDivElement>(null);

  const [listings, setListings] = useState<VendorProduct[]>([]);
  const [eligibility, setEligibility] =
    useState<SellerEligibility | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [filter, setFilter] = useState<ListingFilter>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [listingAction, setListingAction] =
    useState<ListingAction>(null);

  /*
   * LOAD SELLER LISTINGS AND ELIGIBILITY
   */

  useEffect(() => {
    if (user?.role !== "vendor") {
      setLoading(false);
      return;
    }

    const controller = new AbortController();

    const load = async () => {
      try {
        setLoading(true);
        setError("");

        const token = localStorage.getItem("campusmart-token");

        if (!token) {
          throw new Error("Your session could not be verified.");
        }

        const headers = {
          Authorization: `Bearer ${token}`,
        };

        const [listingsResponse, eligibilityResponse] =
          await Promise.all([
            fetch(`${API_URL}/api/products/mine`, {
              headers,
              signal: controller.signal,
              cache: "no-store",
            }),

            fetch(`${API_URL}/api/vendor/eligibility`, {
              headers,
              signal: controller.signal,
              cache: "no-store",
            }),
          ]);

        const [listingsData, eligibilityData] =
          await Promise.all([
            listingsResponse.json(),
            eligibilityResponse.json(),
          ]);

        if (!listingsResponse.ok || !listingsData.success) {
          throw new Error(
            listingsData.message || "Unable to load listings."
          );
        }

        if (!eligibilityResponse.ok || !eligibilityData.success) {
          throw new Error(
            eligibilityData.message ||
              "Unable to check seller access."
          );
        }

        if (controller.signal.aborted) return;

        setListings(
          Array.isArray(listingsData.products)
            ? listingsData.products
            : []
        );

        setEligibility(eligibilityData.eligibility);
      } catch (loadError) {
        if (controller.signal.aborted) return;

        if (
          loadError instanceof DOMException &&
          loadError.name === "AbortError"
        ) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load listings."
        );
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      controller.abort();
    };
  }, [user]);

  /*
   * LISTING COUNTS AND FILTERS
   *
   * Admin-hidden listings remain archived in the database,
   * so they continue to appear under All and Archived.
   * Their individual cards show the correct moderation status.
   */

  const publishedCount = useMemo(
    () => listings.filter((listing) => !listing.isArchived).length,
    [listings]
  );

  const archivedCount = useMemo(
    () => listings.filter((listing) => listing.isArchived).length,
    [listings]
  );

  const filteredListings = useMemo(() => {
    if (filter === "published") {
      return listings.filter((listing) => !listing.isArchived);
    }

    if (filter === "archived") {
      return listings.filter((listing) => listing.isArchived);
    }

    return listings;
  }, [filter, listings]);

  useEffect(() => {
    setCurrentPage(1);
  }, [filter]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredListings.length / PAGE_SIZE)
  );

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const visibleListings = filteredListings.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const changePage = (page: number) => {
    setCurrentPage(page);

    window.requestAnimationFrame(() => {
      topRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  };

  /*
   * SELLER ARCHIVE
   */

  const archiveListing = async (listing: VendorProduct) => {
    const accepted = await campusMartConfirm({
      title: "Confirm action",
      description: `Archive "${listing.title}"?`,
      danger: true,
    });

    if (!accepted) return;

    try {
      setListingAction({
        id: listing.id,
        type: "archive",
      });

      setError("");
      setSuccess("");

      const token = localStorage.getItem("campusmart-token");

      if (!token) {
        throw new Error("Your session could not be verified.");
      }

      const response = await fetch(
        `${API_URL}/api/products/${listing.id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Unable to archive listing."
        );
      }

      setListings((current) =>
        current.map((item) =>
          item.id === listing.id
            ? {
                ...item,
                ...data.product,
              }
            : item
        )
      );

      setSuccess("Listing archived.");
    } catch (archiveError) {
      setError(
        archiveError instanceof Error
          ? archiveError.message
          : "Unable to archive listing."
      );
    } finally {
      setListingAction(null);
    }
  };

  /*
   * SELLER RESTORE
   *
   * Admin-hidden listings must not be restored here.
   * The backend independently enforces the same rule.
   */

  const restoreListing = async (listing: VendorProduct) => {
    if (listing.moderationHidden) {
      setError(
        "This listing was hidden by CampusMart moderation. Contact support to request a review."
      );
      return;
    }

    if (!eligibility?.canSell) {
      setError(
        eligibility?.message ||
          "Active seller access is required."
      );
      return;
    }

    try {
      setListingAction({
        id: listing.id,
        type: "restore",
      });

      setError("");
      setSuccess("");

      const token = localStorage.getItem("campusmart-token");

      if (!token) {
        throw new Error("Your session could not be verified.");
      }

      const response = await fetch(
        `${API_URL}/api/products/${listing.id}/restore`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        if (data.eligibility) {
          setEligibility(data.eligibility);
        }

        if (data.code === "LISTING_HIDDEN_BY_ADMIN") {
          setListings((current) =>
            current.map((item) =>
              item.id === listing.id
                ? {
                    ...item,
                    isArchived: true,
                    moderationHidden: true,
                  }
                : item
            )
          );
        }

        throw new Error(
          data.message || "Unable to restore listing."
        );
      }

      setListings((current) =>
        current.map((item) =>
          item.id === listing.id
            ? {
                ...item,
                ...data.product,
                moderationHidden: false,
              }
            : item
        )
      );

      setSuccess("Listing restored.");
    } catch (restoreError) {
      setError(
        restoreError instanceof Error
          ? restoreError.message
          : "Unable to restore listing."
      );
    } finally {
      setListingAction(null);
    }
  };

  /*
   * NON-SELLER VIEW
   */

  if (user?.role !== "vendor") {
    return (
      <PageShell
        title="Vendor listings"
        description="Review and manage your marketplace listings."
      >
        <div className="site-card max-w-md p-8 text-center">
          <h2 className="text-2xl font-bold">
            Vendor access required
          </h2>

          <button
            type="button"
            onClick={() => openAuth("login", "vendor")}
            className="mt-6 rounded-[10px] bg-accent-400 px-5 py-3 text-sm font-bold text-black"
          >
            Sign in as seller
          </button>
        </div>
      </PageShell>
    );
  }

  const canSell = eligibility?.canSell ?? false;

  const setupAction = getSetupAction(
    eligibility?.nextRequiredAction ?? "not_a_seller"
  );

  return (
    <PageShell
      title="My listings"
      description="Manage your current and archived CampusMart products."
    >
      <div ref={topRef} className="scroll-mt-32" />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-slate-600">
            <strong className="text-slate-950">
              {publishedCount}
            </strong>{" "}
            published
            {" · "}
            <strong className="text-slate-950">
              {archivedCount}
            </strong>{" "}
            archived
          </p>
        </div>

        {canSell ? (
          <Link
            href="/vendor/add-listing"
            className="rounded-[10px] bg-accent-400 px-5 py-2.5 text-sm font-black text-black"
          >
            + Add listing
          </Link>
        ) : (
          <Link
            href={setupAction.href}
            className="rounded-[10px] bg-amber-100 px-5 py-2.5 text-sm font-black text-amber-900"
          >
            {setupAction.label}
          </Link>
        )}
      </div>

      {error ? (
        <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          {success}
        </div>
      ) : null}

      {!loading ? (
        <div className="mt-6 inline-flex flex-wrap gap-1 rounded-full border border-white/80 bg-white/75 p-1 shadow-sm backdrop-blur-xl">
          {(
            [
              ["all", `All ${listings.length}`],
              ["published", `Published ${publishedCount}`],
              ["archived", `Archived ${archivedCount}`],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={`rounded-full px-4 py-2 text-xs font-black transition ${
                filter === value
                  ? "bg-[#4A1724] text-white"
                  : "text-[#755861] hover:bg-[#F5EADF]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}

      {loading ? (
        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div
              key={index}
              className="h-72 animate-pulse rounded-2xl bg-slate-100"
            />
          ))}
        </div>
      ) : visibleListings.length > 0 ? (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            {visibleListings.map((listing) => {
              const isArchived = listing.isArchived;
              const adminHidden = Boolean(
                listing.moderationHidden
              );

              const busy = listingAction?.id === listing.id;

              const archivedDate = formatArchivedDate(
                listing.archivedAt
              );

              return (
                <article
                  key={listing.id}
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                >
                  <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
                    {listing.images.length > 0 ? (
                      <img
                        src={listing.images[0]}
                        alt={listing.title}
                        className={`h-full w-full object-cover ${
                          isArchived || adminHidden
                            ? "grayscale opacity-60"
                            : ""
                        }`}
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-slate-900 text-xs font-black text-white">
                        CampusMart
                      </div>
                    )}

                    <span
                      className={`absolute left-2.5 top-2.5 rounded-full border px-2.5 py-1 text-[10px] font-black ${
                        adminHidden
                          ? "border-red-200 bg-red-50 text-red-700"
                          : isArchived
                            ? "border-slate-300 bg-white text-slate-600"
                            : "border-emerald-200 bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      {adminHidden
                        ? "Hidden by CampusMart"
                        : isArchived
                          ? "Archived"
                          : "Published"}
                    </span>
                  </div>

                  <div className="p-3.5">
                    <p className="truncate text-[9px] font-black uppercase tracking-[0.15em] text-slate-400">
                      {listing.category}
                    </p>

                    <h2 className="mt-1.5 line-clamp-2 min-h-10 text-sm font-black leading-5 text-slate-950">
                      {listing.title}
                    </h2>

                    <p className="mt-2 text-base font-black">
                      {formatNaira(listing.price)}
                    </p>

                    {isArchived && archivedDate ? (
                      <p className="mt-1 text-[10px] text-slate-400">
                        {adminHidden
                          ? "Hidden"
                          : "Archived"}{" "}
                        {archivedDate}
                      </p>
                    ) : null}

                    <div className="mt-3 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
                      {!isArchived && !adminHidden ? (
                        <Link
                          href={`/marketplace/products/${listing.id}`}
                          className="inline-flex min-h-9 items-center justify-center rounded-[9px] border border-slate-200 px-2 text-xs font-black"
                        >
                          View
                        </Link>
                      ) : (
                        <span />
                      )}

                      {canSell ? (
                        <Link
                          href={`/vendor/edit-listing?id=${listing.id}`}
                          className="inline-flex min-h-9 items-center justify-center rounded-[9px] border border-slate-200 px-2 text-xs font-black"
                        >
                          Edit
                        </Link>
                      ) : (
                        <button
                          type="button"
                          disabled
                          className="min-h-9 rounded-[9px] bg-slate-100 text-xs font-black text-slate-400"
                        >
                          Edit
                        </button>
                      )}
                    </div>

                    {adminHidden ? (
                      <div className="mt-2 rounded-[9px] border border-red-200 bg-red-50 p-3">
                        <p className="text-xs font-black text-red-800">
                          Listing hidden by CampusMart
                        </p>

                        <p className="mt-1 text-[11px] leading-5 text-red-700">
                          This listing is unavailable to buyers.
                          Only CampusMart moderation can restore it.
                        </p>

                        <Link
                          href="/support"
                          className="mt-3 inline-flex w-full items-center justify-center rounded-[9px] border border-red-200 bg-white px-3 py-2 text-xs font-black text-red-800 transition hover:bg-red-100"
                        >
                          Contact support
                        </Link>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={
                          busy ||
                          (isArchived && !canSell)
                        }
                        onClick={() =>
                          isArchived
                            ? void restoreListing(listing)
                            : void archiveListing(listing)
                        }
                        className={`mt-2 w-full rounded-[9px] px-3 py-2 text-xs font-black transition disabled:opacity-40 ${
                          isArchived
                            ? "bg-accent-400 text-black"
                            : "bg-red-50 text-red-600 hover:bg-red-100"
                        }`}
                      >
                        {busy
                          ? "Working..."
                          : isArchived
                            ? "Restore listing"
                            : "Archive"}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>

          {filteredListings.length > PAGE_SIZE ? (
            <div className="mt-8 grid grid-cols-3 items-center border-t border-slate-200 pt-5">
              <div>
                {currentPage > 1 ? (
                  <button
                    type="button"
                    onClick={() => changePage(currentPage - 1)}
                    className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-black"
                  >
                    ← Previous
                  </button>
                ) : null}
              </div>

              <p className="text-center text-xs font-bold text-slate-400">
                {currentPage}
                {" / "}
                {totalPages}
              </p>

              <div className="text-right">
                {currentPage < totalPages ? (
                  <button
                    type="button"
                    onClick={() => changePage(currentPage + 1)}
                    className="rounded-full bg-[#4A1724] px-4 py-2 text-sm font-black text-white"
                  >
                    Next →
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <div className="site-card mt-6 p-8 text-center">
          <h2 className="text-xl font-bold">
            No listings here
          </h2>

          <p className="mt-2 text-sm text-slate-600">
            {listings.length === 0
              ? "Your shop does not have any listings yet."
              : "No listings match this filter."}
          </p>
        </div>
      )}
    </PageShell>
  );
}
