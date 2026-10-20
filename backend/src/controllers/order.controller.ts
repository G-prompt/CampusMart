
import type { Response } from "express";
import {
  NotificationType,
  OrderStatus,
  PaymentStatus,
  UserRole,
} from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { settleVerifiedSeller } from "../services/orderFunds.service";
import type { AuthenticatedRequest } from "../middleware/auth.middleware";
import {
  decryptFulfillmentCode,
  isValidFulfillmentCode,
  verifyFulfillmentCodeHash,
} from "../services/fulfillmentCode.service";

export { createOrder } from "./orderCreation.controller";

// Preserve the existing export while using the timestamp-aware handler.
export {
  updateVendorOrderStatusWithTiming as updateVendorOrderStatus,
} from "./orderTiming.controller";

class OrderInputError extends Error {}

const MAX_FULFILLMENT_ATTEMPTS = 5;
const FULFILLMENT_LOCK_MINUTES = 15;

type BuyerContact = {
  id: string;
  name: string;
  campus: string | null;
  phone: string | null;
};

type PickupSnapshot = {
  type: string;
  label: string;
  detail: string | null;
};

function portionStatus(statuses: OrderStatus[]): OrderStatus {
  if (!statuses.length) return OrderStatus.pending;

  if (statuses.every((s) => s === OrderStatus.cancelled)) {
    return OrderStatus.cancelled;
  }

  if (
    statuses.every(
      (s) =>
        s === OrderStatus.completed ||
        s === OrderStatus.cancelled
    )
  ) {
    return OrderStatus.completed;
  }

  if (
    statuses.some(
      (s) =>
        s === OrderStatus.confirmed ||
        s === OrderStatus.completed
    )
  ) {
    return OrderStatus.confirmed;
  }

  return OrderStatus.pending;
}

function sellerContact(
  buyer: BuyerContact,
  payment: PaymentStatus,
  status: OrderStatus,
  secondaryPhone: string | null = null
) {
  const unlocked =
    payment === PaymentStatus.paid &&
    status === OrderStatus.confirmed;

  return {
    id: buyer.id,
    name: buyer.name,
    campus: buyer.campus,
    phone: unlocked ? buyer.phone : null,
    secondaryPhone: unlocked ? secondaryPhone : null,
    phoneUnlocked: unlocked,
    phoneAvailable: unlocked && Boolean(buyer.phone),
  };
}

function sellerPickup(
  snapshot: PickupSnapshot | null,
  legacy: string | null,
  isOnlySeller: boolean
) {
  // Legacy order-wide locations must never leak
  // across sellers in multi-vendor orders.
  const location = snapshot
    ? [snapshot.label, snapshot.detail]
        .filter(Boolean)
        .join(" - ")
    : isOnlySeller
      ? legacy?.trim() || null
      : null;

  return {
    pickupLocation: location,
    pickupPoint: snapshot
      ? {
          type: snapshot.type,
          label: snapshot.label,
          detail: snapshot.detail,
        }
      : null,

    pickupLocationUnlocked: Boolean(location),
    pickupLocationAvailable: Boolean(location),

    // Compatibility fields only.
    // Legacy preferred-slot data is never seller-facing.
    preferredSlot: null,
    preferredSlotUnlocked: false,
    preferredSlotAvailable: false,
  };
}

const orderItemInclude = {
  product: {
    select: {
      id: true,
      slug: true,
      title: true,
      images: true,
    },
  },

  vendor: {
    select: {
      id: true,
      name: true,
      vendorProfile: {
        select: {
          businessName: true,
          pickupLocation: true,
          verified: true,
        },
      },
    },
  },
};

/*
 * BUYER ORDERS
 */

