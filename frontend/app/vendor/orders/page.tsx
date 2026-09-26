"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import Link from "next/link";

import PageShell from "@/components/common/PageShell";
import { useAuth } from "@/components/common/AuthContext";
import { formatNaira } from "@/lib/products";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:5000";

type OrderStatus =
  | "pending"
  | "confirmed"
  | "completed"
  | "cancelled";

type PaymentStatus =
  | "pending"
  | "paid"
  | "refunded";

type VendorOrderItem = {
  id: string;
  productId: number | null;
  productTitle: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  status: OrderStatus;

  product?: {
    id: number;
    slug: string;
    title: string;
    images: string[];
  } | null;
};

type VendorOrder = {
  id: string;

  status: OrderStatus;
  vendorStatus: OrderStatus;
  paymentStatus: PaymentStatus;

  pickupLocation:
    | string
    | null;

  preferredSlot:
    | string
    | null;

  createdAt: string;

  buyer: {
    id: string;
    name: string;
    campus:
      | string
      | null;
    phone:
      | string
      | null;
  };

  items: VendorOrderItem[];
};

type VendorSummary = {
  orderCount: number;
  pendingOrderCount: number;
  itemCount: number;
  revenue: number;
};

function statusLabel(
  status: OrderStatus
) {
  if (
    status ===
    "confirmed"
  ) {
    return "Confirmed";
  }

  if (
    status ===
    "completed"
  ) {
    return "Completed";
  }

  if (
    status ===
    "cancelled"
  ) {
    return "Cancelled";
  }

  return "Pending";
}

function statusClasses(
  status: OrderStatus
) {
  if (
    status ===
    "completed"
  ) {
    return "bg-emerald-100 text-emerald-700";
  }

  if (
    status ===
    "confirmed"
  ) {
    return "bg-blue-100 text-blue-700";
  }

  if (
    status ===
    "cancelled"
  ) {
    return "bg-red-100 text-red-700";
  }

  return "bg-amber-100 text-amber-700";
}

