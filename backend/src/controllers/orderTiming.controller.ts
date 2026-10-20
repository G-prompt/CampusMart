
import type { Response } from "express";
import {
  NotificationType,
  OrderStatus,
  PaymentStatus,
} from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import type { AuthenticatedRequest } from "../middleware/auth.middleware";
import {
  createFulfillmentCodeMaterial,
} from "../services/fulfillmentCode.service";

const HOUR_MS = 60 * 60 * 1000;
const CONFIRMATION_MS = 24 * HOUR_MS;
import { handoffDeadline } from "../services/orderDeadline.service";
import { refundCancelledSeller, refundOrderFeeIfFullyCancelled } from "../services/orderFunds.service";

class OrderInputError extends Error {}

function portionStatus(
  statuses: OrderStatus[]
): OrderStatus {
  if (!statuses.length) return OrderStatus.pending;

  if (
    statuses.every(
      (s) => s === OrderStatus.cancelled
    )
  ) {
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

export async function getOrderTimings(
  req: AuthenticatedRequest,
  res: Response
) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required.",
    });
  }

  const accountId = req.user.id;

  try {
    const orders = await prisma.order.findMany({
      where: {
        OR: [
          {
            buyerId: accountId,
          },
          {
            items: {
              some: {
                vendorId: accountId,
              },
            },
          },
        ],
      },

      select: {
        id: true,
        buyerId: true,
        createdAt: true,

        items: {
          select: {
            vendorId: true,
            status: true,
          },
        },

        vendorFulfillments: {
          select: {
            vendorId: true,
            confirmedAt: true,
            deliveryDueAt: true,
            readyAt: true,
          },
        },
      },

      orderBy: {
        createdAt: "desc",
      },
    });

    const timings = orders.flatMap((order) => {
      const byVendor =
        new Map<string, OrderStatus[]>();

      for (const item of order.items) {
        const group =
          byVendor.get(item.vendorId) ?? [];

        group.push(item.status);
        byVendor.set(item.vendorId, group);
      }

      return Array.from(
        byVendor,
        ([vendorId, statuses]) => {
          if (
            order.buyerId !== accountId &&
            vendorId !== accountId
          ) {
            return null;
          }

          const record =
            order.vendorFulfillments.find(
              (entry) => entry.vendorId === vendorId
            );

          return {
            orderId: order.id,
            vendorId,
            status: portionStatus(statuses),

            confirmationDueAt: new Date(
              order.createdAt.getTime() +
                CONFIRMATION_MS
            ).toISOString(),

            confirmedAt:
              record?.confirmedAt?.toISOString() ??
              null,

            deliveryDueAt:
              record?.deliveryDueAt?.toISOString() ??
              null,
            readyAt: record?.readyAt?.toISOString() ?? null,
          };
        }
      ).filter((item) => item !== null);
    });

    return res.status(200).json({
      success: true,
      timings,
    });
  } catch (error) {
    console.error(
      "Get order timings error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to load order timing information.",
    });
  }
}

