
"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/common/AuthContext";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

type ViewMode = "buyer" | "seller";

type OrderStatus =
  | "pending"
  | "confirmed"
  | "completed"
  | "cancelled";

type OrderTiming = {
  orderId: string;
  vendorId: string;
  status: OrderStatus;
  confirmationDueAt: string;
  confirmedAt: string | null;
  deliveryDueAt: string | null;
};

type TimingResponse = {
  success: boolean;
  message?: string;
  timings?: OrderTiming[];
};

type BuyerOrdersResponse = {
  success: boolean;
  orders?: Array<{
    items?: Array<{
      vendorId: string;
      vendor?: {
        name?: string;
        vendorProfile?: {
          businessName?: string | null;
        } | null;
      };
    }>;
  }>;
};

type TimingDisplay = {
  title: string;
  remaining: string;
  deadline: string | null;
  overdue: boolean;
};

function formatDuration(milliseconds: number): string {
  const minutes = Math.max(
    1,
    Math.ceil(Math.abs(milliseconds) / 60000)
  );

  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const remainingMinutes = minutes % 60;

  if (days > 0) {
    return `${days}d ${hours}h`;
  }

  if (hours > 0) {
    return `${hours}h ${remainingMinutes}m`;
  }

  return `${minutes}m`;
}

