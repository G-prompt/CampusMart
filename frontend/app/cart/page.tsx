"use client";

import Link from "next/link";

import { useCart } from "@/components/common/CartContext";
import { formatNaira } from "@/lib/products";

export default function Page() {
  const {
    items,
    itemCount,
    productCount,
    subtotal,
    updateQuantity,
    removeFromCart,
    clearCart,
  } = useCart();

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

  return (
    <main className="main-container py-10 sm:py-12 lg:py-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-black">
            Your cart
          </h1>

          <p className="mt-2 text-sm leading-7 text-slate-600">
            Review your selected
            items before
            continuing to
            checkout.
          </p>
        </div>

        {items.length >
        0 ? (
          <button
            type="button"
            onClick={
              clearCart
            }
            className="text-sm font-bold text-slate-500 transition hover:text-red-600"
          >
            Clear cart
          </button>
        ) : null}
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
              Items
            </p>

            <span className="rounded-[10px] bg-slate-100 px-3 py-1 text-sm font-semibold text-black">
              {itemCount}{" "}
              {itemCount === 1
                ? "item"
                : "items"}
            </span>
          </div>

          {productCount >
          0 ? (
            <p className="mt-2 text-xs text-slate-500">
              {
                productCount
              }{" "}
              different{" "}
              {productCount ===
              1
                ? "product"
                : "products"}
            </p>
          ) : null}

          <div className="mt-6 space-y-3">
            {items.length ? (
              items.map(
                (item) => (
                  <article
                    key={
                      item.id
                    }
                    className="rounded-[10px] border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="font-semibold text-black">
                          {
                            item.title
                          }
                        </p>

                        <p className="mt-1 text-sm text-slate-600">
                          {formatNaira(
                            item.price
                          )}{" "}
                          each
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                        <div className="flex items-center rounded-[10px] border border-slate-200 bg-white">
                          <button
                            type="button"
                            onClick={() =>
                              updateQuantity(
                                item.id,
                                item.quantity -
                                  1
                              )
                            }
                            className="h-9 w-9 text-lg font-bold text-black transition hover:bg-slate-100"
                            aria-label={`Decrease quantity of ${item.title}`}
                          >
                            −
                          </button>

                          <span className="min-w-8 text-center text-sm font-bold text-black">
                            {
                              item.quantity
                            }
                          </span>

                          <button
                            type="button"
                            onClick={() =>
                              updateQuantity(
                                item.id,
                                item.quantity +
                                  1
                              )
                            }
                            className="h-9 w-9 text-lg font-bold text-black transition hover:bg-slate-100"
                            aria-label={`Increase quantity of ${item.title}`}
                          >
                            +
                          </button>
                        </div>

                        <p className="min-w-24 text-right text-sm font-bold text-black">
                          {formatNaira(
                            item.price *
                              item.quantity
                          )}
                        </p>

                        <button
                          type="button"
                          onClick={() =>
                            removeFromCart(
                              item.id
                            )
                          }
                          className="text-sm font-semibold text-red-600 transition hover:text-red-700"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </article>
                )
              )
            ) : (
              <div className="rounded-[10px] border border-dashed border-slate-300 bg-white p-8 text-center">
                <p className="font-semibold text-black">
                  Your cart is
                  empty.
                </p>

                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Browse CampusMart
                  and add something
                  you like.
                </p>

                <Link
                  href="/marketplace"
                  className="mt-5 inline-flex rounded-[10px] bg-accent-400 px-5 py-3 text-sm font-bold text-black transition hover:bg-accent-500"
                >
                  Browse
                  marketplace
                </Link>
              </div>
            )}
          </div>
        </section>

        <aside className="h-fit rounded-xl border border-slate-200 bg-white p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
            Order summary
          </p>

          <div className="mt-5 rounded-[10px] bg-slate-50 p-5 text-sm text-slate-600">
            <div className="flex items-center justify-between">
              <span>
                Items
              </span>

              <span className="font-semibold text-black">
                {
                  itemCount
                }
              </span>
            </div>

            <div className="mt-3 flex items-center justify-between">
              <span>
                Subtotal
              </span>

              <span className="font-semibold text-black">
                {formatNaira(
                  subtotal
                )}
              </span>
            </div>

            <div className="mt-3 flex items-center justify-between">
              <span>
                Secure
                transfer fee
              </span>

              <span className="font-semibold text-black">
                {formatNaira(
                  fee
                )}
              </span>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-4">
              <span className="font-bold text-black">
                Total
              </span>

              <span className="text-lg font-bold text-black">
                {formatNaira(
                  total
                )}
              </span>
            </div>
          </div>

          {items.length ? (
            <Link
              href="/checkout"
              className="mt-6 inline-flex w-full items-center justify-center rounded-[10px] bg-accent-400 px-5 py-3 text-sm font-bold text-black transition hover:bg-accent-500"
            >
              Proceed to
              checkout
            </Link>
          ) : (
            <button
              type="button"
              disabled
              className="mt-6 inline-flex w-full cursor-not-allowed items-center justify-center rounded-[10px] bg-slate-200 px-5 py-3 text-sm font-bold text-slate-500"
            >
              Proceed to
              checkout
            </button>
          )}

          <Link
            href="/marketplace"
            className="mt-3 inline-flex w-full items-center justify-center rounded-[10px] border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-black transition hover:bg-slate-50"
          >
            Continue shopping
          </Link>
        </aside>
      </div>
    </main>
  );
}