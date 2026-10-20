"use client";
import { useCampusMartConfirm } from "@/components/common/CampusMartConfirm";


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
import { displayPhone } from "@/lib/phone";

import { OrderDeadline, useOrderTimings } from "@/components/orders/OrderDeadline";

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
  canSell:
    boolean;

  nextRequiredAction:
    SellerNextAction;

  message:
    string;

  sellerProfile: {
    exists:
      boolean;

    complete:
      boolean;

    accessStatus:
      | VendorAccessStatus
      | null;
  };
};

type VendorOrderItem = {
  id:
    string;

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

  selectedSize:
    | string
    | null;

  selectedColor:
    | string
    | null;

  status:
    OrderStatus;

  product?: {
    id:
      number;

    slug:
      string;

    title:
      string;

    images:
      string[];
  } | null;
};

type OrderPickupPoint = {
  type:
    string;

  label:
    string;

  detail:
    | string
    | null;
} | null;

type VendorOrder = {
  id:
    string;

  status:
    OrderStatus;

  vendorStatus:
    OrderStatus;

  paymentStatus:
    PaymentStatus;

  pickupLocation:
    | string
    | null;

  pickupPoint:
    OrderPickupPoint;

  pickupLocationUnlocked:
    boolean;

  pickupLocationAvailable:
    boolean;

  preferredSlot:
    | string
    | null;

  preferredSlotUnlocked:
    boolean;

  preferredSlotAvailable:
    boolean;

  createdAt:
    string;

  buyer: {
    secondaryPhone?: string | null;
    id:
      string;

    name:
      string;

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
  orderCount:
    number;

  pendingOrderCount:
    number;

  itemCount:
    number;

  revenue:
    number;
};

type FilterStatus =
  | "all"
  | OrderStatus;

type FulfillmentFeedback = {
  message:
    string;

  lockedUntil?:
    string | null;

  attemptsRemaining?:
    number;
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

function formatLockedUntil(
  value:
    | string
    | null
    | undefined
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

function pickupText(
  order:
    VendorOrder
) {
  if (
    order.pickupPoint
  ) {
    return [
      order.pickupPoint.label,
      order.pickupPoint.detail,
    ]
      .filter(
        Boolean
      )
      .join(
        " - "
      );
  }

  return (
    order.pickupLocation ||
    "Pickup point unavailable"
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
  const campusMartConfirm = useCampusMartConfirm();

  const router =
    useRouter();

  const {
    user,
    openAuth,
  } =
    useAuth();

  const { timings, now, refreshTimings } = useOrderTimings(user?.role === "vendor" ? user.id : null);

  const [
    orders,
    setOrders,
  ] =
    useState<
      VendorOrder[]
    >([]);

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

  const [
    handoffOrderId,
    setHandoffOrderId,
  ] =
    useState<
      string | null
    >(
      null
    );

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
      },
      [
        user,
      ]
    );

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

          setEligibilityError(
            accessError instanceof
              Error
              ? accessError.message
              : "Unable to confirm order-action access."
          );
        }

        if (
          !controller.signal.aborted
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
      () =>
        filter ===
        "all"
          ? orders
          : orders.filter(
              (
                order
              ) =>
                order.vendorStatus ===
                filter
            ),
      [
        orders,
        filter,
      ]
    );

  const refreshPage =
    async () => {
      try {
        setRefreshing(
          true
        );

        setError(
          ""
        );

        await Promise.all([loadOrders(), refreshTimings()]);

        try {
          await loadEligibility();
        } catch {}
      } catch (
        refreshError
      ) {
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

        setMessageComposerOrderId(
          order.id
        );

        setExpandedOrders(
          (
            current
          ) => ({
            ...current,

            [order.id]:
              true,
          })
        );
      } catch (
        messagingError
      ) {
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
        setSendingMessageOrderId(
          order.id
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
            "CampusMart could not open the conversation."
          );
        }

        router.push(
          `/messages/${conversationId}`
        );
      } catch (
        messagingError
      ) {
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

  const markReady = async (orderId: string) => {
    const token=localStorage.getItem("campusmart-token");
    if(!token) return;
    try {
      setUpdatingOrderId(orderId);
      setError("");
      const response=await fetch(`${API_URL}/api/orders/vendor/${orderId}/ready`, {method:"POST",headers:{Authorization:`Bearer ${token}`}});
      const data=await response.json();
      if(!response.ok || !data.success) throw Error(data.message || "Unable to mark ready.");
      await Promise.all([loadOrders(),refreshTimings()]);
      window.dispatchEvent(new CustomEvent("campusmart-toast",{detail:{message:"Buyer notified: ready for pickup"}}));
    } catch(error) {setError(error instanceof Error ? error.message : "Unable to mark ready.");}
    finally {setUpdatingOrderId(null);}
  };

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
            "Order actions are not currently available."
        );

        return;
      }

      if (
        status ===
          "cancelled" &&
        !await campusMartConfirm({ title: "Confirm action", description: "Cancel your part of this order?", danger: true })
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
          !response.ok ||
          !data.success
        ) {
          throw new Error(
            data.message ||
              "Unable to update order."
          );
        }

        await Promise.all([loadOrders(), refreshTimings()]);

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

  const submitFulfillmentCode =
    async (
      orderId:
        string
    ) => {
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
        return;
      }

      try {
        setUpdatingOrderId(
          orderId
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
              `${message} ${data.attemptsRemaining} attempts remaining.`;
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

        setHandoffOrderId(
          null
        );

        await Promise.all([loadOrders(), refreshTimings()]);

        window.dispatchEvent(
          new CustomEvent(
            "campusmart-toast",
            {
              detail: {
                message:
                  "Handoff verified - order completed",
              },
            }
          )
        );
      } catch (
        fulfillmentError
      ) {
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

  if (
    user?.role !==
    "vendor"
  ) {
    return (
      <PageShell
        title="Seller orders"
        description="Manage incoming CampusMart orders."
      >
        <section className="site-card mx-auto max-w-lg p-8 text-center">
          <h2 className="text-2xl font-black">
            Seller access required
          </h2>

          <button
            type="button"
            onClick={() =>
              openAuth(
                "login",
                "vendor"
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

  return (
    <PageShell
      title="Seller orders"
      description="Review orders, pickup details and handoffs."
    >
      {pendingReview ? (
        <section className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div>
            <p className="font-black text-amber-950">
              New selling is paused
            </p>

            <p className="mt-1 text-xs text-amber-800">
              Existing orders can still be fulfilled.
            </p>
          </div>

          <Link
            href={
              accountAction.href
            }
            className="rounded-lg bg-accent-400 px-4 py-2 text-xs font-black"
          >
            {
              accountAction.label
            }
          </Link>
        </section>
      ) : null}

      {restricted ||
      suspended ? (
        <section className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 font-bold text-red-800">
          Order actions are currently unavailable.
        </section>
      ) : null}

      {eligibilityError ? (
        <section className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
          Seller access could not be confirmed.
        </section>
      ) : null}

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

      <section className="site-card mt-4 overflow-hidden">
        <div className="grid grid-cols-4 divide-x divide-slate-200">
          <div className="p-3 sm:p-4">
            <p className="text-[9px] font-black uppercase text-slate-400">
              Orders
            </p>

            <p className="mt-1 text-xl font-black">
              {
                summary.orderCount
              }
            </p>
          </div>

          <div className="p-3 sm:p-4">
            <p className="text-[9px] font-black uppercase text-slate-400">
              Awaiting
            </p>

            <p className="mt-1 text-xl font-black">
              {
                summary.pendingOrderCount
              }
            </p>
          </div>

          <div className="p-3 sm:p-4">
            <p className="text-[9px] font-black uppercase text-slate-400">
              Items
            </p>

            <p className="mt-1 text-xl font-black">
              {
                summary.itemCount
              }
            </p>
          </div>

          <div className="p-3 sm:p-4">
            <p className="text-[9px] font-black uppercase text-slate-400">
              Revenue
            </p>

            <p className="mt-1 truncate text-sm font-black sm:text-lg">
              {formatNaira(
                summary.revenue
              )}
            </p>
          </div>
        </div>
      </section>

      {error ? (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
          {
            error
          }
        </div>
      ) : null}

      {loading ? (
        <div className="mt-5 space-y-3">
          <div className="site-card h-32 animate-pulse bg-slate-100" />
          <div className="site-card h-32 animate-pulse bg-slate-100" />
        </div>
      ) : null}

      {!loading &&
      orders.length ===
        0 ? (
        <section className="site-card mt-5 p-10 text-center">
          <h2 className="text-xl font-black">
            No orders yet
          </h2>
        </section>
      ) : null}

      {!loading &&
      orders.length >
        0 ? (
        <>
          <div className="mt-5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
                ) => (
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
                    className={`rounded-full border px-4 py-2 text-sm font-black ${
                      filter ===
                      value
                        ? "border-slate-950 bg-slate-950 text-white"
                        : "border-slate-200 bg-white text-slate-600"
                    }`}
                  >
                    {
                      label
                    }

                    <span className="ml-2 opacity-60">
                      {
                        statusCounts[
                          value
                        ]
                      }
                    </span>
                  </button>
                )
              )}
            </div>
          </div>

          <section className="mt-4 space-y-3">
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

                const handoffOpen =
                  handoffOrderId ===
                  order.id;

                const busy =
                  updatingOrderId ===
                  order.id;

                const enteredCode =
                  fulfillmentCodes[
                    order.id
                  ] ??
                  "";

                const fulfillmentIssue =
                  fulfillmentFeedback[
                    order.id
                  ];

                const buyerPhoneAvailable =
                  order.buyer
                    .phoneUnlocked &&
                  order.buyer
                    .phoneAvailable &&
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

                const selectedPickup =
                  pickupText(
                    order
                  );

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
                                order.vendorStatus
                              }
                            />

                            <span
                              className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-black ${paymentClasses(
                                order.paymentStatus
                              )}`}
                            >
                              {paymentLabel(
                                order.paymentStatus
                              )}
                            </span>
                          </div>

                          <p className="mt-1 text-xs text-slate-500">
                            {
                              order.buyer.name
                            }
                            {" - "}
                            {formatDate(
                              order.createdAt
                            )}
                          </p>

                          <div className="mt-2 flex items-start gap-1.5 text-xs">
                            <span className="shrink-0 font-black text-[#6E3847]">
                              Pickup:
                            </span>

                            <span className="line-clamp-2 font-semibold text-slate-700">
                              {
                                selectedPickup
                              }
                            </span>
                          </div>
                        </div>

                        <div className="shrink-0 text-right">
                          <p className="text-sm font-black">
                            {formatNaira(
                              vendorTotal
                            )}
                          </p>

                          <p className="mt-0.5 text-[10px] text-slate-400">
                            {itemQuantity}{" "}
                            {itemQuantity ===
                            1
                              ? "item"
                              : "items"}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3">
                        <OrderDeadline
                          timing={timings[`${order.id}:${user.id}`]}
                          status={timings[`${order.id}:${user.id}`]?.status ?? order.vendorStatus}
                          now={now}
                          perspective="seller"
                        />
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {order.vendorStatus ===
                          "pending" &&
                        canFulfilExistingOrders ? (
                          <button
                            type="button"
                            disabled={
                              busy
                            }
                            onClick={() =>
                              void updateStatus(
                                order.id,
                                "confirmed"
                              )
                            }
                            className="rounded-lg bg-accent-400 px-4 py-2.5 text-xs font-black"
                          >
                            {busy
                              ? "Updating..."
                              : "Confirm"}
                          </button>
                        ) : null}

                        {order.vendorStatus === "confirmed" &&
                          !timings[`${order.id}:${user.id}`]?.readyAt && order.paymentStatus === "paid" && canFulfilExistingOrders ? (
                          <button type="button" disabled={busy} onClick={() => void markReady(order.id)}
                            className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2.5 text-xs font-black text-emerald-800">
                            {busy ? "Updating..." : "Mark ready for pickup"}
                          </button>
                        ) : null}
                        {order.vendorStatus === "confirmed" && timings[`${order.id}:${user.id}`]?.readyAt ? (
                          <span className="self-center text-xs font-black text-emerald-700">Ready for pickup</span>
                        ) : null}
                        {order.vendorStatus ===
                          "confirmed" &&
                        canFulfilExistingOrders ? (
                          handoffOpen ? (
                            <>
                              <input
                                type="text"
                                inputMode="numeric"
                                maxLength={
                                  4
                                }
                                value={
                                  enteredCode
                                }
                                onChange={(
                                  event
                                ) =>
                                  setFulfillmentCodes(
                                    (
                                      current
                                    ) => ({
                                      ...current,

                                      [order.id]:
                                        event.target.value
                                          .replace(
                                            /\D/g,
                                            ""
                                          )
                                          .slice(
                                            0,
                                            4
                                          ),
                                    })
                                  )
                                }
                                placeholder="Code"
                                className="h-10 w-24 rounded-lg border border-slate-300 px-3 text-center font-mono font-black"
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
                                className="h-10 rounded-lg bg-emerald-600 px-4 text-xs font-black text-white disabled:opacity-40"
                              >
                                Verify
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                setHandoffOrderId(
                                  order.id
                                )
                              }
                              className="rounded-lg bg-emerald-600 px-4 py-2.5 text-xs font-black text-white"
                            >
                              Handoff
                            </button>
                          )
                        ) : null}

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
                          className="ml-auto rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-black"
                        >
                          {expanded
                            ? "Hide details"
                            : "Details"}
                        </button>
                      </div>

                      {handoffOpen &&
                      fulfillmentIssue ? (
                        <p className="mt-3 text-xs font-semibold text-red-600">
                          {
                            fulfillmentIssue.message
                          }
                        </p>
                      ) : null}
                    </div>

                    {expanded ? (
                      <div className="border-t border-slate-200">
                        <div className="grid grid-cols-2 gap-px bg-slate-200">
                          <div className="bg-slate-50 p-3">
                            <p className="text-[9px] font-black uppercase text-slate-400">
                              Buyer
                            </p>

                            <p className="mt-1 text-xs font-black sm:text-sm">
                              {
                                order.buyer.name
                              }
                            </p>
                          </div>

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

                          <div className="bg-slate-50 p-3 sm:col-span-2">
                            <p className="text-[9px] font-black uppercase text-slate-400">
                              Pickup
                            </p>

                            <p className="mt-1 text-xs font-black leading-5 sm:text-sm">
                              {
                                selectedPickup
                              }
                            </p>
                          </div>

                        </div>

                        <div className="border-t border-slate-200 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="text-xs font-black">
                                Buyer communication
                              </p>

                              <p className="mt-1 text-[11px] text-slate-500">
                                Use CampusMart messages for order coordination.
                              </p>
                            </div>

                            <div className="flex gap-2">
                              {buyerPhoneAvailable && order.buyer.secondaryPhone ? (
                                <a href={`tel:${order.buyer.secondaryPhone}`} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-black">Call alternate</a>
                              ) : null}
                              {buyerPhoneAvailable ? (
                                <a
                                  href={`tel:${order.buyer.phone}`}
                                  className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-800"
                                >
                                  Call buyer
                                </a>
                              ) : null}

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
                                className="rounded-lg bg-slate-950 px-3 py-2 text-xs font-black text-white"
                              >
                                {openingMessage
                                  ? "Opening..."
                                  : "Message buyer"}
                              </button>
                            </div>
                          </div>

                          <p className="mt-2 text-[10px] text-slate-400">
                            {buyerPhoneAvailable
                              ? `Buyer primary phone: ${displayPhone(order.buyer.phone)}${order.buyer.secondaryPhone ? ` · Secondary: ${displayPhone(order.buyer.secondaryPhone)}` : ""}`
                              : "Direct phone access remains protected until handoff coordination is active."}
                          </p>

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
                              className="mt-3 rounded-xl bg-slate-50 p-3"
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

                                      [order.id]:
                                        event.target.value,
                                    })
                                  )
                                }
                                placeholder="Write an order update..."
                                className="w-full rounded-lg border border-slate-200 bg-white p-3 text-sm"
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
                                    setMessageComposerOrderId(
                                      null
                                    )
                                  }
                                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-black"
                                >
                                  Cancel
                                </button>
                              </div>
                            </form>
                          ) : messageError ? (
                            <p className="mt-3 text-xs font-bold text-red-600">
                              {
                                messageError
                              }
                            </p>
                          ) : null}
                        </div>

                        <div className="border-t border-slate-200 p-4">
                          <h3 className="mb-3 text-xs font-black uppercase tracking-[0.14em] text-slate-400">
                            Items
                          </h3>

                          <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
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
                                    className="flex gap-3 bg-white p-3"
                                  >
                                    {image ? (
                                      <img
                                        src={
                                          image
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

                                      {item.product ? (
                                        <Link
                                          href={`/marketplace/products/${item.product.id}`}
                                          className="mt-2 inline-block text-[10px] font-bold text-slate-500 underline"
                                        >
                                          View listing
                                        </Link>
                                      ) : null}
                                    </div>

                                    <p className="shrink-0 text-sm font-black">
                                      {formatNaira(
                                        item.lineTotal
                                      )}
                                    </p>
                                  </div>
                                );
                              }
                            )}
                          </div>
                        </div>

                        {order.vendorStatus ===
                          "pending" &&
                        canFulfilExistingOrders ? (
                          <div className="border-t border-amber-200 bg-amber-50 p-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <p className="text-sm font-black text-amber-950">
                                Review the pickup location before responding.
                              </p>

                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  disabled={
                                    busy
                                  }
                                  onClick={() =>
                                    void updateStatus(
                                      order.id,
                                      "confirmed"
                                    )
                                  }
                                  className="rounded-lg bg-accent-400 px-4 py-2 text-xs font-black"
                                >
                                  Confirm
                                </button>

                                <button
                                  type="button"
                                  disabled={
                                    busy
                                  }
                                  onClick={() =>
                                    void updateStatus(
                                      order.id,
                                      "cancelled"
                                    )
                                  }
                                  className="rounded-lg border border-red-200 bg-white px-4 py-2 text-xs font-black text-red-600"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : null}

                        {order.vendorStatus ===
                        "completed" ? (
                          <div className="border-t border-emerald-200 bg-emerald-50 p-3 text-sm font-black text-emerald-800">
                            Handoff completed.
                          </div>
                        ) : null}

                        {order.vendorStatus ===
                        "cancelled" ? (
                          <div className="border-t border-red-200 bg-red-50 p-3 text-sm font-black text-red-700">
                            Order cancelled.
                          </div>
                        ) : null}
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