function formatDeadline(value: string): string | null {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function getTimingDisplay(
  timing: OrderTiming,
  mode: ViewMode,
  now: number
): TimingDisplay {
  if (timing.status === "pending") {
    const deadline = Date.parse(timing.confirmationDueAt);

    if (!Number.isFinite(deadline)) {
      return {
        title: "Awaiting seller confirmation",
        remaining: "Confirmation deadline unavailable",
        deadline: null,
        overdue: false,
      };
    }

    const difference = deadline - now;
    const overdue = difference <= 0;

    return {
      title:
        mode === "seller"
          ? "Confirm this order"
          : "Awaiting seller confirmation",
      remaining: overdue
        ? `Confirmation overdue by ${formatDuration(difference)}`
        : `${formatDuration(difference)} left to confirm`,
      deadline: formatDeadline(timing.confirmationDueAt),
      overdue,
    };
  }

  if (!timing.deliveryDueAt) {
    return {
      title: "Seller confirmed",
      remaining:
        "Delivery countdown is unavailable for this order",
      deadline: null,
      overdue: false,
    };
  }

  const deadline = Date.parse(timing.deliveryDueAt);

  if (!Number.isFinite(deadline)) {
    return {
      title: "Seller confirmed",
      remaining: "Delivery deadline unavailable",
      deadline: null,
      overdue: false,
    };
  }

  const difference = deadline - now;
  const overdue = difference <= 0;

  return {
    title:
      mode === "seller"
        ? "Delivery / handoff countdown"
        : "Expected delivery / handoff",
    remaining: overdue
      ? `Delivery overdue by ${formatDuration(difference)}`
      : `${formatDuration(difference)} remaining`,
    deadline: formatDeadline(timing.deliveryDueAt),
    overdue,
  };
}

export default function OrderTimingPanel({
  mode,
}: {
  mode: ViewMode;
}) {
  const { user } = useAuth();
  const userId = user?.id;

  const [timings, setTimings] = useState<OrderTiming[]>([]);
  const [sellerNames, setSellerNames] = useState<
    Record<string, string>
  >({});
  const [now, setNow] = useState(0);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    setNow(Date.now());

    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let requestRunning = false;

    setTimings([]);
    setSellerNames({});
    setLoadError(false);

    if (!userId) {
      return;
    }

    const refreshTimings = async () => {
      if (requestRunning) return;

      const token = localStorage.getItem("campusmart-token");

      if (!token) {
        if (!cancelled) {
          setTimings([]);
          setSellerNames({});
        }
        return;
      }

      requestRunning = true;

      try {
        const response = await fetch(
          `${API_URL}/api/orders/timings`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
            },
            cache: "no-store",
          }
        );

        const data =
          (await response.json()) as TimingResponse;

        if (
          !response.ok ||
          !data.success ||
          !Array.isArray(data.timings)
        ) {
          throw new Error(
            data.message || "Unable to load order deadlines."
          );
        }

        if (cancelled) return;

        const visibleTimings =
          mode === "seller"
            ? data.timings.filter(
                (timing) => timing.vendorId === userId
              )
            : data.timings;

        setTimings(visibleTimings);
        setLoadError(false);

        if (mode === "buyer") {
          try {
            const ordersResponse = await fetch(
              `${API_URL}/api/orders/mine`,
              {
                headers: {
                  Authorization: `Bearer ${token}`,
                },
                cache: "no-store",
              }
            );

            if (ordersResponse.ok) {
              const ordersData =
                (await ordersResponse.json()) as BuyerOrdersResponse;

              const nextNames: Record<string, string> = {};

              for (const order of ordersData.orders ?? []) {
                for (const item of order.items ?? []) {
                  const name =
                    item.vendor?.vendorProfile?.businessName ||
                    item.vendor?.name;

                  if (item.vendorId && name) {
                    nextNames[item.vendorId] = name;
                  }
                }
              }

              if (!cancelled) {
                setSellerNames(nextNames);
              }
            }
          } catch (error) {
            console.error(
              "Unable to load seller names for timing summary:",
              error
            );
          }
        }
      } catch (error) {
        console.error("Order timing request failed:", error);

        if (!cancelled) {
          setLoadError(true);
        }
      } finally {
        requestRunning = false;
      }
    };

    void refreshTimings();

    const refreshInterval = window.setInterval(() => {
      if (!document.hidden) {
        void refreshTimings();
      }
    }, 30000);

    const handleFocus = () => {
      if (!document.hidden) {
        void refreshTimings();
      }
    };

    const handleOrderChange = () => {
      void refreshTimings();
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener(
      "visibilitychange",
      handleFocus
    );
    window.addEventListener(
      "campusmart-toast",
      handleOrderChange
    );

    return () => {
      cancelled = true;

      window.clearInterval(refreshInterval);

      window.removeEventListener("focus", handleFocus);
      document.removeEventListener(
        "visibilitychange",
        handleFocus
      );
      window.removeEventListener(
        "campusmart-toast",
        handleOrderChange
      );
    };
  }, [userId, mode]);

  if (!userId) {
    return null;
  }

  if (loadError && timings.length === 0) {
    return (
      <section className="main-container pt-5">
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Order countdowns could not be loaded. Please refresh
          this page or try again shortly.
        </div>
      </section>
    );
  }

  const activeTimings = timings.filter(
    (timing) =>
      timing.status === "pending" ||
      timing.status === "confirmed"
  );

  if (activeTimings.length === 0) {
    return null;
  }

  const visibleTimings = activeTimings.slice(0, 8);

  return (
    <section
      className="main-container pt-5"
      aria-label={
        mode === "seller"
          ? "Seller order deadlines"
          : "Buyer order deadlines"
      }
    >
      <div className="site-card p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-black text-slate-950">
              {mode === "seller"
                ? "Your order deadlines"
                : "Order confirmation & delivery"}
            </h2>

            <p className="mt-1 text-xs leading-5 text-slate-500">
              Sellers are expected to confirm within 24 hours.
              Each seller then has 72 hours for delivery or handoff.
            </p>
          </div>

          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
            {activeTimings.length} active{" "}
            {activeTimings.length === 1
              ? "seller portion"
              : "seller portions"}
          </span>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {visibleTimings.map((timing) => {
            const display = getTimingDisplay(
              timing,
              mode,
              now || Date.now()
            );

            const sellerName =
              sellerNames[timing.vendorId] ||
              `Seller ${timing.vendorId.slice(0, 6)}`;

            return (
              <article
                key={`${timing.orderId}-${timing.vendorId}`}
                className="rounded-xl border border-slate-200 bg-slate-50 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-slate-500">
                      Order #{timing.orderId.slice(0, 8)}
                    </p>

                    {mode === "buyer" ? (
                      <p className="mt-1 truncate text-xs font-semibold text-slate-700">
                        {sellerName}
                      </p>
                    ) : null}
                  </div>

                  <span
                    className={`rounded-full px-2.5 py-1 text-[10px] font-black ${
                      display.overdue
                        ? "bg-red-100 text-red-700"
                        : timing.status === "confirmed"
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {display.overdue
                      ? "Overdue"
                      : timing.status === "confirmed"
                        ? "Confirmed"
                        : "Awaiting confirmation"}
                  </span>
                </div>

                <p className="mt-3 text-sm font-bold text-slate-900">
                  {display.title}
                </p>

                <p
                  className={`mt-1 text-lg font-black tabular-nums ${
                    display.overdue
                      ? "text-red-700"
                      : "text-[#4A1724]"
                  }`}
                >
                  {display.remaining}
                </p>

                {display.deadline ? (
                  <p className="mt-1 text-xs text-slate-500">
                    Deadline: {display.deadline}
                  </p>
                ) : null}
              </article>
            );
          })}
        </div>

        {activeTimings.length > visibleTimings.length ? (
          <p className="mt-3 text-xs text-slate-500">
            Showing {visibleTimings.length} of{" "}
            {activeTimings.length} active seller portions.
            The complete order list is below.
          </p>
        ) : null}

        <p className="mt-4 text-[11px] leading-5 text-slate-500">
          These are expected deadlines. Missing a deadline
          does not automatically cancel or complete an order.
          Completion still requires the buyer's secure
          four-digit fulfilment code.
        </p>
      </div>
    </section>
  );
}
