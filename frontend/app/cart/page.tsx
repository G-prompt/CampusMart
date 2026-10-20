"use client";

import Link from "next/link";

import {
  useCart,
} from "@/components/common/CartContext";

import {
  formatNaira,
} from "@/lib/products";

export default function Page() {
  const {
    items,
    itemCount,
    productCount,
    subtotal,
    updateQuantity,
    removeFromCart,
    clearCart,
  } =
    useCart();

  const fee =
    subtotal >=
    50000
      ? 100
      : subtotal >=
          10000
        ? 50
        : subtotal >
            0
          ? 20
          : 0;

  const total =
    subtotal +
    fee;

  return (
    <main className="main-container py-7 sm:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-black">
            Your cart
          </h1>

          <p className="mt-1 text-sm text-slate-600">
            Check your items and options before checkout.
          </p>
        </div>

        {items.length >
        0 ? (
          <button
            type="button"
            onClick={
              clearCart
            }
            className="text-sm font-bold text-slate-500 hover:text-red-600"
          >
            Clear cart
          </button>
        ) : null}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                Items
              </p>

              {productCount >
              0 ? (
                <p className="mt-1 text-xs text-slate-400">
                  {productCount} different{" "}
                  {productCount ===
                  1
                    ? "product"
                    : "products"}
                </p>
              ) : null}
            </div>

            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black">
              {itemCount}{" "}
              {itemCount ===
              1
                ? "item"
                : "items"}
            </span>
          </div>

          <div className="mt-4 space-y-3">
            {items.length ? (
              items.map(
                (
                  item
                ) => (
                  <article
                    key={
                      item.cartKey
                    }
                    className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:gap-4"
                  >
                    <Link
                      href={`/marketplace/products/${item.id}`}
                      className="h-24 w-20 shrink-0 overflow-hidden rounded-lg bg-slate-200 sm:h-28 sm:w-24"
                    >
                      {item.image ? (
                        <img
                          src={
                            item.image
                          }
                          alt={
                            item.title
                          }
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center bg-slate-900 px-2 text-center text-[9px] font-bold text-white">
                          CampusMart
                        </div>
                      )}
                    </Link>

                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/marketplace/products/${item.id}`}
                        className="line-clamp-2 text-sm font-black text-slate-950 hover:underline"
                      >
                        {
                          item.title
                        }
                      </Link>

                      <p className="mt-1 text-xs text-slate-500">
                        {formatNaira(
                          item.price
                        )}{" "}
                        each
                      </p>

                      {item.selectedSize ||
                      item.selectedColor ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {item.selectedSize ? (
                            <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-slate-700 ring-1 ring-slate-200">
                              Size{" "}
                              {
                                item.selectedSize
                              }
                            </span>
                          ) : null}

                          {item.selectedColor ? (
                            <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-slate-700 ring-1 ring-slate-200">
                              {
                                item.selectedColor
                              }
                            </span>
                          ) : null}
                        </div>
                      ) : null}

                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <div className="flex items-center rounded-lg border border-slate-200 bg-white">
                          <button
                            type="button"
                            onClick={() =>
                              updateQuantity(
                                item.cartKey,
                                item.quantity -
                                  1
                              )
                            }
                            className="h-8 w-8 text-base font-bold"
                          >
                            −
                          </button>

                          <span className="min-w-7 text-center text-xs font-black">
                            {
                              item.quantity
                            }
                          </span>

                          <button
                            type="button"
                            onClick={() =>
                              updateQuantity(
                                item.cartKey,
                                item.quantity +
                                  1
                              )
                            }
                            className="h-8 w-8 text-base font-bold"
                          >
                            +
                          </button>
                        </div>

                        <span className="text-sm font-black">
                          {formatNaira(
                            item.price *
                              item.quantity
                          )}
                        </span>

                        <button
                          type="button"
                          onClick={() =>
                            removeFromCart(
                              item.cartKey
                            )
                          }
                          className="text-xs font-bold text-red-600"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </article>
                )
              )
            ) : (
              <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center">
                <p className="font-black">
                  Your cart is empty.
                </p>

                <Link
                  href="/marketplace"
                  className="mt-5 inline-flex rounded-lg bg-accent-400 px-5 py-3 text-sm font-black"
                >
                  Browse marketplace
                </Link>
              </div>
            )}
          </div>
        </section>

        <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5 lg:sticky lg:top-28">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
            Order summary
          </p>

          <div className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">
                Subtotal
              </span>

              <span className="font-bold">
                {formatNaira(
                  subtotal
                )}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-500">
                CampusMart fee
              </span>

              <span className="font-bold">
                {formatNaira(
                  fee
                )}
              </span>
            </div>

            <div className="flex justify-between border-t border-slate-200 pt-3 text-base">
              <span className="font-black">
                Total
              </span>

              <span className="font-black">
                {formatNaira(
                  total
                )}
              </span>
            </div>
          </div>

          {items.length ? (
            <Link
              href="/checkout"
              className="mt-5 inline-flex w-full items-center justify-center rounded-lg bg-accent-400 px-4 py-3 text-sm font-black"
            >
              Proceed to checkout
            </Link>
          ) : (
            <button
              disabled
              className="mt-5 w-full rounded-lg bg-slate-200 px-4 py-3 text-sm font-black text-slate-500"
            >
              Proceed to checkout
            </button>
          )}

          <Link
            href="/marketplace"
            className="mt-3 inline-flex w-full justify-center py-2 text-sm font-bold text-slate-500 hover:text-black"
          >
            Continue shopping
          </Link>
        </aside>
      </div>
    </main>
  );
}