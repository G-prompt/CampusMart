"use client";

import Link from "next/link";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  createPortal,
} from "react-dom";

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

const REMINDER_MAX_PER_DAY =
  2;

const REMINDER_COOLDOWN_MS =
  4 * 60 * 60 * 1000;

type VendorStats = {
  listingCount: number;
  orderCount: number;
  pendingOrderCount: number;
  itemCount: number;
  revenue: number;
};

type SellerRequirementKey =
  | "vendor_account"
  | "university_details"
  | "matric_number"
  | "student_verification"
  | "seller_profile"
  | "seller_access";

type SellerRequirement = {
  key:
    SellerRequirementKey;

  label:
    string;

  complete:
    boolean;

  required:
    boolean;
};

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
  userId:
    string;

  isVendor:
    boolean;

  canSell:
    boolean;

  nextRequiredAction:
    SellerNextAction;

  message:
    string;

  studentVerificationStatus:
    | "not_started"
    | "pending"
    | "verified"
    | "failed";

  studentVerified:
    boolean;

  university: {
    type:
      | "listed"
      | "other"
      | "missing";

    id:
      | string
      | null;

    name:
      | string
      | null;

    shortName:
      | string
      | null;

    matricNumber:
      | string
      | null;
  };

  sellerProfile: {
    exists:
      boolean;

    complete:
      boolean;

    businessName:
      | string
      | null;

    businessDescription:
      | string
      | null;

    pickupLocation:
      | string
      | null;

    accessStatus:
      | "active"
      | "pending_review"
      | "restricted"
      | "suspended"
      | null;

    vendorVerificationStatus:
      | string
      | null;
  };

  requirements:
    SellerRequirement[];
};

type ReminderState = {
  date:
    string;

  count:
    number;

  lastShownAt:
    number;
};

function getLocalDateKey() {
  const now =
    new Date();

  const year =
    now.getFullYear();

  const month =
    String(
      now.getMonth() + 1
    ).padStart(
      2,
      "0"
    );

  const day =
    String(
      now.getDate()
    ).padStart(
      2,
      "0"
    );

  return `${year}-${month}-${day}`;
}

function getReminderStorageKey(
  accountKey:
    string
) {
  return `campusmart-seller-setup-reminder:${accountKey}`;
}

function getSetupAction(
  action:
    SellerNextAction
) {
  switch (
    action
  ) {
    case "complete_university_details":
      return {
        title:
          "Add your university details",

        description:
          "CampusMart needs your university information before seller access can be completed.",

        buttonLabel:
          "Complete university details",

        href:
          "/profile",
      };

    case "add_matric_number":
      return {
        title:
          "Add your matric number",

        description:
          "Your student number is required before CampusMart can verify your university identity.",

        buttonLabel:
          "Add matric number",

        href:
          "/profile",
      };

    case "verify_student_identity":
      return {
        title:
          "Verify your student identity",

        description:
          "Complete student verification to unlock listing creation and seller tools.",

        buttonLabel:
          "Complete verification",

        href:
          "/profile",
      };

    case "complete_seller_profile":
      return {
        title:
          "Complete your seller profile",

        description:
          "Add your shop details and pickup information before you start selling.",

        buttonLabel:
          "Complete seller profile",

        href:
          "/profile",
      };

    case "seller_access_pending":
      return {
        title:
          "Seller access is being finalised",

        description:
          "Your required details are present, but seller access is not active yet.",

        buttonLabel:
          "Review account",

        href:
          "/profile",
      };

    case "seller_access_restricted":
      return {
        title:
          "Seller access restricted",

        description:
          "Your seller access is currently restricted. You can continue using CampusMart as a buyer.",

        buttonLabel:
          "Review account",

        href:
          "/profile",
      };

    case "seller_access_suspended":
      return {
        title:
          "Seller access suspended",

        description:
          "Your seller account is currently suspended.",

        buttonLabel:
          "Review account",

        href:
          "/profile",
      };

    case "ready_to_sell":
      return {
        title:
          "Ready to sell",

        description:
          "Your seller account is ready.",

        buttonLabel:
          "Add a product",

        href:
          "/vendor/add-listing",
      };

    default:
      return {
        title:
          "Complete seller setup",

        description:
          "Finish setting up your seller account before listing products.",

        buttonLabel:
          "Complete setup",

        href:
          "/profile",
      };
  }
}

