
"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:5000";

type OrderStatus =
  | "pending"
  | "confirmed"
  | "completed"
  | "cancelled";

export type OrderTiming = {
  orderId: string;
  vendorId: string;
  status: OrderStatus;
  confirmationDueAt: string;
  confirmedAt: string | null;
  deliveryDueAt: string | null;
  readyAt?: string | null;
};

type TimingsResponse = {
  success?: boolean;
  timings?: OrderTiming[];
  message?: string;
};

export function useOrderTimings(
  accountId?: string | null
) {
  const [timings, setTimings] = useState<
    Record<string, OrderTiming>
  >({});

  const [now, setNow] = useState(0);
  const requestId = useRef(0);

  const refreshTimings = useCallback(async () => {
    const id = ++requestId.current;

    if (!accountId) {
      setTimings({});
      return;
    }

    const token = localStorage.getItem(
      "campusmart-token"
    );

    if (!token) {
      setTimings({});
      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/api/orders/timings`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        }
      );

      const data =
        (await response.json()) as TimingsResponse;

      if (
        !response.ok ||
        !data.success ||
        !Array.isArray(data.timings)
      ) {
        throw new Error(
          data.message ||
            "Unable to load order timings."
        );
      }

      if (id !== requestId.current) return;

      const next: Record<string, OrderTiming> = {};

      for (const timing of data.timings) {
        next[
          `${timing.orderId}:${timing.vendorId}`
        ] = timing;
      }

      setTimings(next);
    } catch (error) {
      console.error(
        "Order timing refresh failed:",
        error
      );
    }
  }, [accountId]);

  useEffect(() => {
    setNow(Date.now());
    void refreshTimings();

    const clock = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    const polling = window.setInterval(() => {
      if (!document.hidden) {
        void refreshTimings();
      }
    }, 30000);

    const onResume = () => {
      if (!document.hidden) {
        void refreshTimings();
      }
    };

    window.addEventListener("focus", onResume);
    document.addEventListener(
      "visibilitychange",
      onResume
    );

    return () => {
      requestId.current++;
      window.clearInterval(clock);
      window.clearInterval(polling);
      window.removeEventListener("focus", onResume);
      document.removeEventListener(
        "visibilitychange",
        onResume
      );
    };
  }, [refreshTimings]);

  return { timings, now, refreshTimings };
}

function durationLabel(milliseconds: number) {
  const total = Math.ceil(
    Math.abs(milliseconds) / 1000
  );

  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;

  const pad = (value: number) =>
    String(value).padStart(2, "0");

  if (days) {
    return `${days}d ${pad(hours)}h ${pad(minutes)}m`;
  }

  if (hours) {
    return `${hours}h ${pad(minutes)}m ${pad(seconds)}s`;
  }

  return `${minutes}m ${pad(seconds)}s`;
}

function deadlineLabel(value: string) {
  const date = new Date(value);

  return new Intl.DateTimeFormat(undefined, {
    timeZone: "Africa/Lagos",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function OrderDeadline({
  timing,
  status,
  now,
  perspective,
}: {
  timing?: OrderTiming;
  status: OrderStatus;
  now: number;
  perspective: "buyer" | "seller";
}) {
  if (perspective === "buyer") {
    if (status === "completed") return <p className="text-xs font-bold text-emerald-700">Handoff completed</p>;
    if (status === "cancelled") return <p className="text-xs font-bold text-red-700">Seller portion cancelled</p>;
    if (status === "pending") return <p className="text-xs text-slate-600">Awaiting seller confirmation (within 24 hours)</p>;
    if (timing?.readyAt) return <p className="text-xs font-black text-emerald-700">Ready for pickup — message your seller to arrange a time.</p>;
    const date=timing?.deliveryDueAt ? new Date(timing.deliveryDueAt) : null;
    return <p className="text-xs font-semibold text-slate-700">
      Seller is preparing your order. {date && !isNaN(date.getTime())
        ? `Expected handoff on or before ${date.toLocaleDateString("en-NG", {weekday:"long",day:"numeric",month:"long",timeZone:"Africa/Lagos"})}.`
        : "Expected handoff date being confirmed."}
    </p>;
  }
  if (status === "completed") {
    return (
      <p className="text-xs font-semibold text-emerald-700">
        Handoff completed
      </p>
    );
  }

  if (status === "cancelled") {
    return (
      <p className="text-xs font-semibold text-red-700">
        Seller portion cancelled
      </p>
    );
  }

  if (!timing) {
    return (
      <p className="text-xs text-slate-500">
        Loading order deadline...
      </p>
    );
  }

  const pending = status === "pending";

  const target = pending
    ? timing.confirmationDueAt
    : timing.deliveryDueAt;

  if (!target) {
    return (
      <p className="text-xs text-slate-500">
        {pending
          ? "Awaiting confirmation deadline"
          : "Delivery deadline unavailable"}
      </p>
    );
  }

  const deadline = Date.parse(target);

  if (!Number.isFinite(deadline)) {
    return (
      <p className="text-xs text-slate-500">
        Deadline unavailable
      </p>
    );
  }

  const difference = deadline - now;
  const overdue = now > 0 && difference <= 0;

  const title = pending
    ? perspective === "seller"
      ? "Confirm within 24 hours"
      : "Seller confirmation"
    : perspective === "seller"
      ? "Delivery / handoff due"
      : "Expected delivery / handoff";

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
      <div>
        <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">
          {title}
        </p>

        <p className="mt-1 text-[11px] text-slate-500">
          Deadline: {deadlineLabel(target)}
        </p>
      </div>

      <p
        className={`text-sm font-black tabular-nums ${
          overdue
            ? "text-red-700"
            : "text-[#6E3847]"
        }`}
      >
        {!now
          ? "Checking..."
          : overdue
            ? `Overdue ${durationLabel(difference)}`
            : durationLabel(difference)}
      </p>
    </div>
  );
}
