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

  return [
    now.getFullYear(),

    String(
      now.getMonth() +
        1
    ).padStart(
      2,
      "0"
    ),

    String(
      now.getDate()
    ).padStart(
      2,
      "0"
    ),
  ].join(
    "-"
  );
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
    useState(false);

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
    >(null);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    showReminder,
    setShowReminder,
  ] =
    useState(false);

  useEffect(
    () => {
      setMounted(
        true
      );
    },
    []
  );

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

          const [
            eligibilityResponse,
            listingsResponse,
            ordersResponse,
          ] =
            await Promise.all([
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
                `${API_URL}/api/orders/vendor`,
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
            eligibilityData,
            listingsData,
            ordersData,
          ] =
            await Promise.all([
              eligibilityResponse.json(),
              listingsResponse.json(),
              ordersResponse.json(),
            ]);

          if (
            !eligibilityResponse.ok ||
            !eligibilityData.success
          ) {
            throw new Error(
              eligibilityData.message ||
                "Unable to check seller access."
            );
          }

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

          setEligibility(
            eligibilityData
              .eligibility
          );

          setStats({
            listingCount:
              Array.isArray(
                listingsData.products
              )
                ? listingsData
                    .products
                    .length
                : 0,

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

    void loadDashboard();

    return () => {
      controller.abort();
    };
  }, [
    user,
  ]);

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

      if (stored) {
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
    } catch {
      // Ignore invalid reminder state.
    }

    if (
      reminderState.count >=
      REMINDER_MAX_PER_DAY
    ) {
      return;
    }

    if (
      reminderState.lastShownAt >
        0 &&
      now -
        reminderState.lastShownAt <
        REMINDER_COOLDOWN_MS
    ) {
      return;
    }

    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          date:
            today,

          count:
            reminderState.count +
            1,

          lastShownAt:
            now,
        })
      );
    } catch {
      // Reminder storage failure should not break dashboard.
    }

    setShowReminder(
      true
    );
  }, [
    eligibility,
    user,
  ]);

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
          eligibility.requirements.filter(
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

        return {
          complete,

          total:
            required.length,

          percentage:
            required.length
              ? Math.round(
                  (
                    complete /
                    required.length
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
            Seller access required
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

  const isRestricted =
    eligibility
      ?.nextRequiredAction ===
      "seller_access_restricted";

  const isSuspended =
    eligibility
      ?.nextRequiredAction ===
      "seller_access_suspended";

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
            <div className="w-full max-w-md rounded-2xl border border-white/70 bg-white/95 p-6 shadow-2xl backdrop-blur-xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                    Seller setup
                  </p>

                  <h2
                    id="seller-setup-reminder-title"
                    className="mt-2 text-2xl font-black text-slate-950"
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
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 text-lg text-slate-500"
                  aria-label="Close seller setup reminder"
                >
                  ×
                </button>
              </div>

              <p className="mt-3 text-sm leading-6 text-slate-600">
                {
                  setupAction.description
                }
              </p>

              <div className="mt-5 rounded-xl bg-slate-50 p-4">
                <div className="flex justify-between gap-4 text-xs font-semibold text-slate-600">
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
                    }
                  </span>
                </div>

                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-accent-400"
                    style={{
                      width:
                        `${progress.percentage}%`,
                    }}
                  />
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <Link
                  href={
                    setupAction.href
                  }
                  onClick={() =>
                    setShowReminder(
                      false
                    )
                  }
                  className="rounded-[10px] bg-accent-400 px-4 py-3 text-center text-sm font-bold text-black"
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
                  className="rounded-[10px] border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700"
                >
                  Not now
                </button>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      {
        reminderPortal
      }

      <PageShell
        title="Vendor dashboard"
        description="Manage your campus shop, listings, orders and pickup points."
      >
        <div className="mb-5 flex flex-wrap gap-2">
          {canSell ? (
            <Link
              href="/vendor/add-listing"
              className="rounded-[10px] bg-accent-400 px-4 py-2.5 text-sm font-black text-black transition hover:bg-accent-500"
            >
              + Add product
            </Link>
          ) : (
            <Link
              href={
                setupAction.href
              }
              className="rounded-[10px] bg-amber-100 px-4 py-2.5 text-sm font-black text-amber-950"
            >
              {
                setupAction.buttonLabel
              }
            </Link>
          )}

          <Link
            href="/marketplace"
            className="rounded-[10px] border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:border-slate-400"
          >
            View marketplace
          </Link>
        </div>

        {!loading &&
        eligibility &&
        !canSell ? (
          <section
            className={`mb-5 rounded-xl border p-4 sm:p-5 ${
              isRestricted ||
              isSuspended
                ? "border-red-200 bg-red-50"
                : "border-amber-200 bg-amber-50"
            }`}
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p
                  className={`text-[10px] font-black uppercase tracking-[0.18em] ${
                    isRestricted ||
                    isSuspended
                      ? "text-red-700"
                      : "text-amber-700"
                  }`}
                >
                  Seller access
                </p>

                <h2
                  className={`mt-1.5 text-lg font-black ${
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
                  className={`mt-1 text-sm leading-6 ${
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
                className="shrink-0 rounded-[10px] bg-white px-4 py-2.5 text-center text-xs font-black text-slate-800 shadow-sm"
              >
                {
                  setupAction.buttonLabel
                }
              </Link>
            </div>

            {!isRestricted &&
            !isSuspended ? (
              <div className="mt-4">
                <div className="flex justify-between text-[11px] font-semibold text-slate-600">
                  <span>
                    Setup
                  </span>

                  <span>
                    {
                      progress.complete
                    }
                    /
                    {
                      progress.total
                    }
                  </span>
                </div>

                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white">
                  <div
                    className="h-full rounded-full bg-accent-400"
                    style={{
                      width:
                        `${progress.percentage}%`,
                    }}
                  />
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        <section className="site-card overflow-hidden">
          <div className="p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                  Seller account
                </p>

                <h2 className="mt-1.5 text-2xl font-black tracking-tight text-slate-950">
                  Welcome,{" "}
                  {
                    user.name
                  }
                </h2>

                <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
                  {loading
                    ? "Checking your seller account..."
                    : canSell
                      ? "Your shop is active. Use the seller tools above to manage your CampusMart business."
                      : "Your dashboard and existing history remain available while you finish seller setup."}
                </p>
              </div>

              {!loading &&
              canSell ? (
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-black text-emerald-700">
                  Active seller
                </span>
              ) : null}
            </div>

            {error ? (
              <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-xs font-semibold text-red-600">
                {
                  error
                }
              </p>
            ) : null}
          </div>

          <div className="grid grid-cols-2 border-t border-slate-200 bg-slate-50/60 sm:grid-cols-4">
            <Link
              href="/vendor/listings"
              className="border-b border-r border-slate-200 p-4 transition hover:bg-white sm:border-b-0"
            >
              <p className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400">
                Listings
              </p>

              <p className="mt-1 text-xl font-black text-slate-950">
                {loading
                  ? "—"
                  : stats.listingCount}
              </p>

              <p className="mt-0.5 text-[10px] text-slate-500">
                Manage products
              </p>
            </Link>

            <Link
              href="/vendor/orders"
              className="border-b border-slate-200 p-4 transition hover:bg-white sm:border-b-0 sm:border-r"
            >
              <p className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400">
                Orders
              </p>

              <p className="mt-1 text-xl font-black text-slate-950">
                {loading
                  ? "—"
                  : stats.orderCount}
              </p>

              <p className="mt-0.5 text-[10px] text-slate-500">
                {
                  stats.itemCount
                }{" "}
                items ordered
              </p>
            </Link>

            <Link
              href="/vendor/orders"
              className="border-r border-slate-200 p-4 transition hover:bg-white"
            >
              <p className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400">
                Awaiting
              </p>

              <p className="mt-1 text-xl font-black text-slate-950">
                {loading
                  ? "—"
                  : stats.pendingOrderCount}
              </p>

              <p className="mt-0.5 text-[10px] text-slate-500">
                Need response
              </p>
            </Link>

            <Link
              href="/vendor/orders"
              className="p-4 transition hover:bg-white"
            >
              <p className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400">
                Revenue
              </p>

              <p className="mt-1 text-lg font-black text-slate-950">
                {loading
                  ? "—"
                  : formatNaira(
                      stats.revenue
                    )}
              </p>

              <p className="mt-0.5 text-[10px] text-slate-500">
                Paid + completed
              </p>
            </Link>
          </div>
        </section>
      </PageShell>
    </>
  );
}