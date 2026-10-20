
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

import PageShell from "@/components/common/PageShell";
import { useCart } from "@/components/common/CartContext";
import { useAuth } from "@/components/common/AuthContext";
import { formatNaira } from "@/lib/products";
import { displayPhone } from "@/lib/phone";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

type PickupMode = "shared_campus" | "seller_points";

type ProductMetadata = {
  id: number;
  vendorId?: string;
  seller: string;
  images?: string[];
};

type PickupPoint = {
  id: string;
  type: "campus" | "hostel_block" | "faculty_building" | "custom";
  label: string;
  detail: string | null;
};

type ResolvedCartItem = {
  cartKey: string;
  id: number;
  title: string;
  price: number;
  quantity: number;
  vendorId: string;
  seller: string;
  image?: string;
  selectedSize?: string;
  selectedColor?: string;
};

type SellerGroup = {
  vendorId: string;
  seller: string;
  items: ResolvedCartItem[];
};

type CreatedOrder = {
  id: string;
  subtotal: number;
  fee: number;
  total: number;
  status: string;
  paymentStatus: string;
};

function pickupLabel(point: PickupPoint) {
  return [point.label, point.detail].filter(Boolean).join(" — ");
}

function itemVariantLabel(item: ResolvedCartItem) {
  return [
    item.selectedSize ? `Size ${item.selectedSize}` : null,
    item.selectedColor || null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function sellerProductLabel(group: SellerGroup) {
  return group.items
    .map((item) =>
      item.quantity > 1
        ? `${item.title} ×${item.quantity}`
        : item.title
    )
    .join(", ");
}

export default function Page() {
  const {
    items,
    subtotal,
    clearCart,
    updateQuantity,
    removeFromCart,
  } = useCart();

  const { user, openAuth } = useAuth();

  /*
   * PRODUCT METADATA
   *
   * Product IDs are tracked separately from quantities
   * so quantity changes do not trigger new product fetches.
   */

  const productIds = [
    ...new Set(items.map((item) => item.id)),
  ]
    .sort((a, b) => a - b)
    .join(",");

  const cartSignature = items
    .map((item) => `${item.cartKey}:${item.quantity}`)
    .join("|");

  const [productMetadata, setProductMetadata] =
    useState<ProductMetadata[]>([]);

  const [metadataLoading, setMetadataLoading] = useState(true);

  /*
   * PICKUP ARRANGEMENTS
   */

  const [pickupOptions, setPickupOptions] =
    useState<Record<string, PickupPoint[]>>({});

  const [sellerUniversities, setSellerUniversities] =
    useState<Record<string, string | null>>({});

  const [pickupLoading, setPickupLoading] = useState(false);
  const [pickupError, setPickupError] = useState("");

  const [selectedPickup, setSelectedPickup] =
    useState<Record<string, string>>({});

  const [pickupMode, setPickupMode] =
    useState<PickupMode>("seller_points");

  const [campusMeetupLocation, setCampusMeetupLocation] =
    useState("");

  const pickupModeChosen = useRef(false);

  /*
   * CONTACT, WALLET AND ORDER STATE
   */

  const [secondaryPhone, setSecondaryPhone] = useState("");

  const [walletBalance, setWalletBalance] =
    useState<number | null>(null);

  const [walletLoading, setWalletLoading] = useState(false);

  const [walletUnavailable, setWalletUnavailable] =
    useState(false);

  const [topUpInfoOpen, setTopUpInfoOpen] = useState(false);

  const [placingOrder, setPlacingOrder] = useState(false);

  const [error, setError] = useState("");

  const [createdOrder, setCreatedOrder] =
    useState<CreatedOrder | null>(null);

  const checkoutKey = useRef<string | null>(null);

  /*
   * LOAD WALLET BALANCE
   *
   * Balance always comes from the authenticated backend.
   */

  useEffect(() => {
    let active = true;

    const loadWallet = async () => {
      if (!user) {
        setWalletBalance(null);
        return;
      }

      const token = localStorage.getItem("campusmart-token");

      if (!token) {
        setWalletBalance(null);
        return;
      }

      setWalletLoading(true);

      try {
        const response = await fetch(
          `${API_URL}/api/wallet/checkout`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            cache: "no-store",
          }
        );

        const data = await response.json();

        if (
          !response.ok ||
          !data.success ||
          typeof data.balance !== "number"
        ) {
          throw new Error(
            data.message || "Wallet unavailable"
          );
        }

        if (active) {
          setWalletBalance(data.balance);
          setWalletUnavailable(false);
        }
      } catch {
        if (active) {
          setWalletBalance(null);
          setWalletUnavailable(true);
        }
      } finally {
        if (active) {
          setWalletLoading(false);
        }
      }
    };

    void loadWallet();

    const onFocus = () => {
      void loadWallet();
    };

    window.addEventListener("focus", onFocus);

    return () => {
      active = false;
      window.removeEventListener("focus", onFocus);
    };
  }, [user?.id]);

  /*
   * LOAD PRODUCT METADATA
   */

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!productIds) {
        setProductMetadata([]);
        setMetadataLoading(false);
        return;
      }

      setMetadataLoading(true);

      try {
        const response = await fetch(
          `${API_URL}/api/products`,
          {
            cache: "no-store",
          }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(
            data.message || "Unable to verify cart products."
          );
        }

        if (active) {
          setProductMetadata(
            Array.isArray(data.products) ? data.products : []
          );
        }
      } catch (cause) {
        if (active) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Unable to check your cart."
          );
        }
      } finally {
        if (active) {
          setMetadataLoading(false);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [productIds]);

  /*
   * RESOLVE CART ITEMS
   *
   * Every product remains an individual item in the UI.
   * Seller grouping is retained internally for pickup and
   * backend order fulfilment.
   */

  const resolvedItems = useMemo(
    () =>
      items.map((item) => {
        const metadata = productMetadata.find(
          (product) => product.id === item.id
        );

        return {
          ...item,
          vendorId: item.vendorId || metadata?.vendorId || "",
          seller:
            item.seller ||
            metadata?.seller ||
            "CampusMart seller",
          image: item.image || metadata?.images?.[0],
        };
      }),
    [items, productMetadata]
  );

  const unresolvedItems = resolvedItems.filter(
    (item) => !item.vendorId
  );

  const sellerGroups = useMemo<SellerGroup[]>(() => {
    const map = new Map<string, SellerGroup>();

    for (const item of resolvedItems) {
      if (!item.vendorId) continue;

      const existing = map.get(item.vendorId);

      if (existing) {
        existing.items.push(item as ResolvedCartItem);
      } else {
        map.set(item.vendorId, {
          vendorId: item.vendorId,
          seller: item.seller,
          items: [item as ResolvedCartItem],
        });
      }
    }

    return Array.from(map.values());
  }, [resolvedItems]);

  const sellerKey = sellerGroups
    .map((group) => group.vendorId)
    .join("|");

  const itemCount = items.reduce(
    (sum, item) => sum + item.quantity,
    0
  );

  /*
   * CART CHANGES
   */

  useEffect(() => {
    checkoutKey.current = null;
    setError("");
  }, [cartSignature]);

  const changeQuantity = (
    key: string,
    quantity: number,
    change: -1 | 1
  ) => {
    if (placingOrder) return;

    const next = quantity + change;

    if (next < 1 || next > 99) return;

    updateQuantity(key, next);
  };

  const removeItem = (key: string) => {
    if (placingOrder) return;

    removeFromCart(key);
  };

  useEffect(() => {
    pickupModeChosen.current = false;
    setPickupMode("seller_points");
    checkoutKey.current = null;
  }, [sellerKey]);

  /*
   * LOAD SELLER PICKUP POINTS
   */

  useEffect(() => {
    let active = true;

    const loadPickup = async () => {
      if (!sellerGroups.length) {
        setPickupOptions({});
        setSellerUniversities({});
        return;
      }

      setPickupLoading(true);
      setPickupError("");

      try {
        const rows = await Promise.all(
          sellerGroups.map(async (group) => {
            const response = await fetch(
              `${API_URL}/api/vendor/storefront/${encodeURIComponent(
                group.vendorId
              )}/pickup-points`,
              {
                cache: "no-store",
              }
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
              throw new Error(
                data.message ||
                  `Pickup options unavailable for ${group.seller}.`
              );
            }

            return {
              vendorId: group.vendorId,
              universityId:
                typeof data.universityId === "string"
                  ? data.universityId
                  : null,
              points: Array.isArray(data.pickupPoints)
                ? (data.pickupPoints as PickupPoint[])
                : [],
            };
          })
        );

        if (!active) return;

        const points: Record<string, PickupPoint[]> = {};
        const universities: Record<string, string | null> = {};
        const defaults: Record<string, string> = {};

        for (const row of rows) {
          points[row.vendorId] = row.points;
          universities[row.vendorId] = row.universityId;

          if (row.points.length === 1) {
            defaults[row.vendorId] = row.points[0].id;
          }
        }

        setPickupOptions(points);
        setSellerUniversities(universities);

        setSelectedPickup((existing) => ({
          ...defaults,
          ...existing,
        }));
      } catch (cause) {
        if (active) {
          setPickupError(
            cause instanceof Error
              ? cause.message
              : "Unable to load pickup options."
          );
        }
      } finally {
        if (active) {
          setPickupLoading(false);
        }
      }
    };

    void loadPickup();

    return () => {
      active = false;
    };
  }, [sellerKey]);

  /*
   * UNIVERSITY ELIGIBILITY
   */

  const sameUniversity = Boolean(
    user?.universityId &&
      sellerGroups.length > 0 &&
      sellerGroups.every(
        (group) =>
          sellerUniversities[group.vendorId] === user.universityId
      )
  );

  useEffect(() => {
    if (
      !pickupLoading &&
      !pickupError &&
      sellerGroups.length &&
      Object.keys(sellerUniversities).length ===
        sellerGroups.length &&
      !pickupModeChosen.current
    ) {
      setPickupMode(
        sameUniversity && sellerGroups.length > 1
          ? "shared_campus"
          : "seller_points"
      );
    }
  }, [
    pickupLoading,
    pickupError,
    sameUniversity,
    sellerKey,
    sellerUniversities,
  ]);

  /*
   * CHECKOUT VALIDATION
   */

  const fee = subtotal > 0 ? 100 : 0;
  const total = subtotal + fee;

  const sellerPickupReady =
    sellerGroups.length > 0 &&
    sellerGroups.every((group) =>
      (pickupOptions[group.vendorId] || []).some(
        (point) => point.id === selectedPickup[group.vendorId]
      )
    );

  const campusLocation = campusMeetupLocation
    .trim()
    .replace(/\s+/g, " ");

  const campusLocationValid =
    campusLocation.length >= 5 &&
    campusLocation.length <= 120 &&
    !/(?:https?:|www\.|@)/i.test(campusLocation) &&
    !/\+?\d[\d\s()\-]{7,}\d/.test(campusLocation);

  const pickupReady =
    !pickupLoading &&
    !pickupError &&
    (pickupMode === "shared_campus"
      ? sameUniversity && campusLocationValid
      : sellerPickupReady);

  const canAfford =
    walletBalance !== null && walletBalance >= total;

  /*
   * PLACE ORDER
   *
   * Existing order payload, wallet validation, seller
   * pickup grouping and idempotency behaviour preserved.
   */

  const handlePlaceOrder = async () => {
    if (!user) {
      openAuth("login");
      return;
    }

    if (placingOrder) return;

    if (!items.length) {
      setError("Your cart is empty.");
      return;
    }

    if (unresolvedItems.length) {
      setError(
        "One or more products in your cart are no longer available."
      );
      return;
    }

    if (!user.phone?.trim()) {
      setError(
        "Your registered phone is missing. Update your profile before checkout."
      );
      return;
    }

    if (!pickupReady) {
      setError(
        pickupMode === "shared_campus"
          ? "Enter a valid campus meetup location for this order."
          : "Choose a pickup point for each seller."
      );
      return;
    }

    const token = localStorage.getItem("campusmart-token");

    if (!token) {
      setError("Your session has expired. Please sign in again.");
      return;
    }

    if (!canAfford) {
      setError(
        "Insufficient wallet balance. You must fund your wallet before checkout."
      );
      return;
    }

    if (!checkoutKey.current) {
      checkoutKey.current = crypto.randomUUID();
    }

    setPlacingOrder(true);
    setError("");

    try {
      const response = await fetch(`${API_URL}/api/orders`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          items: items.map((item) => ({
            productId: item.id,
            quantity: item.quantity,
            selectedSize: item.selectedSize ?? null,
            selectedColor: item.selectedColor ?? null,
          })),
          checkoutKey: checkoutKey.current,
          secondaryPhone: secondaryPhone.trim() || null,
          pickupMode,
          ...(pickupMode === "shared_campus"
            ? {
                campusMeetupLocation: campusLocation,
              }
            : {
                pickupSelections: sellerGroups.map((group) => ({
                  vendorId: group.vendorId,
                  pickupPointId: selectedPickup[group.vendorId],
                })),
              }),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        if (data.code === "INSUFFICIENT_FUNDS") {
          setWalletBalance(null);
        }

        throw new Error(
          data.message || "Unable to create your order."
        );
      }

      setCreatedOrder({
        id: data.order.id,
        subtotal: data.order.subtotal,
        fee: data.order.fee,
        total: data.order.total,
        status: data.order.status,
        paymentStatus: data.order.paymentStatus,
      });

      clearCart();
      checkoutKey.current = null;

      window.dispatchEvent(
        new CustomEvent("campusmart-toast", {
          detail: {
            message: "Order paid and placed successfully",
          },
        })
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Unable to place your order."
      );
    } finally {
      setPlacingOrder(false);
    }
  };

  /*
   * ORDER CONFIRMATION
   */

  if (createdOrder) {
    return (
      <PageShell
        title="Order received"
        description="Paid with CampusMart Wallet. Your order is awaiting seller confirmation."
      >
        <section className="site-card mx-auto max-w-xl p-6 sm:p-8">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-xl font-black text-emerald-700">
            ✓
          </span>

          <h2 className="mt-4 text-2xl font-black">
            Order placed
          </h2>

          <p className="mt-2 text-sm text-slate-600">
            Each seller has 24 hours to confirm. Once confirmed,
            handoff is expected on or before the third following
            calendar day, and it can happen earlier.
          </p>

          <div className="mt-5 space-y-3 rounded-xl bg-slate-50 p-4 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-slate-500">Reference</span>
              <span className="max-w-[65%] break-all text-right font-bold">
                {createdOrder.id}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-500">Status</span>
              <span className="font-bold capitalize">
                {createdOrder.status}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-500">Payment</span>
              <span className="font-bold capitalize text-emerald-700">
                {createdOrder.paymentStatus}
              </span>
            </div>

            <div className="flex justify-between border-t border-slate-200 pt-3">
              <span className="font-black">Total paid</span>
              <span className="text-lg font-black">
                {formatNaira(createdOrder.total)}
              </span>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Link
              href="/buyer/orders"
              className="flex min-h-11 items-center justify-center rounded-lg bg-slate-950 px-4 text-sm font-black text-white"
            >
              Track my orders
            </Link>

            <Link
              href="/marketplace"
              className="flex min-h-11 items-center justify-center rounded-lg bg-accent-400 px-4 text-sm font-black"
            >
              Continue shopping
            </Link>
          </div>
        </section>
      </PageShell>
    );
  }

  /*
   * EMPTY CART
   */

  if (!items.length && !metadataLoading) {
    return (
      <PageShell
        title="Checkout"
        description="Review your items, pickup arrangements and payment."
      >
        <section className="site-card mx-auto max-w-lg p-6 text-center">
          <h2 className="text-lg font-black">
            Your cart is empty
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Add something you like before checking out.
          </p>

          <Link
            href="/marketplace"
            className="mt-4 inline-flex rounded-lg bg-accent-400 px-5 py-3 text-sm font-black"
          >
            Browse marketplace
          </Link>
        </section>
      </PageShell>
    );
  }

  /*
   * CHECKOUT PAGE
   */

  return (
    <PageShell
      title="Checkout"
      description="Review your items, pickup arrangements and payment."
    >
      <div className="mx-auto max-w-3xl space-y-4">
        <section className="min-w-0 space-y-4">

          {/*
           * ==========================================
           * ITEMS IN YOUR ORDER
           *
           * Flat product list, not seller sections.
           * Each item shows its seller.
           * ==========================================
           */}

          <div className="site-card overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
              <div>
                <h2 className="text-sm font-black">
                  Items in your order
                </h2>

                <p className="mt-0.5 text-[11px] text-slate-500">
                  Review each product before placing your order.
                </p>
              </div>

              <span className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                {itemCount} {itemCount === 1 ? "item" : "items"}
              </span>
            </div>

            {metadataLoading ? (
              <p className="border-t border-slate-100 px-4 py-4 text-sm text-slate-500">
                Preparing checkout…
              </p>
            ) : resolvedItems.length === 0 ? (
              <p className="border-t border-slate-100 px-4 py-4 text-sm text-slate-500">
                Your cart is empty.
              </p>
            ) : (
              <>
                <div className="divide-y divide-slate-100 border-t border-slate-100">
                  {resolvedItems.map((item) => {
                    const variant = itemVariantLabel(
                      item as ResolvedCartItem
                    );

                    return (
                      <article
                        key={item.cartKey}
                        className="flex min-w-0 gap-3 p-3.5 sm:gap-4 sm:px-5 sm:py-4"
                      >
                        <div className="h-20 w-17 shrink-0 overflow-hidden rounded-xl bg-slate-100 sm:h-24 sm:w-20">
                          {item.image ? (
                            <img
                              src={item.image}
                              alt={item.title}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center px-1 text-center text-[9px] font-bold text-slate-400">
                              CampusMart
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                            <div className="min-w-0 flex-1">
                              <h3 className="line-clamp-2 text-sm font-black leading-5 text-slate-950">
                                {item.title}
                              </h3>

                              <p className="mt-1 break-words text-[11px] text-slate-500">
                                Sold by{" "}
                                <span className="font-bold text-[#4A1724]">
                                  {item.seller}
                                </span>
                              </p>

                              {variant ? (
                                <p className="mt-1 text-[11px] text-slate-500">
                                  {variant}
                                </p>
                              ) : null}
                            </div>

                            <span className="shrink-0 text-sm font-black tabular-nums text-slate-950">
                              {formatNaira(item.price * item.quantity)}
                            </span>
                          </div>

                          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                            <button
                              type="button"
                              disabled={placingOrder}
                              onClick={() => removeItem(item.cartKey)}
                              aria-label={`Remove ${item.title} from cart`}
                              className="text-[11px] font-bold text-red-600 hover:underline disabled:opacity-50"
                            >
                              Remove
                            </button>

                            <div
                              role="group"
                              aria-label={`Quantity for ${item.title}`}
                              className="inline-flex items-center overflow-hidden rounded-lg border border-slate-200 bg-white"
                            >
                              <button
                                type="button"
                                disabled={
                                  placingOrder || item.quantity <= 1
                                }
                                onClick={() =>
                                  changeQuantity(
                                    item.cartKey,
                                    item.quantity,
                                    -1
                                  )
                                }
                                aria-label={`Decrease quantity for ${item.title}`}
                                className="flex h-8 w-9 items-center justify-center text-base font-bold hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30"
                              >
                                -
                              </button>

                              <span className="min-w-7 text-center text-xs font-black tabular-nums">
                                {item.quantity}
                              </span>

                              <button
                                type="button"
                                disabled={
                                  placingOrder || item.quantity >= 99
                                }
                                onClick={() =>
                                  changeQuantity(
                                    item.cartKey,
                                    item.quantity,
                                    1
                                  )
                                }
                                aria-label={`Increase quantity for ${item.title}`}
                                className="flex h-8 w-9 items-center justify-center text-base font-bold hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/70 px-4 py-3 sm:px-5">
                  <div>
                    <p className="text-xs font-black text-slate-800">
                      Items subtotal
                    </p>

                    <p className="mt-0.5 text-[10px] text-slate-500">
                      Before CampusMart fee
                    </p>
                  </div>

                  <span className="text-base font-black tabular-nums">
                    {formatNaira(subtotal)}
                  </span>
                </div>
              </>
            )}
          </div>

          {/*
           * ==========================================
           * PICKUP ARRANGEMENTS
           *
           * Product titles are shown with their seller.
           * One pickup choice is retained per seller.
           * ==========================================
           */}

          <div className="site-card p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">
                  Pickup arrangements
                </p>

                <h2 className="mt-1 text-base font-black">
                  Where should you meet?
                </h2>

                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Choose how you would like to collect your items.
                </p>
              </div>

              <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                {sellerGroups.length}{" "}
                {sellerGroups.length === 1 ? "seller" : "sellers"}
              </span>
            </div>

            <div
              className="mt-4 grid grid-cols-2 gap-2"
              role="group"
              aria-label="Pickup method"
            >
              <button
                type="button"
                onClick={() => {
                  pickupModeChosen.current = true;
                  setPickupMode("shared_campus");
                  setError("");
                }}
                disabled={!sameUniversity || pickupLoading}
                aria-pressed={pickupMode === "shared_campus"}
                className={`rounded-lg border px-3 py-2.5 text-center text-xs font-black transition ${
                  pickupMode === "shared_campus"
                    ? "border-[#4A1724] bg-[#FBF6ED] text-[#4A1724]"
                    : "border-slate-200 bg-white text-slate-700"
                } disabled:cursor-not-allowed disabled:opacity-40`}
              >
                One campus meetup
              </button>

              <button
                type="button"
                onClick={() => {
                  pickupModeChosen.current = true;
                  setPickupMode("seller_points");
                  setError("");
                }}
                aria-pressed={pickupMode === "seller_points"}
                className={`rounded-lg border px-3 py-2.5 text-center text-xs font-black transition ${
                  pickupMode === "seller_points"
                    ? "border-[#4A1724] bg-[#FBF6ED] text-[#4A1724]"
                    : "border-slate-200 bg-white text-slate-700"
                }`}
              >
                Seller pickup points
              </button>
            </div>

            {!pickupLoading &&
            !sameUniversity &&
            sellerGroups.length > 0 ? (
              <p className="mt-2 text-[11px] leading-5 text-slate-500">
                One shared meetup is available when you and every
                seller attend the same university.
              </p>
            ) : null}

            {pickupLoading ? (
              <p className="mt-4 text-xs text-slate-500">
                Checking sellers&apos; pickup arrangements…
              </p>
            ) : pickupMode === "shared_campus" ? (
              <div className="mt-4 space-y-3">
                <div>
                  <label
                    className="block text-xs font-bold"
                    htmlFor="campus-meetup"
                  >
                    Where on campus?
                  </label>

                  <input
                    id="campus-meetup"
                    type="text"
                    value={campusMeetupLocation}
                    maxLength={120}
                    onChange={(event) =>
                      setCampusMeetupLocation(event.target.value)
                    }
                    placeholder="e.g. Computer Science Department, main entrance"
                    className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-[#4A1724] focus:outline-none"
                  />

                  <p className="mt-1.5 text-[11px] leading-5 text-slate-500">
                    This requests the same campus meeting place
                    from all {sellerGroups.length} sellers.
                    Each seller sees it before accepting and may decline.
                  </p>

                  {campusMeetupLocation &&
                  !campusLocationValid ? (
                    <p className="mt-1 text-xs text-red-700">
                      Use 5–120 characters, without links or phone numbers.
                    </p>
                  ) : null}
                </div>

                <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                  <p className="px-3 pt-3 text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
                    This meetup applies to
                  </p>

                  <div className="divide-y divide-slate-200">
                    {sellerGroups.map((group) => (
                      <div
                        key={group.vendorId}
                        className="px-3 py-2.5"
                      >
                        <p className="break-words text-xs font-bold text-slate-900">
                          {sellerProductLabel(group)}
                        </p>

                        <p className="mt-1 text-[11px] text-slate-500">
                          Seller: {group.seller}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <p className="text-[11px] leading-5 text-slate-500">
                  Each seller has their own pickup location.
                  Products from the same seller share one pickup choice.
                </p>

                {sellerGroups.map((group) => {
                  const options =
                    pickupOptions[group.vendorId] ?? [];

                  const productNames =
                    sellerProductLabel(group);

                  return (
                    <div
                      key={group.vendorId}
                      className="rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4"
                    >
                      <div className="min-w-0">
                        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                          Collect these items
                        </p>

                        <h3 className="mt-1 break-words text-sm font-black leading-5 text-slate-950">
                          {productNames}
                        </h3>

                        <p className="mt-1.5 break-words text-xs text-slate-600">
                          From{" "}
                          <span className="font-bold text-[#4A1724]">
                            {group.seller}
                          </span>
                        </p>
                      </div>

                      <div className="mt-3 border-t border-slate-100 pt-3">
                        {options.length ? (
                          <>
                            <label
                              htmlFor={`pickup-${group.vendorId}`}
                              className="mb-1.5 block text-[11px] font-bold text-slate-600"
                            >
                              Choose pickup location
                            </label>

                            <select
                              id={`pickup-${group.vendorId}`}
                              value={
                                selectedPickup[group.vendorId] ?? ""
                              }
                              onChange={(event) =>
                                setSelectedPickup((previous) => ({
                                  ...previous,
                                  [group.vendorId]:
                                    event.target.value,
                                }))
                              }
                              aria-label={`Pickup for ${productNames} from ${group.seller}`}
                              className="w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 focus:border-[#4A1724] focus:outline-none"
                            >
                              <option value="">
                                Choose pickup point
                              </option>

                              {options.map((point) => (
                                <option
                                  key={point.id}
                                  value={point.id}
                                >
                                  {pickupLabel(point)}
                                </option>
                              ))}
                            </select>
                          </>
                        ) : (
                          <p className="text-xs font-semibold text-amber-800">
                            No seller pickup points available
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {pickupError ? (
              <p className="mt-3 text-xs font-semibold text-red-700">
                {pickupError}
              </p>
            ) : null}
          </div>
        </section>

        {/*
         * ==========================================
         * REVIEW & PAY
         *
         * Existing wallet payment flow preserved.
         * ==========================================
         */}

        <aside className="site-card p-4 sm:p-5">
          <h2 className="text-sm font-black">
            Review &amp; pay
          </h2>

          <div className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-slate-500">
                Items
              </span>

              <span className="font-bold">
                {formatNaira(subtotal)}
              </span>
            </div>

            <div className="flex justify-between gap-3">
              <span className="text-slate-500">
                CampusMart fee
              </span>

              <span className="font-bold">
                {formatNaira(fee)}
              </span>
            </div>

            <div className="flex justify-between gap-3 border-t border-slate-200 pt-2.5">
              <span className="font-black">
                Total
              </span>

              <span className="text-base font-black">
                {formatNaira(total)}
              </span>
            </div>
          </div>

          {user ? (
            <div className="mt-4 border-t border-slate-100 pt-3">
              <h3 className="text-xs font-black">
                Contact for this order
              </h3>

              <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <div>
                  <p className="mb-1 text-[10px] font-bold text-slate-500">
                    Registered phone
                  </p>

                  <p className="flex min-h-10 items-center rounded-lg bg-slate-100 px-3 text-sm font-bold text-slate-500">
                    {displayPhone(user.phone) || "Missing phone"}
                  </p>
                </div>

                <label
                  className="block"
                  htmlFor="secondary-checkout-phone"
                >
                  <span className="mb-1 block text-[10px] font-bold text-slate-500">
                    Other phone{" "}
                    <span className="font-normal">
                      (optional)
                    </span>
                  </span>

                  <input
                    id="secondary-checkout-phone"
                    type="tel"
                    inputMode="tel"
                    maxLength={20}
                    autoComplete="off"
                    value={secondaryPhone}
                    onChange={(event) =>
                      setSecondaryPhone(event.target.value)
                    }
                    placeholder="Alternate contact"
                    className="min-h-10 w-full rounded-lg border border-slate-200 px-3 text-sm focus:border-[#4A1724] focus:outline-none"
                  />
                </label>
              </div>

              <p className="mt-1.5 text-[10px] text-slate-400">
                Contact is shared only after this seller confirms
                a paid order.
              </p>
            </div>
          ) : null}

          <div className="mt-4 border-t border-slate-100 pt-3">
            <h3 className="text-xs font-black">
              Pay via
            </h3>

            <div className="mt-2 rounded-xl border border-[#4A1724] bg-[#FBF6ED] p-3">
              <div className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-[5px] border-[#4A1724] bg-white"
                />

                <span className="min-w-0 flex-1 text-sm font-black">
                  CampusMart Wallet
                </span>

                <button
                  type="button"
                  onClick={() => setTopUpInfoOpen(true)}
                  className="shrink-0 rounded-lg border border-[#4A1724] bg-white px-2.5 py-1.5 text-xs font-black text-[#4A1724] hover:bg-slate-50"
                >
                  + Top up
                </button>
              </div>

              <div className="mt-2 flex items-center justify-between gap-3 border-t border-[#4A1724]/10 pt-2">
                <span className="text-xs text-slate-600">
                  Available balance
                </span>

                <span className="text-base font-black">
                  {walletLoading
                    ? "Checking…"
                    : walletBalance === null
                      ? "Unavailable"
                      : formatNaira(walletBalance)}
                </span>
              </div>
            </div>

            {walletUnavailable ? (
              <p className="mt-2 text-xs text-red-700">
                Wallet balance could not be verified.
                Payment is unavailable.
              </p>
            ) : walletBalance !== null &&
              walletBalance < total ? (
              <p className="mt-2 text-xs font-semibold text-red-700">
                Insufficient balance —{" "}
                {formatNaira(total - walletBalance)} more needed.
              </p>
            ) : null}

            <p className="mt-2 text-[11px] leading-4 text-slate-500">
              Only wallet payment is supported. Paid funds remain
              held until verified handoff.
            </p>
          </div>

          {error ? (
            <div
              role="alert"
              className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700"
            >
              {error}
            </div>
          ) : null}

          {!user ? (
            <button
              type="button"
              onClick={() => openAuth("login")}
              className="mt-4 w-full rounded-lg bg-accent-400 px-4 py-3 text-sm font-black"
            >
              Sign in to continue
            </button>
          ) : (
            <button
              type="button"
              disabled={
                placingOrder ||
                metadataLoading ||
                pickupLoading ||
                !!pickupError ||
                !items.length ||
                !!unresolvedItems.length ||
                !pickupReady ||
                !canAfford ||
                !user.phone
              }
              onClick={() => {
                void handlePlaceOrder();
              }}
              className="mt-4 w-full rounded-lg bg-accent-400 px-4 py-3 text-sm font-black disabled:cursor-not-allowed disabled:opacity-50"
            >
              {placingOrder
                ? "Placing order…"
                : "Pay from wallet & place order"}
            </button>
          )}

          <Link
            href="/cart"
            className="mt-2 flex w-full justify-center py-2 text-xs font-bold text-slate-500"
          >
            Back to cart
          </Link>
        </aside>
      </div>

      {/*
       * ==========================================
       * WALLET TOP-UP INFORMATION MODAL
       * ==========================================
       */}

      {topUpInfoOpen ? (
        <div
          role="presentation"
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setTopUpInfoOpen(false);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="topup-heading"
            className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl"
          >
            <h2
              id="topup-heading"
              className="text-lg font-black"
            >
              Top up your wallet
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              Wallet top-ups aren&apos;t available yet.
              We&apos;re integrating a verified payment provider
              before accepting real funds. No money has been charged.
            </p>

            <button
              type="button"
              autoFocus
              onClick={() => setTopUpInfoOpen(false)}
              className="mt-5 w-full rounded-lg bg-slate-950 px-4 py-3 text-sm font-black text-white"
            >
              Got it
            </button>
          </div>
        </div>
      ) : null}
    </PageShell>
  );
}