export default function Page() {
  const {
    user,
    openAuth,
  } = useAuth();

  const [
    orders,
    setOrders,
  ] =
    useState<VendorOrder[]>(
      []
    );

  const [
    summary,
    setSummary,
  ] =
    useState<VendorSummary>({
      orderCount: 0,
      pendingOrderCount: 0,
      itemCount: 0,
      revenue: 0,
    });

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const [
    updatingOrderId,
    setUpdatingOrderId,
  ] =
    useState<string | null>(
      null
    );

  const loadOrders =
    useCallback(
      async (
        signal?: AbortSignal
      ) => {
        if (
          user?.role !==
          "vendor"
        ) {
          return;
        }

        const token =
          localStorage.getItem(
            "campusmart-token"
          );

        if (!token) {
          throw new Error(
            "Your session is unavailable."
          );
        }

        const response =
          await fetch(
            `${API_URL}/api/orders/vendor`,
            {
              headers: {
                Authorization:
                  `Bearer ${token}`,
              },

              signal,
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
              "Unable to load vendor orders."
          );
        }

        setOrders(
          Array.isArray(
            data.orders
          )
            ? data.orders
            : []
        );

        setSummary({
          orderCount:
            Number(
              data.summary
                ?.orderCount
            ) || 0,

          pendingOrderCount:
            Number(
              data.summary
                ?.pendingOrderCount
            ) || 0,

          itemCount:
            Number(
              data.summary
                ?.itemCount
            ) || 0,

          revenue:
            Number(
              data.summary
                ?.revenue
            ) || 0,
        });
      },
      [user]
    );

  useEffect(() => {
    if (
      user?.role !==
      "vendor"
    ) {
      setLoading(false);

      return;
    }

    const controller =
      new AbortController();

    const run =
      async () => {
        try {
          setLoading(true);
          setError("");

          await loadOrders(
            controller.signal
          );
        } catch (error) {
          if (
            error instanceof
              DOMException &&
            error.name ===
              "AbortError"
          ) {
            return;
          }

          console.error(
            "Vendor orders error:",
            error
          );

          setError(
            error instanceof Error
              ? error.message
              : "Unable to load vendor orders."
          );
        } finally {
          setLoading(false);
        }
      };

    run();

    return () =>
      controller.abort();
  }, [
    user,
    loadOrders,
  ]);

  const updateStatus =
    async (
      orderId: string,
      status:
        | "confirmed"
        | "completed"
        | "cancelled"
    ) => {
      const token =
        localStorage.getItem(
          "campusmart-token"
        );

      if (!token) {
        setError(
          "Your session is unavailable."
        );

        return;
      }

      try {
        setUpdatingOrderId(
          orderId
        );

        setError("");

        const response =
          await fetch(
            `${API_URL}/api/orders/vendor/${orderId}/status`,
            {
              method:
                "PATCH",

              headers: {
                "Content-Type":
                  "application/json",

                Authorization:
                  `Bearer ${token}`,
              },

              body:
                JSON.stringify({
                  status,
                }),
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
              "Unable to update order."
          );
        }

        await loadOrders();

        window.dispatchEvent(
          new CustomEvent(
            "campusmart-toast",
            {
              detail: {
                message:
                  status ===
                  "confirmed"
                    ? "Order confirmed"
                    : status ===
                        "completed"
                      ? "Order completed"
                      : "Order cancelled",
              },
            }
          )
        );
      } catch (error) {
        console.error(
          "Order status update error:",
          error
        );

        setError(
          error instanceof Error
            ? error.message
            : "Unable to update order."
        );
      } finally {
        setUpdatingOrderId(
          null
        );
      }
    };

  if (
    user?.role !==
    "vendor"
  ) {
    return (
      <PageShell
        title="Vendor orders"
        description="Track incoming orders from CampusMart buyers."
      >
        <div className="site-card max-w-md p-8 text-center">
          <h2 className="text-2xl font-bold text-slate-950">
            Vendor access
            required
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-600">
            Sign in with a
            vendor account to
            view orders for
            your products.
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
      title="Vendor orders"
      description="Track and manage incoming CampusMart orders containing your products."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="site-card p-5">
          <p className="text-sm text-slate-500">
            Orders
          </p>

          <p className="mt-2 text-3xl font-bold text-slate-950">
            {
              summary.orderCount
            }
          </p>
        </div>

        <div className="site-card p-5">
          <p className="text-sm text-slate-500">
            Pending
          </p>

          <p className="mt-2 text-3xl font-bold text-slate-950">
            {
              summary.pendingOrderCount
            }
          </p>
        </div>

        <div className="site-card p-5">
          <p className="text-sm text-slate-500">
            Items ordered
          </p>

          <p className="mt-2 text-3xl font-bold text-slate-950">
            {
              summary.itemCount
            }
          </p>
        </div>

        <div className="site-card p-5">
          <p className="text-sm text-slate-500">
            Revenue
          </p>

          <p className="mt-2 text-3xl font-bold text-slate-950">
            {formatNaira(
              summary.revenue
            )}
          </p>

          <p className="mt-1 text-xs text-slate-500">
            Paid and completed
            items only
          </p>
        </div>
      </div>

      {loading ? (
        <p className="mt-10 text-center text-sm font-semibold text-slate-600">
          Loading orders...
        </p>
      ) : null}

      {error ? (
        <p
          className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm font-semibold text-red-600"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      {!loading &&
      orders.length ===
        0 ? (
        <div className="site-card mt-8 flex flex-col items-center px-6 py-16 text-center">
          <h2 className="text-2xl font-bold text-slate-950">
            No orders yet
          </h2>

          <p className="mt-2 max-w-md text-sm leading-6 text-slate-600">
            When a buyer
            orders one of your
            products, it will
            appear here.
          </p>

          <Link
            href="/vendor/listings"
            className="mt-6 rounded-[10px] bg-accent-400 px-5 py-3 text-sm font-bold text-black"
          >
            View your listings
          </Link>
        </div>
      ) : null}

      {!loading &&
      orders.length >
        0 ? (
        <div className="mt-8 space-y-5">
          {orders.map(
            (
              order
            ) => {
              const vendorTotal =
                order.items.reduce(
                  (
                    total,
                    item
                  ) =>
                    total +
                    item.lineTotal,
                  0
                );

              const busy =
                updatingOrderId ===
                order.id;

              return (
                <article
                  key={
                    order.id
                  }
                  className="site-card overflow-hidden"
                >
                  <div className="flex flex-col gap-4 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                        Order
                      </p>

                      <p className="mt-1 break-all text-sm font-bold text-slate-950">
                        {
                          order.id
                        }
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ${statusClasses(
                          order.vendorStatus
                        )}`}
                      >
                        {statusLabel(
                          order.vendorStatus
                        )}
                      </span>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ${
                          order.paymentStatus ===
                          "paid"
                            ? "bg-emerald-100 text-emerald-700"
                            : order.paymentStatus ===
                                "refunded"
                              ? "bg-slate-200 text-slate-700"
                              : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        Payment{" "}
                        {
                          order.paymentStatus
                        }
                      </span>
                    </div>
                  </div>

                  <div className="grid gap-6 p-5 lg:grid-cols-[0.7fr_1.3fr]">
                    <div>
                      <p className="text-sm font-bold text-slate-950">
                        Buyer
                      </p>

                      <p className="mt-2 text-sm text-slate-700">
                        {
                          order.buyer
                            .name
                        }
                      </p>

                      {order.buyer
                        .campus ? (
                        <p className="mt-1 text-sm text-slate-500">
                          {
                            order
                              .buyer
                              .campus
                          }
                        </p>
                      ) : null}

                      {order.buyer
                        .phone ? (
                        <p className="mt-1 text-sm text-slate-500">
                          {
                            order
                              .buyer
                              .phone
                          }
                        </p>
                      ) : null}

                      <p className="mt-5 text-sm font-bold text-slate-950">
                        Pickup
                      </p>

                      <p className="mt-2 text-sm text-slate-600">
                        {order.pickupLocation ||
                          "Campus pickup"}
                      </p>

                      <p className="mt-5 text-xs text-slate-500">
                        {new Date(
                          order.createdAt
                        ).toLocaleString()}
                      </p>
                    </div>

                    <div>
                      <p className="text-sm font-bold text-slate-950">
                        Your items
                      </p>

                      <div className="mt-3 space-y-3">
                        {order.items.map(
                          (
                            item
                          ) => (
                            <div
                              key={
                                item.id
                              }
                              className="rounded-[10px] bg-slate-50 p-4"
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div>
                                  <p className="font-bold text-slate-950">
                                    {
                                      item.productTitle
                                    }
                                  </p>

                                  <p className="mt-1 text-sm text-slate-500">
                                    Qty{" "}
                                    {
                                      item.quantity
                                    }{" "}
                                    ×{" "}
                                    {formatNaira(
                                      item.unitPrice
                                    )}
                                  </p>

                                  <span
                                    className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${statusClasses(
                                      item.status
                                    )}`}
                                  >
                                    {statusLabel(
                                      item.status
                                    )}
                                  </span>
                                </div>

                                <p className="shrink-0 font-bold text-slate-950">
                                  {formatNaira(
                                    item.lineTotal
                                  )}
                                </p>
                              </div>
                            </div>
                          )
                        )}
                      </div>

                      <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-4">
                        <span className="text-sm font-bold text-slate-600">
                          Your order
                          total
                        </span>

                        <span className="text-lg font-bold text-slate-950">
                          {formatNaira(
                            vendorTotal
                          )}
                        </span>
                      </div>

                      {order.vendorStatus ===
                      "pending" ? (
                        <div className="mt-5 flex flex-wrap gap-3">
                          <button
                            type="button"
                            disabled={
                              busy
                            }
                            onClick={() =>
                              updateStatus(
                                order.id,
                                "confirmed"
                              )
                            }
                            className="rounded-[10px] bg-accent-400 px-5 py-2.5 text-sm font-bold text-black transition hover:bg-accent-500 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {busy
                              ? "Updating..."
                              : "Confirm order"}
                          </button>

                          <button
                            type="button"
                            disabled={
                              busy
                            }
                            onClick={() =>
                              updateStatus(
                                order.id,
                                "cancelled"
                              )
                            }
                            className="rounded-[10px] border border-red-200 bg-white px-5 py-2.5 text-sm font-bold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Cancel order
                          </button>
                        </div>
                      ) : null}

                      {order.vendorStatus ===
                      "confirmed" ? (
                        <div className="mt-5 flex flex-wrap gap-3">
                          <button
                            type="button"
                            disabled={
                              busy
                            }
                            onClick={() =>
                              updateStatus(
                                order.id,
                                "completed"
                              )
                            }
                            className="rounded-[10px] bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {busy
                              ? "Updating..."
                              : "Mark completed"}
                          </button>

                          <button
                            type="button"
                            disabled={
                              busy
                            }
                            onClick={() =>
                              updateStatus(
                                order.id,
                                "cancelled"
                              )
                            }
                            className="rounded-[10px] border border-red-200 bg-white px-5 py-2.5 text-sm font-bold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Cancel order
                          </button>
                        </div>
                      ) : null}

                      {order.vendorStatus ===
                      "completed" ? (
                        <p className="mt-5 text-sm font-semibold text-emerald-700">
                          This order has
                          been completed.
                        </p>
                      ) : null}

                      {order.vendorStatus ===
                      "cancelled" ? (
                        <p className="mt-5 text-sm font-semibold text-red-600">
                          This order has
                          been cancelled.
                        </p>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            }
          )}
        </div>
      ) : null}
    </PageShell>
  );
}