export async function getMyOrders(
  req: AuthenticatedRequest,
  res: Response
) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required.",
    });
  }

  try {
    const orders = await prisma.order.findMany({
      where: {
        buyerId: req.user.id,
      },
      include: {
        items: {
          include: orderItemInclude,
        },
        vendorPickupSelections: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.status(200).json({
      success: true,
      orders,
      count: orders.length,
    });
  } catch (error) {
    console.error("Get buyer orders error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to load your orders.",
    });
  }
}

/*
 * BUYER FULFILMENT CODES
 */

export async function getBuyerFulfillmentCodes(
  req: AuthenticatedRequest,
  res: Response
) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required.",
    });
  }

  const orderId = String(req.params.id ?? "").trim();

  if (!orderId) {
    return res.status(400).json({
      success: false,
      message: "Invalid order ID.",
    });
  }

  try {
    const order = await prisma.order.findUnique({
      where: {
        id: orderId,
      },

      select: {
        id: true,
        buyerId: true,

        items: {
          select: {
            vendorId: true,
            status: true,

            vendor: {
              select: {
                id: true,
                name: true,

                vendorProfile: {
                  select: {
                    businessName: true,
                  },
                },
              },
            },
          },
        },

        vendorFulfillments: {
          select: {
            vendorId: true,
            codeCiphertext: true,
            verifiedAt: true,
          },
        },
      },
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found.",
      });
    }

    if (order.buyerId !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "You do not have access to this order.",
      });
    }

    const grouped = new Map<string, typeof order.items>();

    for (const item of order.items) {
      const entries = grouped.get(item.vendorId) ?? [];

      entries.push(item);
      grouped.set(item.vendorId, entries);
    }

    const fulfilments = new Map(
      order.vendorFulfillments.map((f) => [
        f.vendorId,
        f,
      ])
    );

    const portions = Array.from(grouped.entries()).map(
      ([vendorId, items]) => {
        const status = portionStatus(
          items.map((i) => i.status)
        );

        const vendor = items[0]?.vendor;
        const fulfilment = fulfilments.get(vendorId);

        const code =
          status === OrderStatus.confirmed &&
          fulfilment &&
          !fulfilment.verifiedAt
            ? decryptFulfillmentCode(
                fulfilment.codeCiphertext
              )
            : null;

        return {
          vendorId,
          sellerName:
            vendor?.vendorProfile?.businessName ||
            vendor?.name ||
            "CampusMart seller",
          status,
          code,
          codeAvailable: Boolean(code),
          verified: Boolean(fulfilment?.verifiedAt),
        };
      }
    );

    return res.status(200).json({
      success: true,
      orderId: order.id,
      portions,
    });
  } catch (error) {
    console.error(
      "Get buyer fulfillment codes error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Unable to load fulfilment codes.",
    });
  }
}

/*
 * SELLER ORDER HISTORY
 */

export async function getVendorOrders(
  req: AuthenticatedRequest,
  res: Response
) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required.",
    });
  }

  const vendorId = req.user.id;

  try {
    const orders = await prisma.order.findMany({
      where: {
        items: {
          some: {
            vendorId,
          },
        },
      },

      include: {
        buyer: {
          select: {
            id: true,
            name: true,
            campus: true,
            phone: true,
          },
        },

        // Load vendor IDs for determining if a historical
        // order is single-seller. Filter before responding.
        items: {
          include: {
            product: {
              select: {
                id: true,
                slug: true,
                title: true,
                images: true,
              },
            },
          },
        },

        vendorPickupSelections: {
          where: {
            vendorId,
          },
          select: {
            type: true,
            label: true,
            detail: true,
          },
        },
      },

      orderBy: {
        createdAt: "desc",
      },
    });

    const enrichedOrders = orders.map((order) => {
      const ownItems = order.items.filter(
        (item) => item.vendorId === vendorId
      );

      const vendorStatus = portionStatus(
        ownItems.map((item) => item.status)
      );

      const isOnlySeller =
        new Set(order.items.map((item) => item.vendorId))
          .size === 1;

      const snapshot =
        order.vendorPickupSelections[0] ?? null;

      const {
        buyer,
        pickupLocation,
        preferredSlot: _preferredSlot,
        secondaryPhone: _privateSecondaryPhone,
        vendorPickupSelections: _allSelections,
        items: _allItems,
        ...rest
      } = order;

      return {
        ...rest,
        items: ownItems,
        ...sellerPickup(
          snapshot,
          pickupLocation,
          isOnlySeller
        ),

        buyer: sellerContact(
          buyer,
          order.paymentStatus,
          vendorStatus,
          order.secondaryPhone
        ),

        vendorStatus,
      };
    });

    return res.status(200).json({
      success: true,

      summary: {
        orderCount: enrichedOrders.length,

        pendingOrderCount: enrichedOrders.filter(
          (o) =>
            o.items.some(
              (i) => i.status === OrderStatus.pending
            )
        ).length,

        itemCount: enrichedOrders.reduce(
          (total, o) =>
            total +
            o.items.reduce(
              (qty, i) => qty + i.quantity,
              0
            ),
          0
        ),

        revenue: enrichedOrders.reduce((total, o) => {
          if (o.paymentStatus !== PaymentStatus.paid) {
            return total;
          }

          return (
            total +
            o.items.reduce(
              (sum, i) =>
                i.status === OrderStatus.completed
                  ? sum + i.lineTotal
                  : sum,
              0
            )
          );
        }, 0),
      },

      orders: enrichedOrders,
    });
  } catch (error) {
    console.error("Get vendor orders error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to load vendor orders.",
    });
  }
}

