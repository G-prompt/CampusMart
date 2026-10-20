"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";

import {
  useRouter,
} from "next/navigation";

import PageShell from "@/components/common/PageShell";
import { useOrderTimings, OrderDeadline } from "@/components/orders/OrderDeadline";

import {
  useAuth,
} from "@/components/common/AuthContext";

import {
  formatNaira,
} from "@/lib/products";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:5000";

const MESSAGE_MAX_LENGTH =
  2000;

type OrderStatus =
  | "pending"
  | "confirmed"
  | "completed"
  | "cancelled";

type PaymentStatus =
  | "pending"
  | "paid"
  | "failed"
  | "refunded"
  | string;

type OrderProduct = {
  id:
    number;

  slug:
    string;

  title:
    string;

  images:
    string[];
} | null;

type OrderVendorProfile = {
  businessName:
    string | null;

  pickupLocation:
    string | null;

  verified:
    boolean;
} | null;

type OrderVendor = {
  id:
    string;

  name:
    string;

  vendorProfile:
    OrderVendorProfile;
};

type OrderItem = {
  id:
    string;

  productId:
    number | null;

  vendorId:
    string;

  productTitle:
    string;

  unitPrice:
    number;

  quantity:
    number;

  lineTotal:
    number;

  selectedSize:
    | string
    | null;

  selectedColor:
    | string
    | null;

  status:
    OrderStatus;

  product:
    OrderProduct;

  vendor:
    OrderVendor;
};

type BuyerPickupSelection = {
  id:
    string;

  vendorId:
    string;

  pickupPointId:
    string | null;

  type:
    string;

  label:
    string;

  detail:
    string | null;
};

type BuyerOrder = {
  id:
    string;

  buyerId:
    string;

  subtotal:
    number;

  fee:
    number;

  total:
    number;

  pickupLocation:
    string | null;

  preferredSlot:
    string | null;

  status:
    OrderStatus;

  paymentStatus:
    PaymentStatus;

  createdAt:
    string;

  updatedAt:
    string;

  items:
    OrderItem[];

  vendorPickupSelections:
    BuyerPickupSelection[];
};

type VendorOrderGroup = {
  vendorId:
    string;

  sellerName:
    string;

  businessName:
    string;

  pickupLabel:
    string | null;

  pickupDetail:
    string | null;

  items:
    OrderItem[];

  subtotal:
    number;

  status:
    OrderStatus;
};

type FulfillmentPortion = {
  vendorId:
    string;

  sellerName:
    string;

  status:
    OrderStatus;

  code:
    string | null;

  codeAvailable:
    boolean;

  verified:
    boolean;
};

type FulfillmentLoadState = {
  loading:
    boolean;

  loaded:
    boolean;

  error:
    string;

  portions:
    FulfillmentPortion[];
};

type ExistingConversation = {
  id:
    string;

  contextType:
    | "general"
    | "listing"
    | "order";

  order:
    | {
        id:
          string;
      }
    | null;

  otherParty: {
    id:
      string;
  };
};

function shortOrderId(
  id:
    string
) {
  if (
    id.length <=
    10
  ) {
    return id.toUpperCase();
  }

  return id
    .slice(
      -8
    )
    .toUpperCase();
}

function formatDate(
  value:
    string
) {
  const date =
    new Date(
      value
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
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

      hour:
        "2-digit",

      minute:
        "2-digit",
    }
  );
}

function statusLabel(
  status:
    OrderStatus
) {
  switch (
    status
  ) {
    case "pending":
      return "Awaiting seller";

    case "confirmed":
      return "Confirmed";

    case "completed":
      return "Completed";

    case "cancelled":
      return "Cancelled";

    default:
      return status;
  }
}

function statusClasses(
  status:
    OrderStatus
) {
  switch (
    status
  ) {
    case "confirmed":
      return "border-blue-200 bg-blue-50 text-blue-700";

    case "completed":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";

    case "cancelled":
      return "border-red-200 bg-red-50 text-red-700";

    default:
      return "border-amber-200 bg-amber-50 text-amber-700";
  }
}

function paymentLabel(
  status:
    PaymentStatus
) {
  switch (
    status
  ) {
    case "paid":
      return "Paid";

    case "failed":
      return "Payment failed";

    case "refunded":
      return "Refunded";

    case "pending":
      return "Payment pending";

    default:
      return String(
        status
      ).replace(
        /_/g,
        " "
      );
  }
}

