"use client";

import {
  useState,
} from "react";

import Link from "next/link";

import PageShell from "@/components/common/PageShell";
import { useCart } from "@/components/common/CartContext";
import { useAuth } from "@/components/common/AuthContext";

import {
  formatNaira,
} from "@/lib/products";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:5000";

type CreatedOrder = {
  id: string;
  subtotal: number;
  fee: number;
  total: number;
  status: string;
  paymentStatus: string;
};

export default function Page() {
  const {
    items,
    subtotal,
    clearCart,
  } = useCart();

  const {
    user,
    openAuth,
  } = useAuth();

  const [
    placingOrder,
    setPlacingOrder,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    createdOrder,
    setCreatedOrder,
  ] =
    useState<CreatedOrder | null>(
      null
    );

  const fee =
    subtotal >= 50000
      ? 100
      : subtotal >= 10000
        ? 50
        : subtotal > 0
          ? 20
          : 0;

  const total =
    subtotal + fee;

  const handlePlaceOrder =
    async () => {
      if (!user) {
        openAuth(
          "login"
        );

        return;
      }

      if (
        items.length === 0
      ) {
        setError(
          "Your cart is empty."
        );

        return;
      }

      const token =
        localStorage.getItem(
          "campusmart-token"
        );

      if (!token) {
        setError(
          "Your session has expired. Please sign in again."
        );

        return;
      }

      try {
        setPlacingOrder(
          true
        );

        setError("");

        const response =
          await fetch(
            `${API_URL}/api/orders`,
            {
              method:
                "POST",

              headers: {
                "Content-Type":
                  "application/json",

                Authorization:
                  `Bearer ${token}`,
              },

              /*
               * IMPORTANT:
               *
               * We send only product IDs
               * and quantities.
               *
               * Price, vendor and totals
               * are calculated securely
               * by the backend.
               */
              body:
                JSON.stringify({
                  items:
                    items.map(
                      (
                        item
                      ) => ({
                        productId:
                          item.id,

                        quantity:
                          item.quantity,
                      })
                    ),

                  pickupLocation:
                    user.campus
                      ? `${user.campus} campus pickup`
                      : "Campus pickup",

                  preferredSlot:
                    null,
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
              "Unable to create your order."
          );
        }

        setCreatedOrder({
          id:
            data.order.id,

          subtotal:
            data.order
              .subtotal,

          fee:
            data.order.fee,

          total:
            data.order.total,

          status:
            data.order.status,

          paymentStatus:
            data.order
              .paymentStatus,
        });

        clearCart();

        window.dispatchEvent(
          new CustomEvent(
            "campusmart-toast",
            {
              detail: {
                message:
                  "Order created successfully",
              },
            }
          )
        );
      } catch (error) {
        console.error(
          "Checkout order error:",
          error
        );

        setError(
          error instanceof Error
            ? error.message
            : "Unable to create your order."
        );
      } finally {
        setPlacingOrder(
          false
        );
      }
    };

  if (createdOrder) {
    return (
      <PageShell
        title="Order received"
        description="Your CampusMart order has been created successfully."
      >
        <div className="mx-auto max-w-2xl">
          <div className="site-card p-6 sm:p-8">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-700">
              ✓
            </div>

            <h2 className="mt-5 text-2xl font-bold text-slate-950">
              Your order has
              been created
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              The vendor can now
              see this order in
              their CampusMart
              dashboard.
            </p>

            <div className="mt-6 rounded-xl bg-slate-50 p-5">
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="text-slate-500">
                  Order reference
                </span>

                <span className="max-w-[60%] break-all text-right font-bold text-slate-950">
                  {
                    createdOrder.id
                  }
                </span>
              </div>

              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-slate-500">
                  Order status
                </span>

                <span className="font-bold capitalize text-slate-950">
                  {
                    createdOrder.status
                  }
                </span>
              </div>

              <div className="mt-3 flex items-center justify-between text-sm">
                <span className="text-slate-500">
                  Payment
                </span>

                <span className="font-bold capitalize text-amber-700">
                  {
                    createdOrder.paymentStatus
                  }
                </span>
              </div>

              <div className="mt-4 border-t border-slate-200 pt-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">
                    Subtotal
                  </span>

                  <span className="font-semibold text-slate-950">
                    {formatNaira(
                      createdOrder.subtotal
                    )}
                  </span>
                </div>

                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className="text-slate-500">
                    CampusMart fee
                  </span>

                  <span className="font-semibold text-slate-950">
                    {formatNaira(
                      createdOrder.fee
                    )}
                  </span>
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3">
                  <span className="font-bold text-slate-950">
                    Total
                  </span>

                  <span className="text-lg font-bold text-slate-950">
                    {formatNaira(
                      createdOrder.total
                    )}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/marketplace"
                className="rounded-[10px] bg-accent-400 px-5 py-3 text-sm font-bold text-black transition hover:bg-accent-500"
              >
                Continue shopping
              </Link>

              <Link
                href="/buyer/orders"
                className="rounded-[10px] border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:border-black hover:text-black"
              >
                View my orders
              </Link>
            </div>
          </div>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Checkout"
      description="Review your CampusMart order before placing it."
    >
      <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="site-card p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-black">
            Pickup details
          </p>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-[10px] border border-slate-200 p-4">
              <p className="text-sm font-semibold text-slate-950">
                Campus
              </p>

              <p className="mt-2 text-sm text-slate-600">
                {user?.campus ||
                  "Campus pickup"}
              </p>
            </div>

            <div className="rounded-[10px] border border-slate-200 p-4">
              <p className="text-sm font-semibold text-slate-950">
                Fulfilment
              </p>

              <p className="mt-2 text-sm text-slate-600">
                Arrange collection
                with the vendor
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-[10px] border border-slate-200 p-4">
            <p className="text-sm font-semibold text-slate-950">
              Items in your order
            </p>

            <div className="mt-4 space-y-3">
              {items.length ? (
                items.map(
                  (
                    item
                  ) => (
                    <div
                      key={
                        item.id
                      }
                      className="flex items-center justify-between gap-4 rounded-[10px] bg-slate-50 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-950">
                          {
                            item.title
                          }
                        </p>

                        <p className="text-sm text-slate-600">
                          Qty{" "}
                          {
                            item.quantity
                          }
                        </p>
                      </div>

                      <p className="shrink-0 text-sm font-semibold text-slate-950">
                        {formatNaira(
                          item.price *
                            item.quantity
                        )}
                      </p>
                    </div>
                  )
                )
              ) : (
                <div className="py-6 text-center">
                  <p className="text-sm text-slate-600">
                    Your cart is
                    empty.
                  </p>

                  <Link
                    href="/marketplace"
                    className="mt-4 inline-block text-sm font-bold text-black underline underline-offset-4"
                  >
                    Explore marketplace
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="site-card p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-black">
            Order summary
          </p>

          <div className="mt-5 rounded-[10px] bg-slate-50 p-5 text-sm text-slate-600">
            <div className="flex items-center justify-between">
              <span>
                Subtotal
              </span>

              <span className="font-semibold text-slate-950">
                {formatNaira(
                  subtotal
                )}
              </span>
            </div>

            <div className="mt-2 flex items-center justify-between">
              <span>
                CampusMart fee
              </span>

              <span className="font-semibold text-slate-950">
                {formatNaira(
                  fee
                )}
              </span>
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3">
              <span>
                Total
              </span>

              <span className="font-semibold text-slate-950">
                {formatNaira(
                  total
                )}
              </span>
            </div>
          </div>

          {error ? (
            <p
              className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-semibold text-red-600"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          {!user ? (
            <button
              type="button"
              onClick={() =>
                openAuth(
                  "login"
                )
              }
              className="mt-6 inline-flex w-full items-center justify-center rounded-[10px] bg-accent-400 px-5 py-3 text-sm font-bold text-black transition hover:bg-accent-500"
            >
              Sign in to checkout
            </button>
          ) : (
            <button
              type="button"
              onClick={
                handlePlaceOrder
              }
              disabled={
                placingOrder ||
                items.length ===
                  0
              }
              className="mt-6 inline-flex w-full items-center justify-center rounded-[10px] bg-accent-400 px-5 py-3 text-sm font-bold text-black transition hover:bg-accent-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {placingOrder
                ? "Creating order..."
                : "Place order"}
            </button>
          )}

          <p className="mt-4 text-sm leading-7 text-slate-600">
            This currently
            creates your
            CampusMart order.
            Payment remains
            pending until the
            CampusMart wallet
            system is connected.
          </p>
        </div>
      </div>
    </PageShell>
  );
}