/*
 * SECURE FOUR-DIGIT CODE VERIFICATION
 */

export async function verifyVendorFulfillmentCode(
  req: AuthenticatedRequest,
  res: Response
) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required.",
    });
  }

  const vendorId = req.user.id;
  const orderId = String(req.params.id ?? "").trim();
  const code =
    typeof req.body?.code === "string"
      ? req.body.code.trim()
      : "";

  if (!orderId) {
    return res.status(400).json({
      success: false,
      message: "Invalid order ID.",
    });
  }

  if (!isValidFulfillmentCode(code)) {
    return res.status(400).json({
      success: false,
      message:
        "Enter the 4-digit fulfilment code provided by the buyer.",
    });
  }

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const order = await tx.order.findUnique({
          where: {
            id: orderId,
          },

          include: {
            items: {
              where: {
                vendorId,
              },
              select: {
                id: true,
                status: true,
              },
            },
          },
        });

        if (!order) {
          throw new OrderInputError("Order not found.");
        }

        if (!order.items.length) {
          throw new OrderInputError(
            "This order does not contain any of your products."
          );
        }

        const status = portionStatus(
          order.items.map((item) => item.status)
        );

        if (status === OrderStatus.completed) {
          return {
            alreadyCompleted: true,
            orderId,
            vendorStatus: OrderStatus.completed,
          };
        }

        if (status === OrderStatus.cancelled) {
          throw new OrderInputError(
            "A cancelled order cannot be completed."
          );
        }

        if (status !== OrderStatus.confirmed) {
          throw new OrderInputError(
            "Confirm this order before attempting fulfilment."
          );
        }

        const fulfilment =
          await tx.orderVendorFulfillment.findUnique({
            where: {
              orderId_vendorId: {
                orderId,
                vendorId,
              },
            },
          });

        if (!fulfilment) {
          throw new OrderInputError(
            "A fulfilment code is not available for this order."
          );
        }

        if (fulfilment.verifiedAt) {
          return {
            alreadyCompleted: true,
            orderId,
            vendorStatus: OrderStatus.completed,
          };
        }

        const now = new Date();

        if (
          fulfilment.lockedUntil &&
          fulfilment.lockedUntil > now
        ) {
          return {
            locked: true,
            lockedUntil: fulfilment.lockedUntil,
          };
        }

        if (
          !verifyFulfillmentCodeHash(
            code,
            fulfilment.codeHash
          )
        ) {
          const previousAttempts =
            fulfilment.lockedUntil &&
            fulfilment.lockedUntil <= now
              ? 0
              : fulfilment.failedAttemptCount;

          const nextAttempts = previousAttempts + 1;

          const shouldLock =
            nextAttempts >= MAX_FULFILLMENT_ATTEMPTS;

          const lockedUntil = shouldLock
            ? new Date(
                now.getTime() +
                  FULFILLMENT_LOCK_MINUTES * 60_000
              )
            : null;

          await tx.orderVendorFulfillment.update({
            where: {
              id: fulfilment.id,
            },

            data: {
              failedAttemptCount: shouldLock
                ? 0
                : nextAttempts,

              lastFailedAttemptAt: now,
              lockedUntil,
            },
          });

          return {
            incorrect: true,

            attemptsRemaining: shouldLock
              ? 0
              : MAX_FULFILLMENT_ATTEMPTS -
                nextAttempts,

            lockedUntil,
          };
        }

        await tx.orderVendorFulfillment.update({
          where: {
            id: fulfilment.id,
          },

          data: {
            verifiedAt: now,
            failedAttemptCount: 0,
            lastFailedAttemptAt: null,
            lockedUntil: null,
          },
        });

        await tx.orderItem.updateMany({
          where: {
            orderId,
            vendorId,
            status: OrderStatus.confirmed,
          },

          data: {
            status: OrderStatus.completed,
          },
        });

        const remainingItems =
          await tx.orderItem.findMany({
            where: {
              orderId,
            },
            select: {
              status: true,
            },
          });

        const overallStatus = portionStatus(
          remainingItems.map((item) => item.status)
        );

        await tx.order.update({
          where: {
            id: orderId,
          },
          data: {
            status: overallStatus,
          },
        });

        if (order.paymentStatus === PaymentStatus.paid) await settleVerifiedSeller(tx, orderId, vendorId);

        await tx.notification.create({
          data: {
            userId: order.buyerId,
            type: NotificationType.order_completed,

            title:
              overallStatus === OrderStatus.completed
                ? "Order completed"
                : "Handoff completed",

            message:
              overallStatus === OrderStatus.completed
                ? "Your CampusMart order has been completed."
                : `${req.user?.name || "A seller"} completed their part of your order.`,

            href: "/buyer/orders",
            orderId,
          },
        });

        return {
          completed: true,
          orderId,
          vendorStatus: OrderStatus.completed,
          overallStatus,
        };
      }
    );

    if ("locked" in result && result.locked) {
      return res.status(429).json({
        success: false,
        code: "FULFILLMENT_CODE_LOCKED",
        message:
          "Too many incorrect attempts. Try again later.",
        lockedUntil: result.lockedUntil,
      });
    }

    if ("incorrect" in result && result.incorrect) {
      if (result.lockedUntil) {
        return res.status(429).json({
          success: false,
          code: "FULFILLMENT_CODE_LOCKED",
          message:
            "Too many incorrect attempts. Fulfilment-code entry has been temporarily locked.",
          lockedUntil: result.lockedUntil,
        });
      }

      return res.status(400).json({
        success: false,
        code: "INCORRECT_FULFILLMENT_CODE",
        message: "That fulfilment code is incorrect.",
        attemptsRemaining: result.attemptsRemaining,
      });
    }

    if (
      "alreadyCompleted" in result &&
      result.alreadyCompleted
    ) {
      return res.status(200).json({
        success: true,
        message:
          "This order has already been completed.",
        orderId: result.orderId,
        vendorStatus: result.vendorStatus,
      });
    }

    return res.status(200).json({
      success: true,
      message:
        "Fulfilment confirmed. Your seller portion of the order is now complete.",
      orderId: result.orderId,
      vendorStatus: result.vendorStatus,
      overallStatus:
        "overallStatus" in result
          ? result.overallStatus
          : undefined,
    });
  } catch (error) {
    if (error instanceof OrderInputError) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    console.error(
      "Verify vendor fulfillment code error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Unable to verify fulfilment.",
    });
  }
}