function calculateGroupStatus(
  items:
    OrderItem[]
): OrderStatus {
  if (
    items.length ===
    0
  ) {
    return "pending";
  }

  const statuses =
    items.map(
      (
        item
      ) =>
        item.status
    );

  if (
    statuses.every(
      (
        status
      ) =>
        status ===
        "cancelled"
    )
  ) {
    return "cancelled";
  }

  if (
    statuses.every(
      (
        status
      ) =>
        status ===
          "completed" ||
        status ===
          "cancelled"
    )
  ) {
    return "completed";
  }

  if (
    statuses.some(
      (
        status
      ) =>
        status ===
          "confirmed" ||
        status ===
          "completed"
    )
  ) {
    return "confirmed";
  }

  return "pending";
}

function groupOrderByVendor(
  order:
    BuyerOrder
): VendorOrderGroup[] {
  const groups =
    new Map<
      string,
      OrderItem[]
    >();

  for (
    const item of
    order.items
  ) {
    const current =
      groups.get(
        item.vendorId
      ) ??
      [];

    current.push(
      item
    );

    groups.set(
      item.vendorId,
      current
    );
  }

  return Array.from(
    groups.entries()
  ).map(
    (
      [
        vendorId,
        items,
      ]
    ) => {
      const firstItem =
        items[0];

      const sellerName =
        firstItem
          ?.vendor
          ?.name ||
        "CampusMart seller";

      const businessName =
        firstItem
          ?.vendor
          ?.vendorProfile
          ?.businessName ||
        sellerName;

      const pickupSnapshot =
        order
          .vendorPickupSelections
          ?.find(
            (
              selection
            ) =>
              selection.vendorId ===
              vendorId
          );

      const subtotal =
        items.reduce(
          (
            total,
            item
          ) =>
            total +
            item.lineTotal,
          0
        );

      return {
        vendorId,

        sellerName,

        businessName,

        pickupLabel:
          pickupSnapshot
            ?.label ??
          (
            groups.size ===
            1
              ? order.pickupLocation
              : null
          ),

        pickupDetail:
          pickupSnapshot
            ?.detail ??
          null,

        items,

        subtotal,

        status:
          calculateGroupStatus(
            items
          ),
      };
    }
  );
}

function pickupText(
  group:
    VendorOrderGroup
) {
  return [
    group.pickupLabel,
    group.pickupDetail,
  ]
    .filter(
      Boolean
    )
    .join(
      " - "
    ) ||
    "Pickup point unavailable";
}

