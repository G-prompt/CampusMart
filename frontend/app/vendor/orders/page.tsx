"use client";

import Link from "next/link";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

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

type VendorAccessStatus =
  | "active"
  | "pending_review"
  | "restricted"
  | "suspended";

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
  canSell: boolean;

  nextRequiredAction:
    SellerNextAction;

  message: string;

  sellerProfile: {
    exists: boolean;

    complete: boolean;

    accessStatus:
      | VendorAccessStatus
      | null;
  };
};

type VendorOrderItem = {
  id: string;

  productId:
    | number
    | null;

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

  product?: {
    id: number;

    slug: string;

    title: string;

    images: string[];
  } | null;
};

type VendorOrder = {
  id: string;

  status:
    OrderStatus;

  vendorStatus:
    OrderStatus;

  paymentStatus:
    PaymentStatus;

  pickupLocation:
    | string
    | null;

  preferredSlot:
    | string
    | null;

  createdAt:
    string;

  buyer: {
    id: string;

    name: string;

    campus:
      | string
      | null;

    phone:
      | string
      | null;

    phoneUnlocked:
      boolean;

    phoneAvailable:
      boolean;
  };

  items:
    VendorOrderItem[];
};

type VendorSummary = {
  orderCount: number;

  pendingOrderCount: number;

  itemCount: number;

  revenue: number;
};

type FilterStatus =
  | "all"
  | OrderStatus;

type FulfillmentFeedback = {
  message: string;

  lockedUntil?:
    string | null;

  attemptsRemaining?:
    number;
};

