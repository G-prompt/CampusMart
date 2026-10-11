"use client";

import Link from "next/link";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import PageShell from "@/components/common/PageShell";

import {
  useAuth,
} from "@/components/common/AuthContext";

import {
  formatNaira,
  type Product,
} from "@/lib/products";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:5000";

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

  nextRequiredAction:
    SellerNextAction;

  message: string;
};

type VendorProduct =
  Product & {
    isArchived: boolean;

    archivedAt:
      | string
      | null;
  };

type ListingFilter =
  | "all"
  | "published"
  | "archived";

type ListingAction =
  | {
      id: number;

      type:
        | "archive"
        | "restore";
    }
  | null;

function getSetupAction(
  action:
    SellerNextAction
) {
  switch (action) {
    case "complete_university_details":
      return {
        label:
          "Complete university details",

        href:
          "/profile",
      };

    case "add_matric_number":
      return {
        label:
          "Add matric number",

        href:
          "/profile",
      };

    case "verify_student_identity":
      return {
        label:
          "Complete verification",

        href:
          "/profile",
      };

    case "complete_seller_profile":
      return {
        label:
          "Complete seller profile",

        href:
          "/profile",
      };

    case "seller_access_pending":
      return {
        label:
          "Review seller setup",

        href:
          "/profile",
      };

    case "seller_access_restricted":
      return {
        label:
          "Review account",

        href:
          "/profile",
      };

    case "seller_access_suspended":
      return {
        label:
          "Review account",

        href:
          "/profile",
      };

    default:
      return {
        label:
          "Complete seller setup",

        href:
          "/profile",
      };
  }
}

function formatArchivedDate(
  value:
    | string
    | null
) {
  if (!value) {
    return "";
  }

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
      day:
        "numeric",

      month:
        "short",

      year:
        "numeric",
    }
  );
}