function StatusBadge({
  status,
}: {
  status:
    OrderStatus;
}) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black ${statusClasses(
        status
      )}`}
    >
      {statusLabel(
        status
      )}
    </span>
  );
}

export default function Page() {
  const router =
    useRouter();

  const {
    user,
    openAuth,
  } =
    useAuth();

  const { timings, now } = useOrderTimings(user?.id);

  const [
    orders,
    setOrders,
  ] =
    useState<
      BuyerOrder[]
    >([]);

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
    refreshing,
    setRefreshing,
  ] =
    useState(
      false
    );

  const [
    expandedOrders,
    setExpandedOrders,
  ] =
    useState<
      Record<
        string,
        boolean
      >
    >({});

  const [
    fulfillmentByOrder,
    setFulfillmentByOrder,
  ] =
    useState<
      Record<
        string,
        FulfillmentLoadState
      >
    >({});

  const [
    messageComposerKey,
    setMessageComposerKey,
  ] =
    useState<
      string | null
    >(
      null
    );

  const [
    messageDrafts,
    setMessageDrafts,
  ] =
    useState<
      Record<
        string,
        string
      >
    >({});

  const [
    messageErrors,
    setMessageErrors,
  ] =
    useState<
      Record<
        string,
        string
      >
    >({});

  const [
    openingMessageKey,
    setOpeningMessageKey,
  ] =
    useState<
      string | null
    >(
      null
    );

  const [
    sendingMessageKey,
    setSendingMessageKey,
  ] =
    useState<
      string | null
    >(
      null
    );

  function getMessageKey(
    orderId:
      string,
    vendorId:
      string
  ) {
    return `${orderId}:${vendorId}`;
  }

  const loadFulfillmentCodes =
    useCallback(
      async (
        orderId:
          string
      ) => {
        if (
          !user
        ) {
          return;
        }

        const token =
          localStorage.getItem(
            "campusmart-token"
          );

        if (
          !token
        ) {
          return;
        }

        setFulfillmentByOrder(
          (
            current
          ) => ({
            ...current,

            [orderId]: {
              loading:
                true,

              loaded:
                false,

              error:
                "",

              portions:
                [],
            },
          })
        );

        try {
          const response =
            await fetch(
              `${API_URL}/api/orders/${orderId}/fulfillment-codes`,
              {
                headers: {
                  Authorization:
                    `Bearer ${token}`,
                },

                cache:
                  "no-store",
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
                "Unable to load fulfilment information."
            );
          }

          setFulfillmentByOrder(
            (
              current
            ) => ({
              ...current,

              [orderId]: {
                loading:
                  false,

                loaded:
                  true,

                error:
                  "",

                portions:
                  Array.isArray(
                    data.portions
                  )
                    ? data.portions
                    : [],
              },
            })
          );
        } catch (
          fulfillmentError
        ) {
          setFulfillmentByOrder(
            (
              current
            ) => ({
              ...current,

              [orderId]: {
                loading:
                  false,

                loaded:
                  true,

                error:
                  fulfillmentError instanceof
                    Error
                    ? fulfillmentError.message
                    : "Unable to load fulfilment information.",

                portions:
                  [],
              },
            })
          );
        }
      },
      [
        user,
      ]
    );

  const loadOrders =
    useCallback(
      async (
        refresh =
          false
      ) => {
        if (
          !user
        ) {
          setOrders(
            []
          );

          setLoading(
            false
          );

          return;
        }

        const token =
          localStorage.getItem(
            "campusmart-token"
          );

        if (
          !token
        ) {
          setError(
            "Your session has expired. Sign in again."
          );

          setLoading(
            false
          );

          return;
        }

        try {
          refresh
            ? setRefreshing(
                true
              )
            : setLoading(
                true
              );

          setError(
            ""
          );

          const response =
            await fetch(
              `${API_URL}/api/orders/mine`,
              {
                headers: {
                  Authorization:
                    `Bearer ${token}`,
                },

                cache:
                  "no-store",
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
                "Unable to load your orders."
            );
          }

          setOrders(
            Array.isArray(
              data.orders
            )
              ? data.orders
              : []
          );
        } catch (
          orderError
        ) {
          setError(
            orderError instanceof
              Error
              ? orderError.message
              : "Unable to load your orders."
          );
        } finally {
          setLoading(
            false
          );

          setRefreshing(
            false
          );
        }
      },
      [
        user,
      ]
    );

  useEffect(() => {
    void loadOrders();
  }, [
    loadOrders,
  ]);

  const toggleOrder =
    (
      orderId:
        string
    ) => {
      const opening =
        !expandedOrders[
          orderId
        ];

      setExpandedOrders(
        (
          current
        ) => ({
          ...current,

          [orderId]:
            opening,
        })
      );

      if (
        opening &&
        !fulfillmentByOrder[
          orderId
        ]
      ) {
        void loadFulfillmentCodes(
          orderId
        );
      }
    };

  const refreshPage =
    async () => {
      await loadOrders(true);

      const expandedIds =
        Object.entries(
          expandedOrders
        )
          .filter(
            (
              [
                ,
                value,
              ]
            ) =>
              value
          )
          .map(
            (
              [
                orderId,
              ]
            ) =>
              orderId
          );

      await Promise.allSettled(
        expandedIds.map(
          (
            orderId
          ) =>
            loadFulfillmentCodes(
              orderId
            )
        )
      );
    };

  const handleMessageSeller =
    async (
      order:
        BuyerOrder,
      group:
        VendorOrderGroup
    ) => {
      if (
        !user
      ) {
        openAuth(
          "login",
          "client"
        );

        return;
      }

      const key =
        getMessageKey(
          order.id,
          group.vendorId
        );

      const token =
        localStorage.getItem(
          "campusmart-token"
        );

      if (
        !token
      ) {
        return;
      }

      try {
        setOpeningMessageKey(
          key
        );

        const response =
          await fetch(
            `${API_URL}/api/messages/conversations`,
            {
              headers: {
                Authorization:
                  `Bearer ${token}`,
              },

              cache:
                "no-store",
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
              "Unable to open messaging."
          );
        }

        const conversations:
          ExistingConversation[] =
          Array.isArray(
            data.conversations
          )
            ? data.conversations
            : [];

        const existing =
          conversations.find(
            (
              conversation
            ) =>
              conversation.contextType ===
                "order" &&
              conversation.order
                ?.id ===
                order.id &&
              conversation.otherParty
                ?.id ===
                group.vendorId
          );

        if (
          existing
        ) {
          router.push(
            `/messages/${existing.id}`
          );

          return;
        }

        setMessageComposerKey(
          key
        );
      } catch (
        messagingError
      ) {
        setMessageErrors(
          (
            current
          ) => ({
            ...current,

            [key]:
              messagingError instanceof
                Error
                ? messagingError.message
                : "Unable to open messaging.",
          })
        );
      } finally {
        setOpeningMessageKey(
          null
        );
      }
    };

  const startOrderConversation =
    async (
      event:
        FormEvent<HTMLFormElement>,
      order:
        BuyerOrder,
      group:
        VendorOrderGroup
    ) => {
      event.preventDefault();

      const key =
        getMessageKey(
          order.id,
          group.vendorId
        );

      const body =
        (
          messageDrafts[
            key
          ] ??
          ""
        ).trim();

      if (
        !body
      ) {
        return;
      }

      const token =
        localStorage.getItem(
          "campusmart-token"
        );

      if (
        !token
      ) {
        return;
      }

      try {
        setSendingMessageKey(
          key
        );

        const response =
          await fetch(
            `${API_URL}/api/messages/conversations`,
            {
              method:
                "POST",

              headers: {
                "Content-Type":
                  "application/json",

                Authorization:
                  `Bearer ${token}`,
              },

              body:
                JSON.stringify({
                  contextType:
                    "order",

                  orderId:
                    order.id,

                  vendorId:
                    group.vendorId,

                  body,
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
              "Unable to send your message."
          );
        }

        router.push(
          `/messages/${data.conversation.id}`
        );
      } catch (
        messagingError
      ) {
        setMessageErrors(
          (
            current
          ) => ({
            ...current,

            [key]:
              messagingError instanceof
                Error
                ? messagingError.message
                : "Unable to send your message.",
          })
        );
      } finally {
        setSendingMessageKey(
          null
        );
      }
    };

  const summary =
    useMemo(
      () => {
        const activeOrders =
          orders.filter(
            (
              order
            ) =>
              order.status ===
                "pending" ||
              order.status ===
                "confirmed"
          ).length;

        const completedOrders =
          orders.filter(
            (
              order
            ) =>
              order.status ===
              "completed"
          ).length;

        const totalSpent =
          orders
            .filter(
              (
                order
              ) =>
                order.paymentStatus ===
                "paid"
            )
            .reduce(
              (
                total,
                order
              ) =>
                total +
                order.total,
              0
            );

        return {
          activeOrders,
          completedOrders,
          totalSpent,
        };
      },
      [
        orders,
      ]
    );

  if (
    !user
  ) {
    return (
      <PageShell
        title="Your orders"
        description="Track purchases and seller fulfilment."
      >
        <section className="site-card mx-auto max-w-xl p-8 text-center">
          <h2 className="text-2xl font-black">
            Sign in to view your orders
          </h2>

          <button
            type="button"
            onClick={() =>
              openAuth(
                "login",
                "client"
              )
            }
            className="mt-6 rounded-xl bg-accent-400 px-5 py-3 text-sm font-black"
          >
            Sign in
          </button>
        </section>
      </PageShell>
    );
  }

  if (
    loading
  ) {
    return (
      <PageShell
        title="Your orders"
        description="Track purchases and seller fulfilment."
      >
        <div className="space-y-3">
          <div className="site-card h-32 animate-pulse bg-slate-100" />
          <div className="site-card h-32 animate-pulse bg-slate-100" />
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Your orders"
      description="Track seller responses and handoffs."
    >
      <div className="flex items-center justify-between gap-3">
        <p className="truncate text-sm text-slate-600">
          Signed in as{" "}
          <strong className="text-slate-950">
            {
              user.name
            }
          </strong>
        </p>

        <button
          type="button"
          disabled={
            refreshing
          }
          onClick={() =>
            void refreshPage()
          }
          className="shrink-0 rounded-lg border border-slate-200 px-3 py-2 text-xs font-black"
        >
          {refreshing
            ? "Refreshing..."
            : "Refresh"}
        </button>
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
          {
            error
          }
        </div>
      ) : null}

      {orders.length ===
      0 ? (
        <section className="site-card mt-5 p-10 text-center">
          <h2 className="text-xl font-black">
            No orders yet
          </h2>

          <Link
            href="/marketplace"
            className="mt-5 inline-flex rounded-lg bg-accent-400 px-5 py-3 text-sm font-black"
          >
            Browse marketplace
          </Link>
        </section>
      ) : (
        <>
          <section className="site-card mt-4 overflow-hidden">
            <div className="grid grid-cols-3 divide-x divide-slate-200">
              <div className="p-3 sm:p-4">
                <p className="text-[9px] font-black uppercase text-slate-400">
                  Active
                </p>

                <p className="mt-1 text-xl font-black">
                  {
                    summary.activeOrders
                  }
                </p>
              </div>

              <div className="p-3 sm:p-4">
                <p className="text-[9px] font-black uppercase text-slate-400">
                  Completed
                </p>

                <p className="mt-1 text-xl font-black">
                  {
                    summary.completedOrders
                  }
                </p>
              </div>

              <div className="p-3 sm:p-4">
                <p className="text-[9px] font-black uppercase text-slate-400">
                  Paid spend
                </p>

                <p className="mt-1 truncate text-sm font-black sm:text-lg">
                  {formatNaira(
                    summary.totalSpent
                  )}
                </p>
              </div>
            </div>
          </section>

          <section className="mt-4 space-y-3">
            {orders.map(
              (
                order
              ) => {
                const vendorGroups =
                  groupOrderByVendor(
                    order
                  );

                const expanded =
                  Boolean(
                    expandedOrders[
                      order.id
                    ]
                  );

                const fulfillmentState =
                  fulfillmentByOrder[
                    order.id
                  ];

                return (
                  <article
                    key={
                      order.id
                    }
                    className="site-card overflow-hidden"
                  >
                    <div className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="font-black">
                              Order #
                              {shortOrderId(
                                order.id
                              )}
                            </h2>

                            <StatusBadge
                              status={
                                order.status
                              }
                            />
                          </div>

                          <p className="mt-1 text-xs text-slate-500">
                            {formatDate(
                              order.createdAt
                            )}
                            {" - "}
                            {
                              vendorGroups.length
                            }{" "}
                            {vendorGroups.length ===
                            1
                              ? "seller"
                              : "sellers"}
                            {" - "}
                            {
                              order.items.length
                            }{" "}
                            {order.items.length ===
                            1
                              ? "item"
                              : "items"}
                          </p>
                        </div>

                        <div className="shrink-0 text-right">
                          <p className="text-sm font-black">
                            {formatNaira(
                              order.total
                            )}
                          </p>

                          <button
                            type="button"
                            onClick={() =>
                              toggleOrder(
                                order.id
                              )
                            }
                            className="mt-2 rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-black"
                          >
                            {expanded
                              ? "Hide"
                              : "Details"}
                          </button>
                        </div>
                      </div>
                    </div>

                    {expanded ? (
                      <div className="border-t border-slate-200">
                        <div className="grid grid-cols-2 gap-px bg-slate-200">
                          <div className="bg-slate-50 p-3">
                            <p className="text-[9px] font-black uppercase text-slate-400">
                              Payment
                            </p>

                            <p className="mt-1 text-xs font-black sm:text-sm">
                              {paymentLabel(
                                order.paymentStatus
                              )}
                            </p>
                          </div>

                          <div className="bg-slate-50 p-3">
                            <p className="text-[9px] font-black uppercase text-slate-400">
                              Sellers
                            </p>

                            <p className="mt-1 text-xs font-black sm:text-sm">
                              {
                                vendorGroups.length
                              }
                            </p>
                          </div>

                        </div>

                        <div className="space-y-3 p-4">
                          {vendorGroups.map(
                            (
                              group
                            ) => {
                              const fulfillmentPortion =
                                fulfillmentState
                                  ?.portions
                                  ?.find(
                                    (
                                      portion
                                    ) =>
                                      portion.vendorId ===
                                      group.vendorId
                                  );

                              const secureStatus =
                                fulfillmentPortion
                                  ?.status ??
                                group.status;

                              const messageKey =
                                getMessageKey(
                                  order.id,
                                  group.vendorId
                                );

                              const messageComposerOpen =
                                messageComposerKey ===
                                messageKey;

                              const messageDraft =
                                messageDrafts[
                                  messageKey
                                ] ??
                                "";

                              const messageError =
                                messageErrors[
                                  messageKey
                                ] ??
                                "";

                              const openingMessage =
                                openingMessageKey ===
                                messageKey;

                              const sendingMessage =
                                sendingMessageKey ===
                                messageKey;

                              return (
                                <section
                                  key={
                                    group.vendorId
                                  }
                                  className="overflow-hidden rounded-xl border border-slate-200"
                                >
                                  <div className="p-4">
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <Link
                                            href={`/seller/${group.vendorId}`}
                                            className="truncate font-black hover:underline"
                                          >
                                            {
                                              group.businessName
                                            }
                                          </Link>

                                          <StatusBadge status={secureStatus}/>
                                          {secureStatus === "confirmed" && timings[`${order.id}:${group.vendorId}`]?.readyAt ?
                                            <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-black text-emerald-700">Ready for pickup</span> : null}
                                        </div>

                                        <p className="mt-1 text-xs text-slate-500">
                                          {group.items.length}{" "}
                                          {group.items.length ===
                                          1
                                            ? "item"
                                            : "items"}
                                          {" - "}
                                          {formatNaira(
                                            group.subtotal
                                          )}
                                        </p>

                                        <div className="mt-2 text-xs">
                                          <OrderDeadline
                                            timing={timings[`${order.id}:${group.vendorId}`]}
                                            status={secureStatus} now={now} perspective="buyer"/>
                                        </div>
                                        <div className="mt-2 flex items-start gap-1.5 text-xs">
                                          <span className="shrink-0 font-black text-[#6E3847]">
                                            Pickup:
                                          </span>

                                          <span className="font-semibold text-slate-700">
                                            {pickupText(
                                              group
                                            )}
                                          </span>
                                        </div>
                                      </div>

                                      <button
                                        type="button"
                                        disabled={
                                          openingMessage ||
                                          sendingMessage
                                        }
                                        onClick={() =>
                                          void handleMessageSeller(
                                            order,
                                            group
                                          )
                                        }
                                        className="shrink-0 rounded-lg border border-slate-200 px-3 py-2 text-[10px] font-black"
                                      >
                                        {openingMessage
                                          ? "Opening..."
                                          : "Message"}
                                      </button>
                                    </div>
                                  </div>

                                  {messageComposerOpen ? (
                                    <form
                                      onSubmit={(
                                        event
                                      ) =>
                                        void startOrderConversation(
                                          event,
                                          order,
                                          group
                                        )
                                      }
                                      className="border-t border-slate-200 bg-slate-50 p-3"
                                    >
                                      <textarea
                                        rows={
                                          3
                                        }
                                        maxLength={
                                          MESSAGE_MAX_LENGTH
                                        }
                                        value={
                                          messageDraft
                                        }
                                        onChange={(
                                          event
                                        ) =>
                                          setMessageDrafts(
                                            (
                                              current
                                            ) => ({
                                              ...current,

                                              [messageKey]:
                                                event.target.value,
                                            })
                                          )
                                        }
                                        className="w-full rounded-lg border border-slate-200 bg-white p-3 text-sm"
                                        placeholder="Write a message about this order..."
                                      />

                                      {messageError ? (
                                        <p className="mt-2 text-xs font-bold text-red-600">
                                          {
                                            messageError
                                          }
                                        </p>
                                      ) : null}

                                      <div className="mt-2 flex gap-2">
                                        <button
                                          type="submit"
                                          disabled={
                                            sendingMessage ||
                                            !messageDraft.trim()
                                          }
                                          className="rounded-lg bg-slate-950 px-4 py-2 text-xs font-black text-white"
                                        >
                                          Send
                                        </button>

                                        <button
                                          type="button"
                                          onClick={() =>
                                            setMessageComposerKey(
                                              null
                                            )
                                          }
                                          className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-black"
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    </form>
                                  ) : null}

                                  <div className="border-t border-slate-200 bg-slate-50 px-4 py-3">
                                    {fulfillmentState
                                      ?.loading ? (
                                      <p className="text-xs font-semibold text-slate-500">
                                        Loading handoff details...
                                      </p>
                                    ) : secureStatus ===
                                        "pending" ? (
                                      <p className="text-xs font-bold text-amber-700">
                                        Waiting for this seller to confirm.
                                      </p>
                                    ) : secureStatus ===
                                        "confirmed" &&
                                      fulfillmentPortion
                                        ?.codeAvailable &&
                                      fulfillmentPortion
                                        ?.code ? (
                                      <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div>
                                          <p className="text-[9px] font-black uppercase text-emerald-700">
                                            Handoff code
                                          </p>

                                          <p className="mt-1 font-mono text-xl font-black tracking-[0.25em]">
                                            {
                                              fulfillmentPortion.code
                                            }
                                          </p>
                                        </div>

                                        <p className="max-w-xs text-[10px] leading-5 text-amber-800">
                                          Give this code only after receiving and checking your items.
                                        </p>
                                      </div>
                                    ) : secureStatus ===
                                        "completed" ||
                                      fulfillmentPortion
                                        ?.verified ? (
                                      <p className="text-xs font-black text-emerald-700">
                                        Handoff completed
                                      </p>
                                    ) : secureStatus ===
                                      "cancelled" ? (
                                      <p className="text-xs font-black text-red-600">
                                        Seller portion cancelled
                                      </p>
                                    ) : null}
                                  </div>

                                  <div className="divide-y divide-slate-100 border-t border-slate-200">
                                    {group.items.map(
                                      (
                                        item
                                      ) => (
                                        <div
                                          key={
                                            item.id
                                          }
                                          className="flex gap-3 p-3"
                                        >
                                          {item.product
                                            ?.images
                                            ?.[0] ? (
                                            <img
                                              src={
                                                item
                                                  .product
                                                  .images[0]
                                              }
                                              alt={
                                                item.productTitle
                                              }
                                              className="h-16 w-14 shrink-0 rounded-lg object-cover"
                                            />
                                          ) : (
                                            <div className="flex h-16 w-14 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-[9px] font-black text-white">
                                              CM
                                            </div>
                                          )}

                                          <div className="min-w-0 flex-1">
                                            <p className="line-clamp-2 text-sm font-black">
                                              {
                                                item.productTitle
                                              }
                                            </p>

                                            <p className="mt-1 text-xs text-slate-500">
                                              {
                                                item.quantity
                                              }{" "}
                                              x{" "}
                                              {formatNaira(
                                                item.unitPrice
                                              )}
                                            </p>

                                            {item.selectedSize ||
                                            item.selectedColor ? (
                                              <div className="mt-1.5 flex flex-wrap gap-1">
                                                {item.selectedSize ? (
                                                  <span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-black">
                                                    Size{" "}
                                                    {
                                                      item.selectedSize
                                                    }
                                                  </span>
                                                ) : null}

                                                {item.selectedColor ? (
                                                  <span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-black">
                                                    {
                                                      item.selectedColor
                                                    }
                                                  </span>
                                                ) : null}
                                              </div>
                                            ) : null}
                                          </div>

                                          <p className="shrink-0 text-sm font-black">
                                            {formatNaira(
                                              item.lineTotal
                                            )}
                                          </p>
                                        </div>
                                      )
                                    )}
                                  </div>
                                </section>
                              );
                            }
                          )}
                        </div>

                        <div className="border-t border-slate-200 bg-slate-50 px-4 py-3">
                          <div className="ml-auto max-w-sm space-y-1.5 text-xs">
                            <div className="flex justify-between">
                              <span className="text-slate-500">
                                Subtotal
                              </span>

                              <strong>
                                {formatNaira(
                                  order.subtotal
                                )}
                              </strong>
                            </div>

                            <div className="flex justify-between">
                              <span className="text-slate-500">
                                CampusMart fee
                              </span>

                              <strong>
                                {formatNaira(
                                  order.fee
                                )}
                              </strong>
                            </div>

                            <div className="flex justify-between border-t border-slate-200 pt-2 text-sm">
                              <strong>
                                Total
                              </strong>

                              <strong>
                                {formatNaira(
                                  order.total
                                )}
                              </strong>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </article>
                );
              }
            )}
          </section>
        </>
      )}
    </PageShell>
  );
}