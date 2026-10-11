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

import {
  useAuth,
} from "@/components/common/AuthContext";

import {
  formatNaira,
} from "@/lib/products";

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
  id: number;

  slug: string;

  title: string;

  images: string[];
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
  id: string;

  name: string;

  vendorProfile:
    OrderVendorProfile;
};

type OrderItem = {
  id: string;

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

  status:
    OrderStatus;

  product:
    OrderProduct;

  vendor:
    OrderVendor;
};

type BuyerOrder = {
  id: string;

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
};

type OrdersResponse = {
  success:
    boolean;

  orders?:
    BuyerOrder[];

  count?:
    number;

  message?:
    string;
};

type VendorOrderGroup = {
  vendorId:
    string;

  sellerName:
    string;

  businessName:
    string;

  pickupLocation:
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

type FulfillmentCodesResponse = {
  success:
    boolean;

  orderId?:
    string;

  portions?:
    FulfillmentPortion[];

  message?:
    string;
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
        id: string;
      }
    | null;

  otherParty: {
    id: string;
  };
};

function formatDate(
  value: string
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

function shortOrderId(
  id: string
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

    case "pending":
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

      const pickupLocation =
        firstItem
          ?.vendor
          ?.vendorProfile
          ?.pickupLocation ||
        null;

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

        pickupLocation,

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

function StatusBadge({
  status,
}: {
  status:
    OrderStatus;
}) {
  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${statusClasses(
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

  const [
    orders,
    setOrders,
  ] =
    useState<
      BuyerOrder[]
    >(
      []
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

  /*
   * =====================================================
   * ORDER MESSAGING
   * =====================================================
   */

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

  const apiUrl =
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:5000";

  function getMessageKey(
    orderId:
      string,
    vendorId:
      string
  ) {
    return `${orderId}:${vendorId}`;
  }

  /*
   * =====================================================
   * LOAD FULFILMENT CODES
   * =====================================================
   */

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
          window.localStorage.getItem(
            "campusmart-token"
          );

        if (
          !token
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
                  "Your session has expired.",

                portions:
                  [],
              },
            })
          );

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
              `${apiUrl}/api/orders/${orderId}/fulfillment-codes`,
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
            await response.json() as
              FulfillmentCodesResponse;

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
          console.error(
            "Buyer fulfilment code error:",
            fulfillmentError
          );

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
        apiUrl,
        user,
      ]
    );

  /*
   * =====================================================
   * LOAD ORDERS
   * =====================================================
   */

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
          window.localStorage.getItem(
            "campusmart-token"
          );

        if (
          !token
        ) {
          setOrders(
            []
          );

          setError(
            "Your session has expired. Sign in again to view your orders."
          );

          setLoading(
            false
          );

          return;
        }

        try {
          if (
            refresh
          ) {
            setRefreshing(
              true
            );
          } else {
            setLoading(
              true
            );
          }

          setError(
            ""
          );

          const response =
            await fetch(
              `${apiUrl}/api/orders/mine`,
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
            await response.json() as
              OrdersResponse;

          if (
            !response.ok ||
            !data.success
          ) {
            throw new Error(
              data.message ||
                "Unable to load your orders."
            );
          }

          const nextOrders =
            Array.isArray(
              data.orders
            )
              ? data.orders
              : [];

          setOrders(
            nextOrders
          );

          setExpandedOrders(
            (
              current
            ) => {
              if (
                Object.keys(
                  current
                ).length >
                0
              ) {
                return current;
              }

              const firstOrder =
                nextOrders[0];

              if (
                !firstOrder
              ) {
                return {};
              }

              return {
                [firstOrder.id]:
                  true,
              };
            }
          );
        } catch (
          orderError
        ) {
          console.error(
            "Buyer orders error:",
            orderError
          );

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
        apiUrl,
        user,
      ]
    );

  useEffect(() => {
    void loadOrders();
  }, [
    loadOrders,
  ]);

  /*
   * =====================================================
   * LOAD CODES FOR EXPANDED ORDERS
   * =====================================================
   */

  useEffect(() => {
    for (
      const [
        orderId,
        expanded,
      ] of
      Object.entries(
        expandedOrders
      )
    ) {
      if (
        !expanded
      ) {
        continue;
      }

      const current =
        fulfillmentByOrder[
          orderId
        ];

      if (
        !current
      ) {
        void loadFulfillmentCodes(
          orderId
        );
      }
    }
  }, [
    expandedOrders,
    fulfillmentByOrder,
    loadFulfillmentCodes,
  ]);

  /*
   * =====================================================
   * TOGGLE ORDER
   * =====================================================
   */

  const toggleOrder =
    (
      orderId:
        string
    ) => {
      const currentlyExpanded =
        Boolean(
          expandedOrders[
            orderId
          ]
        );

      setExpandedOrders(
        (
          current
        ) => ({
          ...current,

          [orderId]:
            !currentlyExpanded,
        })
      );

      if (
        currentlyExpanded
      ) {
        return;
      }

      void loadFulfillmentCodes(
        orderId
      );
    };

  /*
   * =====================================================
   * REFRESH PAGE
   * =====================================================
   */

  const refreshPage =
    async () => {
      await loadOrders(
        true
      );

      const expandedIds =
        Object.entries(
          expandedOrders
        )
          .filter(
            (
              [
                ,
                expanded,
              ]
            ) =>
              expanded
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

  /*
   * =====================================================
   * OPEN ORDER CONVERSATION
   * =====================================================
   */

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
        window.localStorage.getItem(
          "campusmart-token"
        );

      if (
        !token
      ) {
        setMessageErrors(
          (
            current
          ) => ({
            ...current,

            [key]:
              "Your session is unavailable. Sign in again to message this seller.",
          })
        );

        return;
      }

      try {
        setOpeningMessageKey(
          key
        );

        setMessageErrors(
          (
            current
          ) => ({
            ...current,

            [key]:
              "",
          })
        );

        /*
         * Search for this exact canonical order thread:
         *
         * order + seller.
         *
         * This is important for multi-vendor orders.
         */

        const response =
          await fetch(
            `${apiUrl}/api/messages/conversations`,
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

        const existingConversation =
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
          existingConversation
        ) {
          router.push(
            `/messages/${existingConversation.id}`
          );

          return;
        }

        /*
         * No thread exists yet.
         *
         * Opening the composer alone must not create an
         * empty Conversation record.
         */

        setMessageComposerKey(
          key
        );
      } catch (
        messagingError
      ) {
        console.error(
          "Open order conversation error:",
          messagingError
        );

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

  /*
   * =====================================================
   * START ORDER CONVERSATION
   * =====================================================
   */

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

      if (
        !user
      ) {
        return;
      }

      const key =
        getMessageKey(
          order.id,
          group.vendorId
        );

      if (
        sendingMessageKey
      ) {
        return;
      }

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
        setMessageErrors(
          (
            current
          ) => ({
            ...current,

            [key]:
              "Write a message to the seller first.",
          })
        );

        return;
      }

      if (
        body.length >
        MESSAGE_MAX_LENGTH
      ) {
        setMessageErrors(
          (
            current
          ) => ({
            ...current,

            [key]:
              `Messages can be up to ${MESSAGE_MAX_LENGTH} characters.`,
          })
        );

        return;
      }

      const token =
        window.localStorage.getItem(
          "campusmart-token"
        );

      if (
        !token
      ) {
        setMessageErrors(
          (
            current
          ) => ({
            ...current,

            [key]:
              "Your session is unavailable. Sign in again to message this seller.",
          })
        );

        return;
      }

      try {
        setSendingMessageKey(
          key
        );

        setMessageErrors(
          (
            current
          ) => ({
            ...current,

            [key]:
              "",
          })
        );

        const response =
          await fetch(
            `${apiUrl}/api/messages/conversations`,
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
          if (
            data.code ===
            "MESSAGING_TEMPORARILY_RESTRICTED"
          ) {
            throw new Error(
              data.message ||
                "Messaging is temporarily restricted. You can still read your existing conversations."
            );
          }

          if (
            data.code ===
              "OFF_PLATFORM_ATTEMPT_BLOCKED" ||
            data.moderation
              ?.action ===
              "blocked"
          ) {
            throw new Error(
              data.message ||
                "That message was not sent because it appears to move the conversation off CampusMart."
            );
          }

          throw new Error(
            data.message ||
              "Unable to send your message."
          );
        }

        const conversationId =
          data.conversation
            ?.id;

        if (
          !conversationId
        ) {
          throw new Error(
            "The conversation was created, but CampusMart could not open it."
          );
        }

        if (
          data.moderation
            ?.action ===
          "redacted"
        ) {
          window.dispatchEvent(
            new CustomEvent(
              "campusmart-toast",
              {
                detail: {
                  message:
                    "Message sent. Contact details were hidden to keep the conversation on CampusMart.",
                },
              }
            )
          );
        } else {
          window.dispatchEvent(
            new CustomEvent(
              "campusmart-toast",
              {
                detail: {
                  message:
                    "Message sent",
                },
              }
            )
          );
        }

        setMessageDrafts(
          (
            current
          ) => ({
            ...current,

            [key]:
              "",
          })
        );

        setMessageComposerKey(
          null
        );

        router.push(
          `/messages/${conversationId}`
        );
      } catch (
        messagingError
      ) {
        console.error(
          "Start order conversation error:",
          messagingError
        );

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

  /*
   * =====================================================
   * SUMMARY
   * =====================================================
   */

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

  /*
   * =====================================================
   * NOT SIGNED IN
   * =====================================================
   */

  if (
    !user
  ) {
    return (
      <PageShell
        title="Your orders"
        description="Track purchases and seller fulfilment in one place."
      >
        <section className="site-card mx-auto max-w-xl p-8 text-center sm:p-10">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-950 text-sm font-black text-white">
            CM
          </div>

          <h1 className="mt-5 text-2xl font-bold text-slate-950">
            Sign in to view
            your orders
          </h1>

          <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-slate-600">
            Your CampusMart
            purchases and
            fulfilment updates
            will appear here.
          </p>

          <button
            type="button"
            onClick={() =>
              openAuth(
                "login",
                "client"
              )
            }
            className="mt-6 rounded-[10px] bg-accent-400 px-5 py-3 text-sm font-bold text-black transition hover:bg-accent-500"
          >
            Sign in
          </button>
        </section>
      </PageShell>
    );
  }

  /*
   * =====================================================
   * LOADING
   * =====================================================
   */

  if (
    loading
  ) {
    return (
      <PageShell
        title="Your orders"
        description="Track purchases and seller fulfilment in one place."
      >
        <div className="space-y-4">
          {[
            1,
            2,
            3,
          ].map(
            (
              item
            ) => (
              <div
                key={
                  item
                }
                className="site-card h-48 animate-pulse bg-slate-100"
              />
            )
          )}
        </div>
      </PageShell>
    );
  }

  /*
   * =====================================================
   * PAGE
   * =====================================================
   */

  return (
    <PageShell
      title="Your orders"
      description="Track purchases, sellers and fulfilment status."
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-slate-600">
          Signed in as{" "}
          <span className="font-bold text-slate-950">
            {
              user.name
            }
          </span>
        </p>

        <button
          type="button"
          disabled={
            refreshing
          }
          onClick={() =>
            void refreshPage()
          }
          className="rounded-[10px] border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {refreshing
            ? "Refreshing..."
            : "Refresh orders"}
        </button>
      </div>

      {error ? (
        <div
          role="alert"
          className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700"
        >
          {
            error
          }
        </div>
      ) : null}

      {orders.length ===
      0 ? (
        <section className="site-card mt-6 p-8 text-center sm:p-10">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-950 text-sm font-black text-white">
            CM
          </div>

          <h2 className="mt-5 text-2xl font-bold text-slate-950">
            No orders yet
          </h2>

          <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-slate-600">
            When you place an
            order on CampusMart,
            you&apos;ll be able to
            track each seller&apos;s
            part of the order here.
          </p>

          <Link
            href="/marketplace"
            className="mt-6 inline-flex rounded-[10px] bg-accent-400 px-5 py-3 text-sm font-bold text-black transition hover:bg-accent-500"
          >
            Browse marketplace
          </Link>
        </section>
      ) : (
        <>
          <section className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="site-card p-5">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                Active
              </p>

              <p className="mt-2 text-3xl font-black text-slate-950">
                {
                  summary.activeOrders
                }
              </p>

              <p className="mt-1 text-sm text-slate-600">
                Orders still in
                progress
              </p>
            </div>

            <div className="site-card p-5">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                Completed
              </p>

              <p className="mt-2 text-3xl font-black text-slate-950">
                {
                  summary.completedOrders
                }
              </p>

              <p className="mt-1 text-sm text-slate-600">
                Finished orders
              </p>
            </div>

            <div className="site-card p-5">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                Paid spend
              </p>

              <p className="mt-2 text-2xl font-black text-slate-950">
                {formatNaira(
                  summary.totalSpent
                )}
              </p>

              <p className="mt-1 text-sm text-slate-600">
                Completed payment
                value recorded
              </p>
            </div>
          </section>

          <section className="mt-8 space-y-5">
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
                    <button
                      type="button"
                      onClick={() =>
                        toggleOrder(
                          order.id
                        )
                      }
                      className="flex w-full flex-col gap-4 p-5 text-left transition hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
                      aria-expanded={
                        expanded
                      }
                    >
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-lg font-black text-slate-950">
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

                        <p className="mt-2 text-sm text-slate-500">
                          {formatDate(
                            order.createdAt
                          )}
                          {" · "}
                          {
                            vendorGroups.length
                          }{" "}
                          {vendorGroups.length ===
                          1
                            ? "seller"
                            : "sellers"}
                          {" · "}
                          {
                            order.items.length
                          }{" "}
                          {order.items.length ===
                          1
                            ? "item"
                            : "items"}
                        </p>
                      </div>

                      <div className="flex items-center justify-between gap-5 sm:justify-end">
                        <div className="text-left sm:text-right">
                          <p className="text-xs font-semibold text-slate-500">
                            Order total
                          </p>

                          <p className="mt-1 text-lg font-black text-slate-950">
                            {formatNaira(
                              order.total
                            )}
                          </p>
                        </div>

                        <span
                          className={`text-xl text-slate-500 transition ${
                            expanded
                              ? "rotate-180"
                              : ""
                          }`}
                          aria-hidden="true"
                        >
                          ⌄
                        </span>
                      </div>
                    </button>

                    {expanded ? (
                      <div className="border-t border-slate-200">
                        <div className="grid gap-3 bg-slate-50 p-5 sm:grid-cols-2 lg:grid-cols-4">
                          <div>
                            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                              Payment
                            </p>

                            <p className="mt-1 text-sm font-bold text-slate-950">
                              {paymentLabel(
                                order.paymentStatus
                              )}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                              Pickup
                            </p>

                            <p className="mt-1 text-sm font-bold text-slate-950">
                              {order.pickupLocation ||
                                "Not specified"}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                              Preferred time
                            </p>

                            <p className="mt-1 text-sm font-bold text-slate-950">
                              {order.preferredSlot ||
                                "Not specified"}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                              Sellers
                            </p>

                            <p className="mt-1 text-sm font-bold text-slate-950">
                              {
                                vendorGroups.length
                              }
                            </p>
                          </div>
                        </div>

                        <div className="space-y-5 p-5">
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
                                  <div className="flex flex-col gap-4 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                      <div className="flex flex-wrap items-center gap-2">
                                        <Link
                                          href={`/seller/${group.vendorId}`}
                                          className="font-black text-slate-950 transition hover:underline hover:underline-offset-4"
                                        >
                                          {
                                            group.businessName
                                          }
                                        </Link>

                                        <StatusBadge
                                          status={
                                            secureStatus
                                          }
                                        />
                                      </div>

                                      {group.businessName !==
                                      group.sellerName ? (
                                        <p className="mt-1 text-xs text-slate-500">
                                          Seller:{" "}
                                          {
                                            group.sellerName
                                          }
                                        </p>
                                      ) : null}

                                      {group.pickupLocation &&
                                      (
                                        secureStatus ===
                                          "confirmed" ||
                                        secureStatus ===
                                          "completed"
                                      ) ? (
                                        <p className="mt-1 text-xs text-slate-500">
                                          Seller pickup:{" "}
                                          {
                                            group.pickupLocation
                                          }
                                        </p>
                                      ) : null}
                                    </div>

                                    <div className="flex shrink-0 flex-col gap-3 sm:items-end">
                                      <div className="sm:text-right">
                                        <p className="text-xs font-semibold text-slate-500">
                                          Seller subtotal
                                        </p>

                                        <p className="mt-1 font-black text-slate-950">
                                          {formatNaira(
                                            group.subtotal
                                          )}
                                        </p>
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
                                        className="inline-flex min-h-10 items-center justify-center rounded-[10px] border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-800 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                                      >
                                        {openingMessage
                                          ? "Opening..."
                                          : "Message seller"}
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
                                      className="border-t border-slate-200 bg-white p-4"
                                    >
                                      <div className="flex items-start justify-between gap-4">
                                        <div>
                                          <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                                            Order message
                                          </p>

                                          <h3 className="mt-1 text-sm font-black text-slate-950">
                                            Message{" "}
                                            {
                                              group.businessName
                                            }{" "}
                                            about order #
                                            {shortOrderId(
                                              order.id
                                            )}
                                          </h3>
                                        </div>

                                        <button
                                          type="button"
                                          disabled={
                                            sendingMessage
                                          }
                                          onClick={() => {
                                            setMessageComposerKey(
                                              null
                                            );

                                            setMessageErrors(
                                              (
                                                current
                                              ) => ({
                                                ...current,

                                                [messageKey]:
                                                  "",
                                              })
                                            );
                                          }}
                                          className="shrink-0 rounded-full px-2 py-1 text-lg font-bold text-slate-400 transition hover:bg-slate-100 hover:text-black disabled:cursor-not-allowed disabled:opacity-50"
                                          aria-label="Close message composer"
                                        >
                                          ×
                                        </button>
                                      </div>

                                      <textarea
                                        value={
                                          messageDraft
                                        }
                                        onChange={(
                                          event
                                        ) => {
                                          setMessageDrafts(
                                            (
                                              current
                                            ) => ({
                                              ...current,

                                              [messageKey]:
                                                event.target.value,
                                            })
                                          );

                                          if (
                                            messageError
                                          ) {
                                            setMessageErrors(
                                              (
                                                current
                                              ) => ({
                                                ...current,

                                                [messageKey]:
                                                  "",
                                              })
                                            );
                                          }
                                        }}
                                        rows={
                                          3
                                        }
                                        maxLength={
                                          MESSAGE_MAX_LENGTH
                                        }
                                        disabled={
                                          sendingMessage
                                        }
                                        placeholder="Hi, I have a question about this order..."
                                        className="mt-4 w-full resize-y rounded-[10px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                                      />

                                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                                        <p className="text-[11px] text-slate-400">
                                          {
                                            messageDraft.length
                                          }
                                          /
                                          {
                                            MESSAGE_MAX_LENGTH
                                          }
                                        </p>

                                        <p className="text-[11px] text-slate-400">
                                          This conversation
                                          is linked only to
                                          this seller&apos;s
                                          portion of the
                                          order.
                                        </p>
                                      </div>

                                      {messageError ? (
                                        <div
                                          role="alert"
                                          className="mt-3 rounded-[10px] border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-semibold leading-5 text-red-700"
                                        >
                                          {
                                            messageError
                                          }
                                        </div>
                                      ) : null}

                                      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                                        <button
                                          type="submit"
                                          disabled={
                                            sendingMessage ||
                                            !messageDraft.trim()
                                          }
                                          className="inline-flex items-center justify-center rounded-[10px] bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                          {sendingMessage
                                            ? "Sending..."
                                            : "Send message"}
                                        </button>

                                        <button
                                          type="button"
                                          disabled={
                                            sendingMessage
                                          }
                                          onClick={() => {
                                            setMessageComposerKey(
                                              null
                                            );

                                            setMessageErrors(
                                              (
                                                current
                                              ) => ({
                                                ...current,

                                                [messageKey]:
                                                  "",
                                              })
                                            );
                                          }}
                                          className="inline-flex items-center justify-center rounded-[10px] border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    </form>
                                  ) : messageError ? (
                                    <div
                                      role="alert"
                                      className="border-t border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700"
                                    >
                                      {
                                        messageError
                                      }
                                    </div>
                                  ) : null}

                                  <div className="border-t border-slate-200 bg-slate-50 p-4">
                                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                                      Secure handoff
                                    </p>

                                    {fulfillmentState
                                      ?.loading ? (
                                      <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4">
                                        <p className="text-sm font-semibold text-slate-600">
                                          Loading secure
                                          fulfilment
                                          information...
                                        </p>
                                      </div>
                                    ) : fulfillmentState
                                        ?.error ? (
                                      <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-4">
                                        <p className="text-sm font-bold text-red-700">
                                          Fulfilment
                                          information
                                          unavailable
                                        </p>

                                        <p className="mt-1 text-xs leading-5 text-red-600">
                                          {
                                            fulfillmentState.error
                                          }
                                        </p>

                                        <button
                                          type="button"
                                          onClick={() =>
                                            void loadFulfillmentCodes(
                                              order.id
                                            )
                                          }
                                          className="mt-3 rounded-[10px] border border-red-200 bg-white px-4 py-2 text-xs font-bold text-red-700 transition hover:bg-red-50"
                                        >
                                          Try again
                                        </button>
                                      </div>
                                    ) : secureStatus ===
                                        "pending" ? (
                                      <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
                                        <p className="text-sm font-bold text-amber-950">
                                          Code not active yet
                                        </p>

                                        <p className="mt-1 text-xs leading-5 text-amber-800">
                                          Your private
                                          handoff code will
                                          appear here after
                                          this seller
                                          confirms your
                                          order.
                                        </p>
                                      </div>
                                    ) : secureStatus ===
                                        "confirmed" &&
                                      fulfillmentPortion
                                        ?.codeAvailable &&
                                      fulfillmentPortion
                                        ?.code ? (
                                      <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 sm:p-5">
                                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                                          <div>
                                            <p className="text-sm font-bold text-emerald-950">
                                              Your 4-digit
                                              handoff code
                                            </p>

                                            <p
                                              className="mt-3 font-mono text-3xl font-black tracking-[0.3em] text-slate-950 sm:text-4xl"
                                              aria-label={`Fulfilment code ${fulfillmentPortion.code}`}
                                            >
                                              {
                                                fulfillmentPortion.code
                                              }
                                            </p>
                                          </div>

                                          <div className="max-w-sm rounded-[10px] border border-amber-200 bg-amber-50 p-3">
                                            <p className="text-xs font-black uppercase tracking-[0.12em] text-amber-800">
                                              Important
                                            </p>

                                            <p className="mt-1 text-xs leading-5 text-amber-900">
                                              Only give
                                              this code to
                                              the seller
                                              after you
                                              have
                                              received and
                                              checked your
                                              items.
                                            </p>
                                          </div>
                                        </div>

                                        <p className="mt-4 text-xs leading-5 text-emerald-800">
                                          Once the seller
                                          enters the
                                          correct code,
                                          their portion of
                                          this order will
                                          be marked
                                          completed and
                                          this code will
                                          stop being
                                          available.
                                        </p>
                                      </div>
                                    ) : secureStatus ===
                                        "completed" ||
                                      fulfillmentPortion
                                        ?.verified ? (
                                      <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                                        <p className="text-sm font-bold text-emerald-800">
                                          Handoff completed
                                        </p>

                                        <p className="mt-1 text-xs leading-5 text-emerald-700">
                                          This seller
                                          portion has been
                                          successfully
                                          completed. The
                                          handoff code is
                                          no longer
                                          active.
                                        </p>
                                      </div>
                                    ) : secureStatus ===
                                      "cancelled" ? (
                                      <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-4">
                                        <p className="text-sm font-bold text-red-700">
                                          Seller portion
                                          cancelled
                                        </p>

                                        <p className="mt-1 text-xs leading-5 text-red-600">
                                          No fulfilment
                                          code is required
                                          for this seller.
                                        </p>
                                      </div>
                                    ) : fulfillmentState
                                        ?.loaded ? (
                                      <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4">
                                        <p className="text-sm font-bold text-slate-800">
                                          Secure code
                                          unavailable
                                        </p>

                                        <p className="mt-1 text-xs leading-5 text-slate-500">
                                          Refresh the
                                          order to retrieve
                                          the latest
                                          fulfilment
                                          state.
                                        </p>

                                        <button
                                          type="button"
                                          onClick={() =>
                                            void loadFulfillmentCodes(
                                              order.id
                                            )
                                          }
                                          className="mt-3 rounded-[10px] border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
                                        >
                                          Refresh code
                                        </button>
                                      </div>
                                    ) : (
                                      <div className="mt-3 rounded-xl border border-slate-200 bg-white p-4">
                                        <p className="text-sm font-semibold text-slate-600">
                                          Loading secure
                                          fulfilment
                                          information...
                                        </p>
                                      </div>
                                    )}
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
                                          className="flex gap-4 p-4"
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
                                              alt=""
                                              className="h-20 w-20 shrink-0 rounded-[10px] object-cover"
                                            />
                                          ) : (
                                            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[10px] bg-slate-900 px-2 text-center text-[10px] font-bold text-white">
                                              CampusMart
                                            </div>
                                          )}

                                          <div className="min-w-0 flex-1">
                                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                              <div>
                                                <p className="font-bold text-slate-950">
                                                  {
                                                    item.productTitle
                                                  }
                                                </p>

                                                <p className="mt-1 text-xs text-slate-500">
                                                  {
                                                    item.quantity
                                                  }{" "}
                                                  ×{" "}
                                                  {formatNaira(
                                                    item.unitPrice
                                                  )}
                                                </p>
                                              </div>

                                              <p className="shrink-0 font-black text-slate-950">
                                                {formatNaira(
                                                  item.lineTotal
                                                )}
                                              </p>
                                            </div>

                                            <div className="mt-3 flex flex-wrap items-center gap-3">
                                              <StatusBadge
                                                status={
                                                  item.status
                                                }
                                              />

                                              {item.product ? (
                                                <Link
                                                  href={`/marketplace/products/${item.product.id}`}
                                                  className="text-xs font-bold text-slate-600 transition hover:text-black hover:underline"
                                                >
                                                  View listing
                                                </Link>
                                              ) : (
                                                <span className="text-xs font-semibold text-slate-400">
                                                  Original listing unavailable
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      )
                                    )}
                                  </div>
                                </section>
                              );
                            }
                          )}
                        </div>

                        <div className="border-t border-slate-200 bg-slate-50 p-5">
                          <div className="ml-auto max-w-sm space-y-2 text-sm">
                            <div className="flex items-center justify-between gap-4 text-slate-600">
                              <span>
                                Subtotal
                              </span>

                              <span className="font-semibold text-slate-950">
                                {formatNaira(
                                  order.subtotal
                                )}
                              </span>
                            </div>

                            <div className="flex items-center justify-between gap-4 text-slate-600">
                              <span>
                                CampusMart fee
                              </span>

                              <span className="font-semibold text-slate-950">
                                {formatNaira(
                                  order.fee
                                )}
                              </span>
                            </div>

                            <div className="flex items-center justify-between gap-4 border-t border-slate-200 pt-3">
                              <span className="font-bold text-slate-950">
                                Total
                              </span>

                              <span className="text-lg font-black text-slate-950">
                                {formatNaira(
                                  order.total
                                )}
                              </span>
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