export default function Page() {
  const {
    user,
    openAuth,
  } =
    useAuth();

  const [
    listings,
    setListings,
  ] =
    useState<
      VendorProduct[]
    >(
      []
    );

  const [
    eligibility,
    setEligibility,
  ] =
    useState<
      SellerEligibility | null
    >(
      null
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
    success,
    setSuccess,
  ] =
    useState(
      ""
    );

  const [
    filter,
    setFilter,
  ] =
    useState<ListingFilter>(
      "all"
    );

  const [
    listingAction,
    setListingAction,
  ] =
    useState<ListingAction>(
      null
    );

  /*
   * =====================================================
   * LOAD LISTINGS + SELLER ELIGIBILITY
   * =====================================================
   */

  useEffect(() => {
    if (
      user?.role !==
      "vendor"
    ) {
      setLoading(
        false
      );

      setEligibility(
        null
      );

      return;
    }

    const controller =
      new AbortController();

    const loadPage =
      async () => {
        try {
          setLoading(
            true
          );

          setError(
            ""
          );

          setSuccess(
            ""
          );

          const token =
            localStorage.getItem(
              "campusmart-token"
            );

          if (!token) {
            throw new Error(
              "Your session could not be verified. Please sign in again."
            );
          }

          const headers = {
            Authorization:
              `Bearer ${token}`,
          };

          const [
            listingsResponse,
            eligibilityResponse,
          ] =
            await Promise.all([
              fetch(
                `${API_URL}/api/products/mine`,
                {
                  headers,

                  signal:
                    controller.signal,

                  cache:
                    "no-store",
                }
              ),

              fetch(
                `${API_URL}/api/vendor/eligibility`,
                {
                  headers,

                  signal:
                    controller.signal,

                  cache:
                    "no-store",
                }
              ),
            ]);

          const [
            listingsData,
            eligibilityData,
          ] =
            await Promise.all([
              listingsResponse.json(),

              eligibilityResponse.json(),
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
            !eligibilityResponse.ok ||
            !eligibilityData.success
          ) {
            throw new Error(
              eligibilityData.message ||
                "Unable to check seller access."
            );
          }

          setListings(
            Array.isArray(
              listingsData.products
            )
              ? listingsData.products
              : []
          );

          setEligibility(
            eligibilityData
              .eligibility
          );
        } catch (
          pageError
        ) {
          if (
            pageError instanceof
              DOMException &&
            pageError.name ===
              "AbortError"
          ) {
            return;
          }

          console.error(
            "Vendor listings error:",
            pageError
          );

          setError(
            pageError instanceof
              Error
              ? pageError.message
              : "Unable to load your listings."
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

    void loadPage();

    return () => {
      controller.abort();
    };
  }, [
    user,
  ]);

  /*
   * =====================================================
   * COUNTS + FILTERING
   * =====================================================
   */

  const publishedCount =
    useMemo(
      () =>
        listings.filter(
          (
            listing
          ) =>
            !listing.isArchived
        ).length,
      [
        listings,
      ]
    );

  const archivedCount =
    useMemo(
      () =>
        listings.filter(
          (
            listing
          ) =>
            listing.isArchived
        ).length,
      [
        listings,
      ]
    );

  const filteredListings =
    useMemo(
      () => {
        if (
          filter ===
          "published"
        ) {
          return listings.filter(
            (
              listing
            ) =>
              !listing.isArchived
          );
        }

        if (
          filter ===
          "archived"
        ) {
          return listings.filter(
            (
              listing
            ) =>
              listing.isArchived
          );
        }

        return listings;
      },
      [
        filter,
        listings,
      ]
    );

  /*
   * =====================================================
   * ARCHIVE LISTING
   * =====================================================
   *
   * Archiving is intentionally allowed for any vendor
   * account that owns the listing.
   *
   * Full current selling eligibility is NOT required to
   * take an item off sale.
   */

  const archiveListing =
    async (
      listing:
        VendorProduct
    ) => {
      const confirmed =
        window.confirm(
          `Archive "${listing.title}"?\n\nIt will disappear from the public marketplace but remain in your listing history.`
        );

      if (
        !confirmed
      ) {
        return;
      }

      try {
        setListingAction({
          id:
            listing.id,

          type:
            "archive",
        });

        setError(
          ""
        );

        setSuccess(
          ""
        );

        const token =
          localStorage.getItem(
            "campusmart-token"
          );

        if (!token) {
          throw new Error(
            "Your session could not be verified. Please sign in again."
          );
        }

        const response =
          await fetch(
            `${API_URL}/api/products/${listing.id}`,
            {
              method:
                "DELETE",

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
              "Unable to archive listing."
          );
        }

        setListings(
          (
            current
          ) =>
            current.map(
              (
                currentListing
              ) =>
                currentListing.id ===
                listing.id
                  ? {
                      ...currentListing,

                      ...data.product,
                    }
                  : currentListing
            )
        );

        setSuccess(
          "Listing archived. It is no longer visible in the marketplace."
        );
      } catch (
        archiveError
      ) {
        console.error(
          "Archive listing error:",
          archiveError
        );

        setError(
          archiveError instanceof
            Error
            ? archiveError.message
            : "Unable to archive listing."
        );
      } finally {
        setListingAction(
          null
        );
      }
    };

  /*
   * =====================================================
   * RESTORE LISTING
   * =====================================================
   *
   * Restoring makes the listing publicly sellable again.
   * Full seller eligibility is therefore required.
   */

  const restoreListing =
    async (
      listing:
        VendorProduct
    ) => {
      if (
        !eligibility?.canSell
      ) {
        setError(
          eligibility?.message ||
            "Active seller access is required before you can restore listings."
        );

        return;
      }

      try {
        setListingAction({
          id:
            listing.id,

          type:
            "restore",
        });

        setError(
          ""
        );

        setSuccess(
          ""
        );

        const token =
          localStorage.getItem(
            "campusmart-token"
          );

        if (!token) {
          throw new Error(
            "Your session could not be verified. Please sign in again."
          );
        }

        const response =
          await fetch(
            `${API_URL}/api/products/${listing.id}/restore`,
            {
              method:
                "PATCH",

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
          if (
            data.eligibility
          ) {
            setEligibility(
              data.eligibility
            );
          }

          throw new Error(
            data.message ||
              "Unable to restore listing."
          );
        }

        setListings(
          (
            current
          ) =>
            current.map(
              (
                currentListing
              ) =>
                currentListing.id ===
                listing.id
                  ? {
                      ...currentListing,

                      ...data.product,
                    }
                  : currentListing
            )
        );

        setSuccess(
          "Listing restored and published to the marketplace."
        );
      } catch (
        restoreError
      ) {
        console.error(
          "Restore listing error:",
          restoreError
        );

        setError(
          restoreError instanceof
            Error
            ? restoreError.message
            : "Unable to restore listing."
        );
      } finally {
        setListingAction(
          null
        );
      }
    };

  /*
   * =====================================================
   * NON-SELLER
   * =====================================================
   */

  if (
    user?.role !==
    "vendor"
  ) {
    return (
      <PageShell
        title="Vendor listings"
        description="Review and manage your marketplace listings."
      >
        <div className="site-card max-w-md p-8 text-center">
          <h2 className="text-2xl font-bold text-slate-950">
            Vendor access
            required
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-600">
            Sign in with a seller
            account to manage your
            CampusMart listings.
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
            Sign in as seller
          </button>
        </div>
      </PageShell>
    );
  }

  const canSell =
    eligibility
      ?.canSell ??
    false;

  const setupAction =
    getSetupAction(
      eligibility
        ?.nextRequiredAction ??
        "not_a_seller"
    );

  const isRestricted =
    eligibility
      ?.nextRequiredAction ===
      "seller_access_restricted";

  const isSuspended =
    eligibility
      ?.nextRequiredAction ===
      "seller_access_suspended";

  const dangerState =
    isRestricted ||
    isSuspended;

  return (
    <PageShell
      title="My listings"
      description="Manage published products and keep archived listings for your records."
    >
      {!loading &&
      eligibility &&
      !canSell ? (
        <section
          className={`mb-6 rounded-2xl border p-5 sm:p-6 ${
            dangerState
              ? "border-red-200 bg-red-50"
              : "border-amber-200 bg-amber-50"
          }`}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p
                className={`text-xs font-bold uppercase tracking-[0.18em] ${
                  dangerState
                    ? "text-red-700"
                    : "text-amber-700"
                }`}
              >
                Seller access
              </p>

              <h2
                className={`mt-2 text-xl font-bold ${
                  dangerState
                    ? "text-red-950"
                    : "text-amber-950"
                }`}
              >
                New selling activity is
                currently unavailable
              </h2>

              <p
                className={`mt-2 max-w-xl text-sm leading-6 ${
                  dangerState
                    ? "text-red-800"
                    : "text-amber-800"
                }`}
              >
                {
                  eligibility.message
                }
              </p>

              <p
                className={`mt-2 text-xs leading-5 ${
                  dangerState
                    ? "text-red-700"
                    : "text-amber-700"
                }`}
              >
                You can still view your
                listing history and
                archive published items.
                Creating, editing and
                restoring listings
                requires active seller
                access.
              </p>
            </div>

            <Link
              href={
                setupAction.href
              }
              className={`shrink-0 rounded-[10px] px-5 py-3 text-center text-sm font-bold transition ${
                dangerState
                  ? "border border-red-200 bg-white text-red-800 hover:border-red-400"
                  : "bg-accent-400 text-black hover:bg-accent-500"
              }`}
            >
              {
                setupAction.label
              }
            </Link>
          </div>
        </section>
      ) : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-slate-600">
            <span className="font-bold text-slate-950">
              {
                publishedCount
              }
            </span>{" "}
            published
            {" · "}
            <span className="font-bold text-slate-950">
              {
                archivedCount
              }
            </span>{" "}
            archived
          </p>

          <p className="mt-1 text-xs text-slate-500">
            Archived listings are kept
            in your history but are not
            visible to buyers.
          </p>
        </div>

        {canSell ? (
          <Link
            href="/vendor/add-listing"
            className="rounded-[10px] bg-accent-400 px-5 py-3 text-center text-sm font-bold text-black transition hover:bg-accent-500"
          >
            Add listing
          </Link>
        ) : (
          <Link
            href={
              setupAction.href
            }
            className="rounded-[10px] border border-amber-200 bg-amber-50 px-5 py-3 text-center text-sm font-bold text-amber-900 transition hover:bg-amber-100"
          >
            {
              setupAction.label
            }
          </Link>
        )}
      </div>

      {error ? (
        <div
          className="mt-6 rounded-[10px] border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"
          role="alert"
        >
          {
            error
          }
        </div>
      ) : null}

      {success ? (
        <div
          className="mt-6 rounded-[10px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800"
          role="status"
        >
          {
            success
          }
        </div>
      ) : null}

      {!loading ? (
        <div className="mt-6 flex flex-wrap gap-2 border-b border-slate-200 pb-4">
          <button
            type="button"
            onClick={() =>
              setFilter(
                "all"
              )
            }
            className={`rounded-full px-4 py-2 text-sm font-bold transition ${
              filter ===
              "all"
                ? "bg-slate-950 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            All (
            {
              listings.length
            }
            )
          </button>

          <button
            type="button"
            onClick={() =>
              setFilter(
                "published"
              )
            }
            className={`rounded-full px-4 py-2 text-sm font-bold transition ${
              filter ===
              "published"
                ? "bg-slate-950 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Published (
            {
              publishedCount
            }
            )
          </button>

          <button
            type="button"
            onClick={() =>
              setFilter(
                "archived"
              )
            }
            className={`rounded-full px-4 py-2 text-sm font-bold transition ${
              filter ===
              "archived"
                ? "bg-slate-950 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Archived (
            {
              archivedCount
            }
            )
          </button>
        </div>
      ) : null}

      {loading ? (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {[
            1,
            2,
          ].map(
            (
              item
            ) => (
              <div
                key={
                  item
                }
                className="site-card h-[420px] animate-pulse bg-slate-100"
              />
            )
          )}
        </div>
      ) : filteredListings.length ? (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {filteredListings.map(
            (
              listing
            ) => {
              const isArchived =
                listing.isArchived;

              const archiving =
                listingAction?.id ===
                  listing.id &&
                listingAction.type ===
                  "archive";

              const restoring =
                listingAction?.id ===
                  listing.id &&
                listingAction.type ===
                  "restore";

              const actionBusy =
                archiving ||
                restoring;

              const archivedDate =
                formatArchivedDate(
                  listing.archivedAt
                );

              return (
                <article
                  key={
                    listing.id
                  }
                  className={`site-card overflow-hidden ${
                    isArchived
                      ? "border border-slate-200 bg-slate-50"
                      : ""
                  }`}
                >
                  <div className="relative">
                    {listing.images
                      .length ? (
                      <img
                        src={
                          listing
                            .images[0]
                        }
                        alt={
                          listing.title
                        }
                        className={`h-44 w-full object-cover ${
                          isArchived
                            ? "opacity-60 grayscale"
                            : ""
                        }`}
                      />
                    ) : (
                      <div
                        className={`flex h-44 items-center justify-center bg-slate-950 px-6 text-center text-sm font-bold text-white ${
                          isArchived
                            ? "opacity-60"
                            : ""
                        }`}
                      >
                        CampusMart
                        listing image
                      </div>
                    )}

                    <span
                      className={`absolute left-4 top-4 rounded-full border px-3 py-1 text-xs font-bold shadow-sm ${
                        isArchived
                          ? "border-slate-300 bg-white text-slate-700"
                          : "border-emerald-200 bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      {isArchived
                        ? "Archived"
                        : "Published"}
                    </span>
                  </div>

                  <div className="p-5">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                      {
                        listing.category
                      }
                    </p>

                    <h2 className="mt-2 text-xl font-bold text-slate-950">
                      {
                        listing.title
                      }
                    </h2>

                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">
                      {
                        listing.description
                      }
                    </p>

                    <p className="mt-4 text-lg font-bold text-slate-950">
                      {formatNaira(
                        listing.price
                      )}
                    </p>

                    {isArchived ? (
                      <div className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3">
                        <p className="text-sm font-bold text-slate-800">
                          Not visible in marketplace
                        </p>

                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          Buyers cannot
                          open or order
                          this listing.
                          {archivedDate
                            ? ` Archived ${archivedDate}.`
                            : ""}
                        </p>
                      </div>
                    ) : null}

                    <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
                      {!isArchived ? (
                        <Link
                          href={`/marketplace/products/${listing.id}`}
                          className="rounded-[9px] border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:border-black hover:text-black"
                        >
                          View
                        </Link>
                      ) : null}

                      {canSell ? (
                        <Link
                          href={`/vendor/edit-listing?id=${listing.id}`}
                          className="rounded-[9px] border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition hover:border-black hover:text-black"
                        >
                          Edit
                        </Link>
                      ) : (
                        <button
                          type="button"
                          disabled
                          title="Active seller access is required to edit listings."
                          className="cursor-not-allowed rounded-[9px] border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-bold text-slate-400"
                        >
                          Edit
                        </button>
                      )}

                      {isArchived ? (
                        <button
                          type="button"
                          disabled={
                            !canSell ||
                            actionBusy
                          }
                          onClick={() =>
                            restoreListing(
                              listing
                            )
                          }
                          title={
                            canSell
                              ? "Restore this listing to the marketplace"
                              : "Active seller access is required to restore listings."
                          }
                          className={`rounded-[9px] px-4 py-2 text-sm font-bold transition ${
                            canSell
                              ? "bg-accent-400 text-black hover:bg-accent-500"
                              : "cursor-not-allowed bg-slate-100 text-slate-400"
                          } disabled:opacity-50`}
                        >
                          {restoring
                            ? "Restoring..."
                            : "Restore"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={
                            actionBusy
                          }
                          onClick={() =>
                            archiveListing(
                              listing
                            )
                          }
                          title="Remove this listing from the marketplace without deleting its history."
                          className="rounded-[9px] px-4 py-2 text-sm font-bold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {archiving
                            ? "Archiving..."
                            : "Archive"}
                        </button>
                      )}
                    </div>

                    {!canSell ? (
                      <p className="mt-3 text-xs leading-5 text-slate-500">
                        {isArchived
                          ? "This listing remains in your history. Restore and edit will unlock when seller access is active."
                          : "You can still archive this listing to take it off sale. Editing requires active seller access."}
                      </p>
                    ) : null}
                  </div>
                </article>
              );
            }
          )}
        </div>
      ) : listings.length ? (
        <div className="site-card mt-6 p-8 text-center">
          <h2 className="text-xl font-bold text-slate-950">
            No{" "}
            {filter ===
            "published"
              ? "published"
              : filter ===
                  "archived"
                ? "archived"
                : ""}{" "}
            listings
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-600">
            {filter ===
            "published"
              ? "You do not currently have any products visible in the marketplace."
              : filter ===
                  "archived"
                ? "You have not archived any listings."
                : "No listings match this view."}
          </p>
        </div>
      ) : (
        <div className="site-card mt-6 p-8 text-center">
          <h2 className="text-xl font-bold text-slate-950">
            Your shop is empty
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-600">
            {canSell
              ? "Publish your first product and it will appear here and in the marketplace."
              : "You do not have any listings yet. Complete your seller requirements before publishing your first product."}
          </p>

          {canSell ? (
            <Link
              href="/vendor/add-listing"
              className="mt-6 inline-flex rounded-[10px] bg-accent-400 px-5 py-3 text-sm font-bold text-black"
            >
              Add your first listing
            </Link>
          ) : (
            <Link
              href={
                setupAction.href
              }
              className="mt-6 inline-flex rounded-[10px] bg-accent-400 px-5 py-3 text-sm font-bold text-black"
            >
              {
                setupAction.label
              }
            </Link>
          )}
        </div>
      )}
    </PageShell>
  );
}