export async function updateVendorOrderStatusWithTiming(
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

  const requested = String(
    req.body?.status ?? ""
  )
    .trim()
    .toLowerCase();

  if (!orderId) {
    return res.status(400).json({
      success: false,
      message: "Invalid order ID.",
    });
  }

  if (requested === OrderStatus.completed) {
    return res.status(400).json({
      success: false,
      code: "FULFILLMENT_CODE_REQUIRED",
      message:
        "Complete this order using the buyer's 4-digit fulfilment code.",
    });
  }

  if (
    requested !== OrderStatus.confirmed &&
    requested !== OrderStatus.cancelled
  ) {
    return res.status(400).json({
      success: false,
      message:
        "Status must be confirmed or cancelled.",
    });
  }

  const nextStatus = requested as OrderStatus;

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const order = await tx.order.findUnique({
          where: {
            id: orderId,
          },

          include: {
            items: {
              select: {
                id: true,
                vendorId: true,
                status: true,
              },
            },
          },
        });

        if (!order) {
          throw new OrderInputError(
            "Order not found."
          );
        }

        const ownItems = order.items.filter(
          (item) => item.vendorId === vendorId
        );

        if (!ownItems.length) {
          throw new OrderInputError(
            "This order does not contain any of your products."
          );
        }

        const changed = ownItems.some(
          (item) => item.status !== nextStatus
        );

        for (const item of ownItems) {
          if (item.status === nextStatus) {
            continue;
          }

          const valid =
            (item.status === OrderStatus.pending &&
              (nextStatus ===
                OrderStatus.confirmed ||
                nextStatus ===
                  OrderStatus.cancelled)) ||
            (item.status === OrderStatus.confirmed &&
              nextStatus ===
                OrderStatus.cancelled);

          if (!valid) {
            throw new OrderInputError(
              `Cannot change an item from ${item.status} to ${nextStatus}.`
            );
          }
        }

        await tx.orderItem.updateMany({
          where: {
            orderId,
            vendorId,
          },

          data: {
            status: nextStatus,
          },
        });

        if (
          nextStatus === OrderStatus.confirmed &&
          changed
        ) {
          const existing =
            await tx.orderVendorFulfillment.findUnique({
              where: {
                orderId_vendorId: {
                  orderId,
                  vendorId,
                },
              },

              select: {
                id: true,
              },
            });

          if (!existing) {
            const material =
              createFulfillmentCodeMaterial();

            await tx.orderVendorFulfillment.create({
              data: {
                orderId,
                vendorId,

                codeHash: material.codeHash,
                codeCiphertext:
                  material.codeCiphertext,

                codeCreatedAt: new Date(),
              },
            });
          }

          const confirmedAt = new Date();

          await tx.orderVendorFulfillment.updateMany({
            where: {
              orderId,
              vendorId,
              confirmedAt: null,
            },

            data: {
              confirmedAt,

              deliveryDueAt: handoffDeadline(confirmedAt),
            },
          });
        }

        const allItems =
          await tx.orderItem.findMany({
            where: {
              orderId,
            },

            select: {
              vendorId: true,
              status: true,
            },
          });

        if (nextStatus === OrderStatus.cancelled && changed && order.paymentStatus === PaymentStatus.paid) {
          await refundCancelledSeller(tx, orderId, order.buyerId, vendorId);
          await refundOrderFeeIfFullyCancelled(tx, orderId, order.buyerId, order.fee,
            allItems.every((item) => item.status === OrderStatus.cancelled));
        }
        const overallStatus = portionStatus(
          allItems.map((item) => item.status)
        );

        const isOnlySeller =
          new Set(
            allItems.map((item) => item.vendorId)
          ).size === 1;

        const updatedOrder = await tx.order.update({
          where: {
            id: orderId,
          },

          data: {
            status: overallStatus,
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
              where: {
                vendorId,
              },

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
        });

        if (changed) {
          await tx.notification.create({
            data: {
              userId: updatedOrder.buyerId,

              type:
                nextStatus === OrderStatus.confirmed
                  ? NotificationType.order_confirmed
                  : NotificationType.order_cancelled,

              title:
                nextStatus === OrderStatus.confirmed
                  ? "Order confirmed"
                  : "Order cancelled",

              message:
                nextStatus === OrderStatus.confirmed
                  ? `${req.user?.name || "A seller"} confirmed their part of your order.`
                  : `${req.user?.name || "A seller"} cancelled their part of your order.`,

              href: "/buyer/orders",
              orderId,
            },
          });
        }

        const vendorStatus = portionStatus(
          updatedOrder.items.map(
            (item) => item.status
          )
        );

        const pickup =
          updatedOrder.vendorPickupSelections[0] ??
          null;

        const location = pickup
          ? [pickup.label, pickup.detail]
              .filter(Boolean)
              .join(" - ")
          : isOnlySeller
            ? updatedOrder.pickupLocation?.trim() ||
              null
            : null;

        const phoneUnlocked =
          updatedOrder.paymentStatus ===
            PaymentStatus.paid &&
          vendorStatus === OrderStatus.confirmed;

        const timing =
          await tx.orderVendorFulfillment.findUnique({
            where: {
              orderId_vendorId: {
                orderId,
                vendorId,
              },
            },

            select: {
              confirmedAt: true,
              deliveryDueAt: true,
            readyAt: true,
            },
          });

        const {
          buyer,
          pickupLocation: _legacyLocation,
          preferredSlot: _legacySlot,
          secondaryPhone: _privateSecondary,
          vendorPickupSelections: _pickupSelections,
          ...safeOrder
        } = updatedOrder;

        return {
          ...safeOrder,

          vendorStatus,

          pickupLocation: location,

          pickupPoint: pickup
            ? {
                type: pickup.type,
                label: pickup.label,
                detail: pickup.detail,
              }
            : null,

          pickupLocationUnlocked:
            Boolean(location),

          pickupLocationAvailable:
            Boolean(location),

          preferredSlot: null,
          preferredSlotUnlocked: false,
          preferredSlotAvailable: false,

          buyer: {
            id: buyer.id,
            name: buyer.name,
            campus: buyer.campus,

            phone: phoneUnlocked
              ? buyer.phone
              : null,
            secondaryPhone: phoneUnlocked ? updatedOrder.secondaryPhone : null,

            phoneUnlocked,

            phoneAvailable:
              phoneUnlocked &&
              Boolean(buyer.phone),
          },

          confirmedAt:
            timing?.confirmedAt ?? null,

          deliveryDueAt:
            timing?.deliveryDueAt ?? null,
          readyAt: timing?.readyAt ?? null,
        };
      }
    );

    return res.status(200).json({
      success: true,

      message:
        nextStatus === OrderStatus.confirmed
          ? "Order confirmed. The buyer's fulfilment code is now active."
          : "Order cancelled.",

      order: result,
    });
  } catch (error) {
    if (error instanceof OrderInputError) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    console.error(
      "Update seller order timing status error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Unable to update order status.",
    });
  }
}