type ExistingConversation = {
  id: string;

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

function statusLabel(
  status:
    OrderStatus
) {
  switch (
    status
  ) {
    case "pending":
      return "Awaiting response";

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

    case "pending":
      return "Payment pending";

    case "failed":
      return "Payment failed";

    case "refunded":
      return "Refunded";

    default:
      return String(
        status
      ).replace(
        /_/g,
        " "
      );
  }
}

function paymentClasses(
  status:
    PaymentStatus
) {
  switch (
    status
  ) {
    case "paid":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";

    case "refunded":
      return "border-slate-200 bg-slate-100 text-slate-700";

    case "failed":
      return "border-red-200 bg-red-50 text-red-700";

    default:
      return "border-amber-200 bg-amber-50 text-amber-700";
  }
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

function formatLockedUntil(
  value:
    string | null | undefined
) {
  if (
    !value
  ) {
    return "";
  }

  const date =
    new Date(
      value
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  return date.toLocaleTimeString(
    "en-GB",
    {
      hour:
        "2-digit",

      minute:
        "2-digit",
    }
  );
}

function getAccountAction(
  action:
    SellerNextAction
) {
  switch (
    action
  ) {
    case "complete_university_details":
      return {
        label:
          "Complete university details",

        href:
          "/profile",
      };

    case "add_matric_number":
      return {
        label:
          "Add matric number",

        href:
          "/profile",
      };

    case "verify_student_identity":
      return {
        label:
          "Complete verification",

        href:
          "/profile",
      };

    case "complete_seller_profile":
      return {
        label:
          "Complete seller profile",

        href:
          "/profile",
      };

    default:
      return {
        label:
          "Review account",

        href:
          "/profile",
      };
  }
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
      VendorOrder[]
    >(
      []
    );

  const [
    summary,
    setSummary,
  ] =
    useState<VendorSummary>({
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
    >(
      null
    );

  const [
    loading,
    setLoading,
  ] =
    useState(
      true
    );

  const [
    refreshing,
    setRefreshing,
  ] =
    useState(
      false
    );

  const [
    error,
    setError,
  ] =
    useState(
      ""
    );

  const [
    eligibilityError,
    setEligibilityError,
  ] =
    useState(
      ""
    );

  const [
    updatingOrderId,
    setUpdatingOrderId,
  ] =
    useState<
      string | null
    >(
      null
    );

  const [
    filter,
    setFilter,
  ] =
    useState<FilterStatus>(
      "all"
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

  /*
   * =====================================================
   * FULFILMENT
   * =====================================================
   */

  const [
    fulfillmentCodes,
    setFulfillmentCodes,
  ] =
    useState<
      Record<
        string,
        string
      >
    >({});

  const [
    fulfillmentFeedback,
    setFulfillmentFeedback,
  ] =
    useState<
      Record<
        string,
        FulfillmentFeedback
      >
    >({});

  /*
   * =====================================================
   * ORDER MESSAGING
   * =====================================================
   */

  const [
    messageComposerOrderId,
    setMessageComposerOrderId,
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
    openingMessageOrderId,
    setOpeningMessageOrderId,
  ] =
    useState<
      string | null
    >(
      null
    );

  const [
    sendingMessageOrderId,
    setSendingMessageOrderId,
  ] =
    useState<
      string | null
    >(
      null
    );

  /*
   * =====================================================
   * LOAD ORDER HISTORY
   * =====================================================
   */

  const loadOrders =
    useCallback(
      async (
        signal?:
          AbortSignal
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

        if (
          !token
        ) {
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
              "Unable to load seller orders."
          );
        }

        const nextOrders:
          VendorOrder[] =
          Array.isArray(
            data.orders
          )
            ? data.orders
            : [];

        setOrders(
          nextOrders
        );

        setSummary({
          orderCount:
            Number(
              data.summary
                ?.orderCount
            ) ||
            0,

          pendingOrderCount:
            Number(
              data.summary
                ?.pendingOrderCount
            ) ||
            0,

          itemCount:
            Number(
              data.summary
                ?.itemCount
            ) ||
            0,

          revenue:
            Number(
              data.summary
                ?.revenue
            ) ||
            0,
        });

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
      },
      [
        user,
      ]
    );

  /*
   * =====================================================
   * LOAD SELLER ACCESS
   * =====================================================
   */

  const loadEligibility =
    useCallback(
      async (
        signal?:
          AbortSignal
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

        if (
          !token
        ) {
          throw new Error(
            "Your session is unavailable."
          );
        }

        const response =
          await fetch(
            `${API_URL}/api/vendor/eligibility`,
            {
              headers: {
                Authorization:
                  `Bearer ${token}`,
              },

              signal,

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
              "Unable to check seller access."
          );
        }

        setEligibility(
          data.eligibility
        );

        setEligibilityError(
          ""
        );
      },
      [
        user,
      ]
    );

  /*
   * =====================================================
   * INITIAL LOAD
   * =====================================================
   */

  useEffect(() => {
    if (
      user?.role !==
      "vendor"
    ) {
      setLoading(
        false
      );

      return;
    }

    const controller =
      new AbortController();

    const run =
      async () => {
        setLoading(
          true
        );

        setError(
          ""
        );

        setEligibilityError(
          ""
        );

        try {
          await loadOrders(
            controller.signal
          );
        } catch (
          orderError
        ) {
          if (
            orderError instanceof
              DOMException &&
            orderError.name ===
              "AbortError"
          ) {
            return;
          }

          console.error(
            "Vendor orders error:",
            orderError
          );

          setError(
            orderError instanceof
              Error
              ? orderError.message
              : "Unable to load seller orders."
          );
        }

        try {
          await loadEligibility(
            controller.signal
          );
        } catch (
          accessError
        ) {
          if (
            accessError instanceof
              DOMException &&
            accessError.name ===
              "AbortError"
          ) {
            return;
          }

          console.error(
            "Seller order access check error:",
            accessError
          );

          setEligibilityError(
            accessError instanceof
              Error
              ? accessError.message
              : "Unable to confirm order-action access."
          );
        }

        if (
          !controller.signal
            .aborted
        ) {
          setLoading(
            false
          );
        }
      };

    void run();

    return () => {
      controller.abort();
    };
  }, [
    user,
    loadOrders,
    loadEligibility,
  ]);

  /*
   * =====================================================
   * SELLER ACCESS
   * =====================================================
   */

  const accessStatus =
    eligibility
      ?.sellerProfile
      ?.accessStatus ??
    null;

  const canFulfilExistingOrders =
    accessStatus ===
      "active" ||
    accessStatus ===
      "pending_review";

  const pendingReview =
    accessStatus ===
    "pending_review";

  const restricted =
    accessStatus ===
    "restricted";

  const suspended =
    accessStatus ===
    "suspended";

  const accountAction =
    getAccountAction(
      eligibility
        ?.nextRequiredAction ??
        "not_a_seller"
    );

  /*
   * =====================================================
   * FILTERS
   * =====================================================
   */

  const statusCounts =
    useMemo(
      () => ({
        all:
          orders.length,

        pending:
          orders.filter(
            (
              order
            ) =>
              order.vendorStatus ===
              "pending"
          ).length,

        confirmed:
          orders.filter(
            (
              order
            ) =>
              order.vendorStatus ===
              "confirmed"
          ).length,

        completed:
          orders.filter(
            (
              order
            ) =>
              order.vendorStatus ===
              "completed"
          ).length,

        cancelled:
          orders.filter(
            (
              order
            ) =>
              order.vendorStatus ===
              "cancelled"
          ).length,
      }),
      [
        orders,
      ]
    );

  const filteredOrders =
    useMemo(
      () => {
        if (
          filter ===
          "all"
        ) {
          return orders;
        }

        return orders.filter(
          (
            order
          ) =>
            order.vendorStatus ===
            filter
        );
      },
      [
        orders,
        filter,
      ]
    );

  /*
   * =====================================================
   * REFRESH
   * =====================================================
   */

  const refreshPage =
    async () => {
      if (
        user?.role !==
        "vendor"
      ) {
        return;
      }

      try {
        setRefreshing(
          true
        );

        setError(
          ""
        );

        await loadOrders();

        try {
          await loadEligibility();
        } catch (
          accessError
        ) {
          console.warn(
            "Unable to refresh seller eligibility:",
            accessError
          );
        }
      } catch (
        refreshError
      ) {
        console.error(
          "Refresh seller orders error:",
          refreshError
        );

        setError(
          refreshError instanceof
            Error
            ? refreshError.message
            : "Unable to refresh seller orders."
        );
      } finally {
        setRefreshing(
          false
        );
      }
    };

  /*
   * =====================================================
   * OPEN ORDER CONVERSATION
   * =====================================================
   */

  const handleMessageBuyer =
    async (
      order:
        VendorOrder
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

      if (
        !token
      ) {
        setMessageErrors(
          (
            current
          ) => ({
            ...current,

            [order.id]:
              "Your session is unavailable. Sign in again to message the buyer.",
          })
        );

        return;
      }

      try {
        setOpeningMessageOrderId(
          order.id
        );

        setMessageErrors(
          (
            current
          ) => ({
            ...current,

            [order.id]:
              "",
          })
        );

        /*
         * Find the exact existing order thread.
         *
         * On the seller side, otherParty is the buyer.
         */

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
                order.buyer.id
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
         * No conversation exists yet.
         *
         * Do not create an empty thread.
         */

        setMessageComposerOrderId(
          order.id
        );
      } catch (
        messagingError
      ) {
        console.error(
          "Open buyer conversation error:",
          messagingError
        );

        setMessageErrors(
          (
            current
          ) => ({
            ...current,

            [order.id]:
              messagingError instanceof
                Error
                ? messagingError.message
                : "Unable to open messaging.",
          })
        );
      } finally {
        setOpeningMessageOrderId(
          null
        );
      }
    };

  /*
   * =====================================================
   * START ORDER CONVERSATION AS SELLER
   * =====================================================
   */

  const startBuyerConversation =
    async (
      event:
        FormEvent<HTMLFormElement>,
      order:
        VendorOrder
    ) => {
      event.preventDefault();

      if (
        user?.role !==
          "vendor" ||
        sendingMessageOrderId
      ) {
        return;
      }

      const body =
        (
          messageDrafts[
            order.id
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

            [order.id]:
              "Write a message to the buyer first.",
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

            [order.id]:
              `Messages can be up to ${MESSAGE_MAX_LENGTH} characters.`,
          })
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
        setMessageErrors(
          (
            current
          ) => ({
            ...current,

            [order.id]:
              "Your session is unavailable. Sign in again to message the buyer.",
          })
        );

        return;
      }

      try {
        setSendingMessageOrderId(
          order.id
        );

        setMessageErrors(
          (
            current
          ) => ({
            ...current,

            [order.id]:
              "",
          })
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

                  /*
                   * The vendor is explicitly supplied so
                   * the backend resolves this seller's
                   * portion of a multi-vendor order.
                   */
                  vendorId:
                    user.id,

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

            [order.id]:
              "",
          })
        );

        setMessageComposerOrderId(
          null
        );

        router.push(
          `/messages/${conversationId}`
        );
      } catch (
        messagingError
      ) {
        console.error(
          "Start buyer conversation error:",
          messagingError
        );

        setMessageErrors(
          (
            current
          ) => ({
            ...current,

            [order.id]:
              messagingError instanceof
                Error
                ? messagingError.message
                : "Unable to send your message.",
          })
        );
      } finally {
        setSendingMessageOrderId(
          null
        );
      }
    };

  /*
   * =====================================================
   * UPDATE ORDER STATUS
   * =====================================================
   */

  const updateStatus =
    async (
      orderId:
        string,

      status:
        | "confirmed"
        | "cancelled"
    ) => {
      if (
        !canFulfilExistingOrders
      ) {
        setError(
          eligibility?.message ||
            "Order actions are not currently available for this seller account."
        );

        return;
      }

      if (
        status ===
          "cancelled" &&
        !window.confirm(
          "Cancel your part of this order? This cannot be undone."
        )
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
        setError(
          "Your session is unavailable."
        );

        return;
      }

      try {
        setUpdatingOrderId(
          orderId
        );

        setError(
          ""
        );

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
          data.eligibility
        ) {
          setEligibility(
            data.eligibility
          );
        }

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

        try {
          await loadEligibility();
        } catch (
          refreshError
        ) {
          console.warn(
            "Unable to refresh seller access after order update:",
            refreshError
          );
        }

        window.dispatchEvent(
          new CustomEvent(
            "campusmart-toast",
            {
              detail: {
                message:
                  status ===
                  "confirmed"
                    ? "Order confirmed"
                    : "Order cancelled",
              },
            }
          )
        );
      } catch (
        updateError
      ) {
        console.error(
          "Order status update error:",
          updateError
        );

        setError(
          updateError instanceof
            Error
            ? updateError.message
            : "Unable to update order."
        );
      } finally {
        setUpdatingOrderId(
          null
        );
      }
    };

  /*
   * =====================================================
   * COMPLETE HANDOFF USING BUYER CODE
   * =====================================================
   */

  const submitFulfillmentCode =
    async (
      orderId:
        string
    ) => {
      if (
        !canFulfilExistingOrders
      ) {
        setError(
          eligibility?.message ||
            "Order actions are not currently available for this seller account."
        );

        return;
      }

      const code =
        (
          fulfillmentCodes[
            orderId
          ] ??
          ""
        ).trim();

      if (
        !/^\d{4}$/.test(
          code
        )
      ) {
        setFulfillmentFeedback(
          (
            current
          ) => ({
            ...current,

            [orderId]: {
              message:
                "Enter the buyer's complete 4-digit handoff code.",
            },
          })
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
          "Your session is unavailable."
        );

        return;
      }

      try {
        setUpdatingOrderId(
          orderId
        );

        setError(
          ""
        );

        setFulfillmentFeedback(
          (
            current
          ) => {
            const next = {
              ...current,
            };

            delete next[
              orderId
            ];

            return next;
          }
        );

        const response =
          await fetch(
            `${API_URL}/api/orders/vendor/${orderId}/fulfillment`,
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
                  code,
                }),
            }
          );

        const data =
          await response.json();

        if (
          !response.ok ||
          !data.success
        ) {
          let message =
            data.message ||
            "Unable to verify the handoff code.";

          if (
            data.code ===
              "INCORRECT_FULFILLMENT_CODE" &&
            typeof data.attemptsRemaining ===
              "number"
          ) {
            message =
              `${message} ${data.attemptsRemaining} ${
                data.attemptsRemaining ===
                1
                  ? "attempt"
                  : "attempts"
              } remaining.`;
          }

          if (
            data.code ===
              "FULFILLMENT_CODE_LOCKED"
          ) {
            const unlockTime =
              formatLockedUntil(
                data.lockedUntil
              );

            if (
              unlockTime
            ) {
              message =
                `${message} Try again after ${unlockTime}.`;
            }
          }

          setFulfillmentFeedback(
            (
              current
            ) => ({
              ...current,

              [orderId]: {
                message,

                lockedUntil:
                  data.lockedUntil ??
                  null,

                attemptsRemaining:
                  typeof data.attemptsRemaining ===
                    "number"
                    ? data.attemptsRemaining
                    : undefined,
              },
            })
          );

          return;
        }

        setFulfillmentCodes(
          (
            current
          ) => ({
            ...current,

            [orderId]:
              "",
          })
        );

        setFulfillmentFeedback(
          (
            current
          ) => {
            const next = {
              ...current,
            };

            delete next[
              orderId
            ];

            return next;
          }
        );

        await loadOrders();

        try {
          await loadEligibility();
        } catch (
          refreshError
        ) {
          console.warn(
            "Unable to refresh seller access after fulfilment:",
            refreshError
          );
        }

        window.dispatchEvent(
          new CustomEvent(
            "campusmart-toast",
            {
              detail: {
                message:
                  "Handoff verified — order completed",
              },
            }
          )
        );
      } catch (
        fulfillmentError
      ) {
        console.error(
          "Fulfillment verification error:",
          fulfillmentError
        );

        setFulfillmentFeedback(
          (
            current
          ) => ({
            ...current,

            [orderId]: {
              message:
                fulfillmentError instanceof
                  Error
                  ? fulfillmentError.message
                  : "Unable to verify the handoff code.",
            },
          })
        );
      } finally {
        setUpdatingOrderId(
          null
        );
      }
    };

  /*
   * =====================================================
   * NON-SELLER
   * =====================================================
   */

  if (
    user?.role !==
    "vendor"
  ) {
    return (
      <PageShell
        title="Seller orders"
        description="Manage incoming CampusMart orders."
      >
        <section className="site-card mx-auto max-w-lg p-8 text-center sm:p-10">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-950 text-sm font-black text-white">
            CM
          </div>

          <h2 className="mt-5 text-2xl font-bold text-slate-950">
            Seller access required
          </h2>

          <p className="mx-auto mt-3 max-w-sm text-sm leading-7 text-slate-600">
            Sign in with a seller
            account to view and manage
            orders containing your
            products.
          </p>

          <button
            type="button"
            onClick={() =>
              openAuth(
                "login",
                "vendor"
              )
            }
            className="mt-6 rounded-[10px] bg-accent-400 px-5 py-3 text-sm font-bold text-black transition hover:bg-accent-500"
          >
            Sign in as seller
          </button>
        </section>
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
      title="Seller orders"
      description="Manage incoming orders and complete secure buyer handoffs."
    >
      {pendingReview ? (
        <section className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-700">
                Seller access
              </p>

              <h2 className="mt-2 text-xl font-bold text-amber-950">
                New selling is paused
              </h2>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-amber-800">
                You can still fulfil
                orders that already
                exist, but new selling
                activity remains paused
                until your seller
                requirements are
                complete.
              </p>
            </div>

            <Link
              href={
                accountAction.href
              }
              className="shrink-0 rounded-[10px] bg-accent-400 px-5 py-3 text-center text-sm font-bold text-black transition hover:bg-accent-500"
            >
              {
                accountAction.label
              }
            </Link>
          </div>
        </section>
      ) : null}

      {restricted ||
      suspended ? (
        <section className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-red-700">
                Seller access
              </p>

              <h2 className="mt-2 text-xl font-bold text-red-950">
                {suspended
                  ? "Order actions suspended"
                  : "Order actions restricted"}
              </h2>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-red-800">
                {eligibility
                  ?.message ||
                  "You can still view your existing order history, but order actions are currently unavailable."}
              </p>
            </div>

            <Link
              href="/profile"
              className="shrink-0 rounded-[10px] border border-red-200 bg-white px-5 py-3 text-center text-sm font-bold text-red-800 transition hover:border-red-400"
            >
              Review account
            </Link>
          </div>
        </section>
      ) : null}

      {eligibilityError ? (
        <section className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-bold text-amber-900">
            Order-action access
            could not be confirmed.
          </p>

          <p className="mt-1 text-xs leading-5 text-amber-700">
            Your order history remains
            available, but status
            changes are disabled until
            CampusMart confirms your
            seller access.
          </p>
        </section>
      ) : null}

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

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="site-card p-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
            Orders
          </p>

          <p className="mt-2 text-3xl font-black text-slate-950">
            {
              summary.orderCount
            }
          </p>

          <p className="mt-1 text-sm text-slate-600">
            Buyer orders received
          </p>
        </div>

        <div className="site-card p-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
            Awaiting response
          </p>

          <p className="mt-2 text-3xl font-black text-slate-950">
            {
              summary.pendingOrderCount
            }
          </p>

          <p className="mt-1 text-sm text-slate-600">
            Need your attention
          </p>
        </div>

        <div className="site-card p-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
            Items
          </p>

          <p className="mt-2 text-3xl font-black text-slate-950">
            {
              summary.itemCount
            }
          </p>

          <p className="mt-1 text-sm text-slate-600">
            Products ordered
          </p>
        </div>

        <div className="site-card p-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
            Revenue
          </p>

          <p className="mt-2 text-2xl font-black text-slate-950">
            {formatNaira(
              summary.revenue
            )}
          </p>

          <p className="mt-1 text-sm text-slate-600">
            Paid + completed only
          </p>
        </div>
      </section>

      {error ? (
        <div
          className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"
          role="alert"
        >
          {
            error
          }
        </div>
      ) : null}

      {loading ? (
        <div className="mt-8 space-y-4">
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
                className="site-card h-44 animate-pulse bg-slate-100"
              />
            )
          )}
        </div>
      ) : null}

      {!loading &&
      orders.length ===
        0 ? (
        <section className="site-card mt-8 flex flex-col items-center px-6 py-14 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-950 text-sm font-black text-white">
            CM
          </div>

          <h2 className="mt-5 text-2xl font-bold text-slate-950">
            No orders yet
          </h2>

          <p className="mt-2 max-w-md text-sm leading-6 text-slate-600">
            When a buyer orders one
            of your products, the
            order will appear here.
          </p>

          <Link
            href="/vendor/listings"
            className="mt-6 rounded-[10px] bg-accent-400 px-5 py-3 text-sm font-bold text-black transition hover:bg-accent-500"
          >
            View your listings
          </Link>
        </section>
      ) : null}

      {!loading &&
      orders.length >
        0 ? (
        <>
          <div className="mt-8 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex min-w-max gap-2">
              {(
                [
                  [
                    "all",
                    "All",
                  ],

                  [
                    "pending",
                    "Awaiting",
                  ],

                  [
                    "confirmed",
                    "Confirmed",
                  ],

                  [
                    "completed",
                    "Completed",
                  ],

                  [
                    "cancelled",
                    "Cancelled",
                  ],
                ] as const
              ).map(
                (
                  [
                    value,
                    label,
                  ]
                ) => {
                  const active =
                    filter ===
                    value;

                  return (
                    <button
                      key={
                        value
                      }
                      type="button"
                      onClick={() =>
                        setFilter(
                          value
                        )
                      }
                      className={`rounded-full border px-4 py-2 text-sm font-bold transition ${
                        active
                          ? "border-slate-950 bg-slate-950 text-white"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-400 hover:text-black"
                      }`}
                    >
                      {
                        label
                      }

                      <span
                        className={`ml-2 ${
                          active
                            ? "text-slate-300"
                            : "text-slate-400"
                        }`}
                      >
                        {
                          statusCounts[
                            value
                          ]
                        }
                      </span>
                    </button>
                  );
                }
              )}
            </div>
          </div>

          {filteredOrders.length ===
          0 ? (
            <section className="site-card mt-5 p-8 text-center">
              <h2 className="text-xl font-bold text-slate-950">
                No orders here
              </h2>

              <p className="mt-2 text-sm text-slate-600">
                There are currently
                no orders with this
                status.
              </p>
            </section>
          ) : null}

          <section className="mt-5 space-y-5">
            {filteredOrders.map(
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

                const itemQuantity =
                  order.items.reduce(
                    (
                      total,
                      item
                    ) =>
                      total +
                      item.quantity,
                    0
                  );

                const expanded =
                  Boolean(
                    expandedOrders[
                      order.id
                    ]
                  );

                const busy =
                  updatingOrderId ===
                  order.id;

                const actionsDisabled =
                  !canFulfilExistingOrders ||
                  busy;

                const enteredCode =
                  fulfillmentCodes[
                    order.id
                  ] ??
                  "";

                const fulfillmentIssue =
                  fulfillmentFeedback[
                    order.id
                  ];

                const buyerPhoneUnlocked =
                  order.buyer
                    .phoneUnlocked ===
                  true;

                const buyerPhoneAvailable =
                  buyerPhoneUnlocked &&
                  order.buyer
                    .phoneAvailable ===
                    true &&
                  Boolean(
                    order.buyer.phone
                  );

                const messageComposerOpen =
                  messageComposerOrderId ===
                  order.id;

                const messageDraft =
                  messageDrafts[
                    order.id
                  ] ??
                  "";

                const messageError =
                  messageErrors[
                    order.id
                  ] ??
                  "";

                const openingMessage =
                  openingMessageOrderId ===
                  order.id;

                const sendingMessage =
                  sendingMessageOrderId ===
                  order.id;

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
                        setExpandedOrders(
                          (
                            current
                          ) => ({
                            ...current,

                            [order.id]:
                              !expanded,
                          })
                        )
                      }
                      className="flex w-full flex-col gap-4 p-5 text-left transition hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
                      aria-expanded={
                        expanded
                      }
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-lg font-black text-slate-950">
                            Order #
                            {shortOrderId(
                              order.id
                            )}
                          </h2>

                          <StatusBadge
                            status={
                              order.vendorStatus
                            }
                          />

                          <span
                            className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${paymentClasses(
                              order.paymentStatus
                            )}`}
                          >
                            {paymentLabel(
                              order.paymentStatus
                            )}
                          </span>
                        </div>

                        <p className="mt-2 text-sm text-slate-500">
                          {
                            order.buyer.name
                          }
                          {" · "}
                          {formatDate(
                            order.createdAt
                          )}
                          {" · "}
                          {
                            itemQuantity
                          }{" "}
                          {itemQuantity ===
                          1
                            ? "item"
                            : "items"}
                        </p>
                      </div>

                      <div className="flex items-center justify-between gap-5 sm:justify-end">
                        <div className="text-left sm:text-right">
                          <p className="text-xs font-semibold text-slate-500">
                            Your total
                          </p>

                          <p className="mt-1 text-lg font-black text-slate-950">
                            {formatNaira(
                              vendorTotal
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
                        <div className="grid gap-5 bg-slate-50 p-5 sm:grid-cols-2 lg:grid-cols-4">
                          <div>
                            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                              Buyer
                            </p>

                            <p className="mt-2 text-sm font-bold text-slate-950">
                              {
                                order.buyer.name
                              }
                            </p>

                            {order.buyer
                              .campus ? (
                              <p className="mt-1 text-xs leading-5 text-slate-500">
                                {
                                  order.buyer.campus
                                }
                              </p>
                            ) : null}
                          </div>

                          <div>
                            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                              Pickup
                            </p>

                            <p className="mt-2 text-sm font-bold text-slate-950">
                              {order.pickupLocation ||
                                "Campus pickup"}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                              Preferred time
                            </p>

                            <p className="mt-2 text-sm font-bold text-slate-950">
                              {order.preferredSlot ||
                                "Not specified"}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                              Payment
                            </p>

                            <p className="mt-2 text-sm font-bold text-slate-950">
                              {paymentLabel(
                                order.paymentStatus
                              )}
                            </p>
                          </div>
                        </div>

                        {/*
                         * =================================
                         * BUYER COMMUNICATION
                         * =================================
                         */}

                        <div className="border-t border-slate-200 bg-white px-5 py-5">
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                                Buyer communication
                              </p>

                              <p className="mt-2 text-sm font-bold text-slate-950">
                                Message{" "}
                                {
                                  order.buyer.name
                                }
                              </p>

                              <p className="mt-1 max-w-xl text-xs leading-5 text-slate-500">
                                Use the order
                                conversation for
                                questions, updates
                                and handoff
                                coordination.
                              </p>
                            </div>

                            <button
                              type="button"
                              disabled={
                                openingMessage ||
                                sendingMessage
                              }
                              onClick={() =>
                                void handleMessageBuyer(
                                  order
                                )
                              }
                              className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-[10px] bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {openingMessage
                                ? "Opening..."
                                : "Message buyer"}
                            </button>
                          </div>

                          {messageComposerOpen ? (
                            <form
                              onSubmit={(
                                event
                              ) =>
                                void startBuyerConversation(
                                  event,
                                  order
                                )
                              }
                              className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4"
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div>
                                  <p className="text-xs font-black uppercase tracking-[0.14em] text-slate-500">
                                    Order message
                                  </p>

                                  <h3 className="mt-1 text-sm font-black text-slate-950">
                                    Message{" "}
                                    {
                                      order.buyer.name
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
                                    setMessageComposerOrderId(
                                      null
                                    );

                                    setMessageErrors(
                                      (
                                        current
                                      ) => ({
                                        ...current,

                                        [order.id]:
                                          "",
                                      })
                                    );
                                  }}
                                  className="shrink-0 rounded-full px-2 py-1 text-lg font-bold text-slate-400 transition hover:bg-slate-200 hover:text-black disabled:cursor-not-allowed disabled:opacity-50"
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

                                      [order.id]:
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

                                        [order.id]:
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
                                placeholder="Hi, I have an update about your order..."
                                className="mt-4 w-full resize-y rounded-[10px] border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
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
                                  Contact details may
                                  be hidden by
                                  CampusMart.
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
                                    setMessageComposerOrderId(
                                      null
                                    );

                                    setMessageErrors(
                                      (
                                        current
                                      ) => ({
                                        ...current,

                                        [order.id]:
                                          "",
                                      })
                                    );
                                  }}
                                  className="inline-flex items-center justify-center rounded-[10px] border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  Cancel
                                </button>
                              </div>
                            </form>
                          ) : messageError ? (
                            <div
                              role="alert"
                              className="mt-4 rounded-[10px] border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-semibold leading-5 text-red-700"
                            >
                              {
                                messageError
                              }
                            </div>
                          ) : null}
                        </div>

                        {/*
                         * =================================
                         * BUYER PHONE
                         * =================================
                         */}

                        <div className="border-t border-slate-200 bg-white px-5 py-4">
                          {buyerPhoneAvailable ? (
                            <div className="flex flex-col gap-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <p className="text-xs font-black uppercase tracking-[0.14em] text-emerald-700">
                                  Buyer contact unlocked
                                </p>

                                <p className="mt-2 text-lg font-black text-emerald-950">
                                  {
                                    order.buyer.phone
                                  }
                                </p>

                                <p className="mt-1 max-w-xl text-xs leading-5 text-emerald-800">
                                  This number is available
                                  during the active handoff
                                  window so you can contact
                                  the buyer if they are not
                                  responding in CampusMart.
                                </p>
                              </div>

                              <a
                                href={`tel:${order.buyer.phone}`}
                                className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-[10px] bg-emerald-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-800"
                              >
                                Call buyer
                              </a>
                            </div>
                          ) : buyerPhoneUnlocked ? (
                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                              <p className="text-sm font-bold text-slate-900">
                                Buyer contact unavailable
                              </p>

                              <p className="mt-1 text-xs leading-5 text-slate-600">
                                Contact access is unlocked
                                for this order, but the
                                buyer does not currently
                                have a phone number
                                available.
                              </p>
                            </div>
                          ) : (
                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                              <p className="text-sm font-bold text-slate-900">
                                Buyer phone is protected
                              </p>

                              <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-600">
                                Use CampusMart messaging
                                while the phone number is
                                protected. Buyer phone
                                becomes available only
                                during an active paid and
                                confirmed handoff.
                              </p>
                            </div>
                          )}
                        </div>

                        {/*
                         * =================================
                         * ITEMS
                         * =================================
                         */}

                        <div className="p-5">
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                                Your items
                              </p>

                              <h3 className="mt-1 text-lg font-black text-slate-950">
                                What to fulfil
                              </h3>
                            </div>

                            <p className="text-sm font-bold text-slate-600">
                              {
                                itemQuantity
                              }{" "}
                              {itemQuantity ===
                              1
                                ? "item"
                                : "items"}
                            </p>
                          </div>

                          <div className="mt-4 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
                            {order.items.map(
                              (
                                item
                              ) => {
                                const image =
                                  item.product
                                    ?.images
                                    ?.[0];

                                return (
                                  <div
                                    key={
                                      item.id
                                    }
                                    className="flex gap-4 bg-white p-4"
                                  >
                                    {image ? (
                                      <img
                                        src={
                                          image
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
                                );
                              }
                            )}
                          </div>

                          <div className="mt-5 flex items-center justify-between border-t border-slate-200 pt-5">
                            <span className="text-sm font-bold text-slate-600">
                              Your order total
                            </span>

                            <span className="text-xl font-black text-slate-950">
                              {formatNaira(
                                vendorTotal
                              )}
                            </span>
                          </div>

                          {!canFulfilExistingOrders &&
                          order.vendorStatus !==
                            "completed" &&
                          order.vendorStatus !==
                            "cancelled" ? (
                            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                              <p className="text-sm font-bold text-slate-800">
                                Order actions unavailable
                              </p>

                              <p className="mt-1 text-xs leading-5 text-slate-500">
                                You can still
                                view this order
                                and its message
                                history, but your
                                current seller
                                access does not
                                allow fulfilment
                                status changes.
                              </p>
                            </div>
                          ) : null}

                          {order.vendorStatus ===
                            "pending" &&
                          canFulfilExistingOrders ? (
                            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
                              <p className="font-bold text-amber-950">
                                Buyer is waiting
                                for your response
                              </p>

                              <p className="mt-1 text-xs leading-5 text-amber-800">
                                Confirm the order
                                if you can fulfil
                                it. Buyer contact
                                stays protected
                                until CampusMart
                                has a paid order
                                and your portion
                                is confirmed.
                              </p>

                              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                                <button
                                  type="button"
                                  disabled={
                                    actionsDisabled
                                  }
                                  onClick={() =>
                                    void updateStatus(
                                      order.id,
                                      "confirmed"
                                    )
                                  }
                                  className="rounded-[10px] bg-accent-400 px-5 py-3 text-sm font-bold text-black transition hover:bg-accent-500 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {busy
                                    ? "Updating..."
                                    : "Confirm order"}
                                </button>

                                <button
                                  type="button"
                                  disabled={
                                    actionsDisabled
                                  }
                                  onClick={() =>
                                    void updateStatus(
                                      order.id,
                                      "cancelled"
                                    )
                                  }
                                  className="rounded-[10px] border border-red-200 bg-white px-5 py-3 text-sm font-bold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  Cancel order
                                </button>
                              </div>
                            </div>
                          ) : null}

                          {order.vendorStatus ===
                            "confirmed" &&
                          canFulfilExistingOrders ? (
                            <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4 sm:p-5">
                              <p className="text-xs font-black uppercase tracking-[0.14em] text-blue-700">
                                Secure handoff
                              </p>

                              <h3 className="mt-2 text-lg font-black text-blue-950">
                                Enter the buyer&apos;s
                                4-digit code
                              </h3>

                              <p className="mt-2 max-w-xl text-sm leading-6 text-blue-800">
                                The buyer should
                                give you their
                                private handoff
                                code only after
                                they have received
                                and checked the
                                items.
                              </p>

                              <div className="mt-5 flex max-w-md flex-col gap-3 sm:flex-row">
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  maxLength={
                                    4
                                  }
                                  value={
                                    enteredCode
                                  }
                                  disabled={
                                    busy
                                  }
                                  onChange={(
                                    event
                                  ) => {
                                    const code =
                                      event.target.value
                                        .replace(
                                          /\D/g,
                                          ""
                                        )
                                        .slice(
                                          0,
                                          4
                                        );

                                    setFulfillmentCodes(
                                      (
                                        current
                                      ) => ({
                                        ...current,

                                        [order.id]:
                                          code,
                                      })
                                    );

                                    if (
                                      fulfillmentFeedback[
                                        order.id
                                      ]
                                    ) {
                                      setFulfillmentFeedback(
                                        (
                                          current
                                        ) => {
                                          const next = {
                                            ...current,
                                          };

                                          delete next[
                                            order.id
                                          ];

                                          return next;
                                        }
                                      );
                                    }
                                  }}
                                  onKeyDown={(
                                    event
                                  ) => {
                                    if (
                                      event.key ===
                                        "Enter" &&
                                      enteredCode.length ===
                                        4 &&
                                      !busy
                                    ) {
                                      void submitFulfillmentCode(
                                        order.id
                                      );
                                    }
                                  }}
                                  placeholder="0000"
                                  aria-label="Buyer handoff code"
                                  className="min-h-12 w-full rounded-[10px] border border-blue-200 bg-white px-4 text-center font-mono text-xl font-black tracking-[0.3em] text-slate-950 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 sm:w-40"
                                />

                                <button
                                  type="button"
                                  disabled={
                                    busy ||
                                    enteredCode.length !==
                                      4
                                  }
                                  onClick={() =>
                                    void submitFulfillmentCode(
                                      order.id
                                    )
                                  }
                                  className="min-h-12 rounded-[10px] bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {busy
                                    ? "Verifying..."
                                    : "Complete handoff"}
                                </button>
                              </div>

                              {fulfillmentIssue ? (
                                <div
                                  role="alert"
                                  className="mt-4 rounded-[10px] border border-red-200 bg-red-50 p-3"
                                >
                                  <p className="text-sm font-bold text-red-700">
                                    {
                                      fulfillmentIssue.message
                                    }
                                  </p>
                                </div>
                              ) : null}

                              <div className="mt-4 rounded-[10px] border border-blue-200 bg-white/70 p-3">
                                <p className="text-xs font-bold text-slate-800">
                                  Do not ask the
                                  buyer for the
                                  code before
                                  handoff.
                                </p>

                                <p className="mt-1 text-xs leading-5 text-slate-600">
                                  A successful
                                  code check is
                                  CampusMart&apos;s
                                  confirmation
                                  that this seller
                                  portion was
                                  handed over.
                                </p>
                              </div>

                              <button
                                type="button"
                                disabled={
                                  actionsDisabled
                                }
                                onClick={() =>
                                  void updateStatus(
                                    order.id,
                                    "cancelled"
                                  )
                                }
                                className="mt-4 text-xs font-bold text-red-600 underline-offset-4 transition hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                Cancel this order instead
                              </button>
                            </div>
                          ) : null}

                          {order.vendorStatus ===
                          "completed" ? (
                            <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                              <p className="font-bold text-emerald-800">
                                Handoff completed
                              </p>

                              <p className="mt-1 text-xs leading-5 text-emerald-700">
                                The buyer&apos;s
                                handoff code was
                                successfully
                                verified and your
                                seller portion of
                                this order is
                                complete. Buyer
                                phone access has
                                been closed again.
                              </p>
                            </div>
                          ) : null}

                          {order.vendorStatus ===
                          "cancelled" ? (
                            <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4">
                              <p className="font-bold text-red-700">
                                Order cancelled
                              </p>

                              <p className="mt-1 text-xs leading-5 text-red-600">
                                Your seller
                                portion of this
                                order has been
                                cancelled. Buyer
                                phone access is
                                not available.
                              </p>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </article>
                );
              }
            )}
          </section>
        </>
      ) : null}
    </PageShell>
  );
}