/*
 * SINGLE ORDER
 */

export async function getOrderById(
  req: AuthenticatedRequest,
  res: Response
) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required.",
    });
  }

  const orderId = String(req.params.id ?? "").trim();

  if (!orderId) {
    return res.status(400).json({
      success: false,
      message: "Invalid order ID.",
    });
  }

  try {
    const order = await prisma.order.findUnique({
      where: {
        id: orderId,
      },

      include: {
        buyer: {
          select: {
            id: true,
            name: true,
            campus: true,
            phone: true,
          },
        },

        items: {
          include: orderItemInclude,
        },

        vendorPickupSelections: true,
      },
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found.",
      });
    }

    if (order.buyerId === req.user.id) {
      return res.status(200).json({
        success: true,
        order,
      });
    }

    if (req.user.role === UserRole.vendor) {
      const vendorId = req.user.id;

      const ownItems = order.items.filter(
        (item) => item.vendorId === vendorId
      );

      if (ownItems.length) {
        const status = portionStatus(
          ownItems.map((item) => item.status)
        );

        const snapshot =
          order.vendorPickupSelections.find(
            (entry) => entry.vendorId === vendorId
          ) ?? null;

        const isOnlySeller =
          new Set(
            order.items.map((item) => item.vendorId)
          ).size === 1;

        return res.status(200).json({
          success: true,

          order: {
            id: order.id,
            status: order.status,
            vendorStatus: status,
            paymentStatus: order.paymentStatus,

            ...sellerPickup(
              snapshot,
              order.pickupLocation,
              isOnlySeller
            ),

            createdAt: order.createdAt,
            updatedAt: order.updatedAt,

            buyer: sellerContact(
              order.buyer,
              order.paymentStatus,
              status,
              order.secondaryPhone
            ),

            items: ownItems,

            vendorSubtotal: ownItems.reduce(
              (sum, item) => sum + item.lineTotal,
              0
            ),
          },
        });
      }
    }

    return res.status(403).json({
      success: false,
      message: "You do not have access to this order.",
    });
  } catch (error) {
    console.error("Get order error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to load this order.",
    });
  }
}