export default function Page() {
  const {
    user,
    openAuth,
  } =
    useAuth();

  const [
    mounted,
    setMounted,
  ] =
    useState(
      false
    );

  const [
    stats,
    setStats,
  ] =
    useState<VendorStats>({
      listingCount:
        0,

      orderCount:
        0,

      pendingOrderCount:
        0,

      itemCount:
        0,

      revenue:
        0,
    });

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
    showReminder,
    setShowReminder,
  ] =
    useState(
      false
    );

  /*
   * =====================================================
   * CLIENT MOUNT
   * =====================================================
   */

  useEffect(
    () => {
      setMounted(
        true
      );
    },
    []
  );

  /*
   * =====================================================
   * LOAD SELLER DASHBOARD
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

    const loadDashboard =
      async () => {
        try {
          setLoading(
            true
          );

          setError(
            ""
          );

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
           * -------------------------------------------------
           * SELLER ELIGIBILITY
           * -------------------------------------------------
           */

          const eligibilityResponse =
            await fetch(
              `${API_URL}/api/vendor/eligibility`,
              {
                headers,

                signal:
                  controller.signal,

                cache:
                  "no-store",
              }
            );

          const eligibilityData =
            await eligibilityResponse
              .json();

          if (
            !eligibilityResponse.ok ||
            !eligibilityData.success
          ) {
            throw new Error(
              eligibilityData.message ||
                "Unable to check seller access."
            );
          }

          const currentEligibility =
            eligibilityData
              .eligibility as
              SellerEligibility;

          setEligibility(
            currentEligibility
          );

          /*
           * -------------------------------------------------
           * LISTINGS
           * -------------------------------------------------
           *
           * Seller accounts can still view their listing
           * history even while new selling is unavailable.
           */

          const listingsResponse =
            await fetch(
              `${API_URL}/api/products/mine`,
              {
                headers,

                signal:
                  controller.signal,

                cache:
                  "no-store",
              }
            );

          const listingsData =
            await listingsResponse
              .json();

          if (
            !listingsResponse.ok ||
            !listingsData.success
          ) {
            throw new Error(
              listingsData.message ||
                "Unable to load your listings."
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

          /*
           * -------------------------------------------------
           * EXISTING ORDERS
           * -------------------------------------------------
           *
           * Order history does NOT depend on canSell.
           *
           * active
           * pending_review
           * restricted
           * suspended
           *
           * may all view existing order history.
           */

          const ordersResponse =
            await fetch(
              `${API_URL}/api/orders/vendor`,
              {
                headers,

                signal:
                  controller.signal,

                cache:
                  "no-store",
              }
            );

          const ordersData =
            await ordersResponse
              .json();

          if (
            !ordersResponse.ok ||
            !ordersData.success
          ) {
            throw new Error(
              ordersData.message ||
                "Unable to load your orders."
            );
          }

          setStats({
            listingCount,

            orderCount:
              Number(
                ordersData.summary
                  ?.orderCount
              ) ||
              0,

            pendingOrderCount:
              Number(
                ordersData.summary
                  ?.pendingOrderCount
              ) ||
              0,

            itemCount:
              Number(
                ordersData.summary
                  ?.itemCount
              ) ||
              0,

            revenue:
              Number(
                ordersData.summary
                  ?.revenue
              ) ||
              0,
          });
        } catch (
          dashboardError
        ) {
          if (
            dashboardError instanceof
              DOMException &&
            dashboardError.name ===
              "AbortError"
          ) {
            return;
          }

          console.error(
            "Vendor dashboard error:",
            dashboardError
          );

          setError(
            dashboardError instanceof
              Error
              ? dashboardError.message
              : "Unable to refresh shop information."
          );
        } finally {
          setLoading(
            false
          );
        }
      };

    void loadDashboard();

    return () => {
      controller.abort();
    };
  }, [
    user,
  ]);

  /*
   * =====================================================
   * SELLER SETUP REMINDER
   * =====================================================
   */

  useEffect(() => {
    if (
      !user ||
      user.role !==
        "vendor" ||
      !eligibility ||
      eligibility.canSell
    ) {
      setShowReminder(
        false
      );

      return;
    }

    if (
      eligibility.nextRequiredAction ===
        "seller_access_restricted" ||
      eligibility.nextRequiredAction ===
        "seller_access_suspended"
    ) {
      setShowReminder(
        false
      );

      return;
    }

    const accountKey =
      user.email ||
      eligibility.userId;

    const storageKey =
      getReminderStorageKey(
        accountKey
      );

    const today =
      getLocalDateKey();

    const now =
      Date.now();

    let reminderState:
      ReminderState = {
        date:
          today,

        count:
          0,

        lastShownAt:
          0,
      };

    try {
      const stored =
        localStorage.getItem(
          storageKey
        );

      if (
        stored
      ) {
        const parsed =
          JSON.parse(
            stored
          ) as
            Partial<ReminderState>;

        if (
          parsed.date ===
          today
        ) {
          reminderState = {
            date:
              today,

            count:
              Number(
                parsed.count
              ) ||
              0,

            lastShownAt:
              Number(
                parsed.lastShownAt
              ) ||
              0,
          };
        }
      }
    } catch (
      reminderError
    ) {
      console.warn(
        "Unable to read seller reminder state:",
        reminderError
      );
    }

    if (
      reminderState.count >=
      REMINDER_MAX_PER_DAY
    ) {
      return;
    }

    if (
      reminderState
        .lastShownAt >
        0 &&
      now -
        reminderState
          .lastShownAt <
        REMINDER_COOLDOWN_MS
    ) {
      return;
    }

    const updatedState:
      ReminderState = {
        date:
          today,

        count:
          reminderState.count +
          1,

        lastShownAt:
          now,
      };

    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify(
          updatedState
        )
      );
    } catch (
      reminderError
    ) {
      console.warn(
        "Unable to save seller reminder state:",
        reminderError
      );
    }

    setShowReminder(
      true
    );
  }, [
    eligibility,
    user,
  ]);

  /*
   * Prevent the page underneath the reminder
   * from scrolling while the modal is open.
   */

  useEffect(() => {
    if (
      !showReminder
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
    showReminder,
  ]);

  const setupAction =
    useMemo(
      () =>
        getSetupAction(
          eligibility
            ?.nextRequiredAction ??
            "not_a_seller"
        ),
      [
        eligibility,
      ]
    );

  const progress =
    useMemo(
      () => {
        if (
          !eligibility
        ) {
          return {
            complete:
              0,

            total:
              0,

            percentage:
              0,
          };
        }

        const required =
          eligibility.requirements
            .filter(
              (
                requirement
              ) =>
                requirement.required
            );

        const complete =
          required.filter(
            (
              requirement
            ) =>
              requirement.complete
          ).length;

        const total =
          required.length;

        return {
          complete,

          total,

          percentage:
            total > 0
              ? Math.round(
                  (
                    complete /
                    total
                  ) *
                    100
                )
              : 0,
        };
      },
      [
        eligibility,
      ]
    );

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
        title="Vendor dashboard"
        description="Manage your campus shop, listings, and incoming orders."
      >
        <div className="site-card max-w-md p-8 text-center">
          <h2 className="text-2xl font-bold text-slate-950">
            Vendor access required
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-600">
            Sign in with a seller
            account to manage your
            shop.
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

  const canSell =
    eligibility
      ?.canSell ??
    false;

  const isRestricted =
    eligibility
      ?.nextRequiredAction ===
      "seller_access_restricted";

  const isSuspended =
    eligibility
      ?.nextRequiredAction ===
      "seller_access_suspended";

  /*
   * =====================================================
   * FULL-VIEWPORT REMINDER PORTAL
   * =====================================================
   */

  const reminderPortal =
    mounted &&
    showReminder &&
    eligibility
      ? createPortal(
          <div
            className="fixed inset-0 z-[9999] flex min-h-[100dvh] w-screen items-center justify-center bg-black/55 px-4 py-6 backdrop-blur-[3px]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="seller-setup-reminder-title"
            onMouseDown={(
              event
            ) => {
              if (
                event.target ===
                event.currentTarget
              ) {
                setShowReminder(
                  false
                );
              }
            }}
          >
            <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl sm:p-7">
              <div className="flex items-start justify-between gap-5">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                    Seller setup
                  </p>

                  <h2
                    id="seller-setup-reminder-title"
                    className="mt-2 text-2xl font-bold tracking-tight text-slate-950"
                  >
                    {
                      setupAction.title
                    }
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setShowReminder(
                      false
                    )
                  }
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 text-xl leading-none text-slate-500 transition hover:border-slate-400 hover:text-black"
                  aria-label="Close seller setup reminder"
                >
                  ×
                </button>
              </div>

              <p className="mt-3 text-sm leading-7 text-slate-600">
                {
                  setupAction.description
                }
              </p>

              <div className="mt-5 rounded-xl bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-4 text-xs font-semibold text-slate-600">
                  <span>
                    Seller setup
                  </span>

                  <span>
                    {
                      progress.complete
                    }
                    /
                    {
                      progress.total
                    }{" "}
                    complete
                  </span>
                </div>

                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-accent-400 transition-all"
                    style={{
                      width:
                        `${progress.percentage}%`,
                    }}
                  />
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Link
                  href={
                    setupAction.href
                  }
                  onClick={() =>
                    setShowReminder(
                      false
                    )
                  }
                  className="flex-1 rounded-[10px] bg-accent-400 px-5 py-3 text-center text-sm font-bold text-black transition hover:bg-accent-500"
                >
                  {
                    setupAction.buttonLabel
                  }
                </Link>

                <button
                  type="button"
                  onClick={() =>
                    setShowReminder(
                      false
                    )
                  }
                  className="flex-1 rounded-[10px] border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:border-slate-400 hover:text-black"
                >
                  Not now
                </button>
              </div>

              <p className="mt-4 text-center text-[11px] leading-5 text-slate-400">
                CampusMart limits setup
                reminders so they do not
                appear every time you open
                the dashboard.
              </p>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      {reminderPortal}

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

        {!loading &&
        eligibility &&
        !canSell ? (
          <section
            className={`mb-6 rounded-2xl border p-5 sm:p-6 ${
              isRestricted ||
              isSuspended
                ? "border-red-200 bg-red-50"
                : "border-amber-200 bg-amber-50"
            }`}
          >
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-2xl">
                <p
                  className={`text-xs font-bold uppercase tracking-[0.2em] ${
                    isRestricted ||
                    isSuspended
                      ? "text-red-700"
                      : "text-amber-700"
                  }`}
                >
                  Seller access
                </p>

                <h2
                  className={`mt-2 text-2xl font-bold tracking-tight ${
                    isRestricted ||
                    isSuspended
                      ? "text-red-950"
                      : "text-amber-950"
                  }`}
                >
                  {
                    setupAction.title
                  }
                </h2>

                <p
                  className={`mt-2 text-sm leading-7 ${
                    isRestricted ||
                    isSuspended
                      ? "text-red-800"
                      : "text-amber-800"
                  }`}
                >
                  {
                    eligibility.message
                  }
                </p>
              </div>

              <Link
                href={
                  setupAction.href
                }
                className={`shrink-0 rounded-[10px] px-5 py-3 text-sm font-bold transition ${
                  isRestricted ||
                  isSuspended
                    ? "border border-red-200 bg-white text-red-800 hover:border-red-400"
                    : "bg-accent-400 text-black hover:bg-accent-500"
                }`}
              >
                {
                  setupAction.buttonLabel
                }
              </Link>
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-between gap-4 text-xs font-semibold text-slate-600">
                <span>
                  Setup progress
                </span>

                <span>
                  {
                    progress.complete
                  }
                  /
                  {
                    progress.total
                  }{" "}
                  required steps
                </span>
              </div>

              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/80">
                <div
                  className="h-full rounded-full bg-accent-400 transition-all"
                  style={{
                    width:
                      `${progress.percentage}%`,
                  }}
                />
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {eligibility.requirements.map(
                (
                  requirement
                ) => {
                  const complete =
                    requirement.complete;

                  const optional =
                    !requirement.required;

                  return (
                    <div
                      key={
                        requirement.key
                      }
                      className="flex items-center gap-3 rounded-xl border border-white/80 bg-white/75 px-4 py-3"
                    >
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black ${
                          complete
                            ? "bg-emerald-100 text-emerald-700"
                            : optional
                              ? "bg-slate-100 text-slate-500"
                              : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {complete
                          ? "✓"
                          : optional
                            ? "–"
                            : "!"}
                      </span>

                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900">
                          {
                            requirement.label
                          }
                        </p>

                        <p className="mt-0.5 text-xs text-slate-500">
                          {complete
                            ? "Complete"
                            : optional
                              ? "Not required"
                              : "Action needed"}
                        </p>
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          </section>
        ) : null}

        {!loading &&
        eligibility &&
        canSell ? (
          <section className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">
                  Seller access
                </p>

                <h2 className="mt-2 text-xl font-bold text-emerald-950">
                  Your shop is ready
                  to sell
                </h2>

                <p className="mt-1 text-sm leading-6 text-emerald-800">
                  Your student identity
                  and seller setup meet
                  CampusMart&apos;s current
                  selling requirements.
                </p>
              </div>

              <span className="rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-xs font-bold text-emerald-700">
                Active
              </span>
            </div>
          </section>
        ) : null}

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
              {loading
                ? "Checking your seller account..."
                : canSell
                  ? "Your shop is ready. Manage your listings and keep track of incoming CampusMart orders here."
                  : "Your seller dashboard remains available while you complete your seller requirements. Existing orders and account history remain accessible."}
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

                {!loading &&
                !canSell ? (
                  <p className="mt-1 text-xs text-slate-500">
                    Existing orders
                    remain accessible
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
                {
                  error
                }
              </p>
            ) : null}
          </section>

          <section className="site-card p-6 sm:p-8">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-700">
              Shop actions
            </p>

            <div className="mt-5 space-y-3">
              {canSell ? (
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
              ) : (
                <Link
                  href={
                    setupAction.href
                  }
                  className="flex items-center justify-between rounded-[10px] bg-amber-100 px-4 py-4 text-sm font-bold text-amber-950 transition hover:bg-amber-200"
                >
                  <span>
                    {
                      setupAction.buttonLabel
                    }
                  </span>

                  <span aria-hidden="true">
                    →
                  </span>
                </Link>
              )}

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

            {!loading &&
            eligibility &&
            !canSell ? (
              <div className="mt-5 rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                  Why can&apos;t I add
                  products?
                </p>

                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {
                    eligibility.message
                  }
                </p>

                <p className="mt-2 text-xs leading-5 text-slate-500">
                  Existing orders and
                  account history are
                  still available from
                  this dashboard.
                </p>
              </div>
            ) : null}
          </section>
        </div>
      </PageShell>
    </>
  );
}