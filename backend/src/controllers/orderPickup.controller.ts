
import type { Response } from "express";

import {
  OrderStatus,
  PickupPointType,
  UserRole,
} from "../generated/prisma/client";

import { prisma } from "../lib/prisma";

import type {
  AuthenticatedRequest,
} from "../middleware/auth.middleware";

type BuyerPickupSelection = {
  id: string | null;
  vendorId: string;
  sellerName: string;
  businessName: string;
  pickupPointId: string | null;
  type: PickupPointType;
  label: string;
  detail: string | null;
  isLegacy: boolean;
};

function portionStatus(
  statuses: OrderStatus[]
): OrderStatus {
  if (!statuses.length) {
    return OrderStatus.pending;
  }

  if (
    statuses.every(
      (status) => status === OrderStatus.cancelled
    )
  ) {
    return OrderStatus.cancelled;
  }

  if (
    statuses.every(
      (status) =>
        status === OrderStatus.completed ||
        status === OrderStatus.cancelled
    )
  ) {
    return OrderStatus.completed;
  }

  if (
    statuses.some(
      (status) =>
        status === OrderStatus.confirmed ||
        status === OrderStatus.completed
    )
  ) {
    return OrderStatus.confirmed;
  }

  return OrderStatus.pending;
}

export async function getOrderPickupSelections(
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
        paymentStatus: true,
        pickupLocation: true,
        preferredSlot: true,

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

        vendorPickupSelections: {
          select: {
            id: true,
            vendorId: true,
            pickupPointId: true,
            type: true,
            label: true,
            detail: true,
            createdAt: true,
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

    const vendorIds = Array.from(
      new Set(
        order.items.map((item) => item.vendorId)
      )
    );

    /*
     * BUYER VIEW
     */

    if (order.buyerId === req.user.id) {
      const pickupSelections =
        vendorIds.flatMap<BuyerPickupSelection>(
          (vendorId) => {
            const item = order.items.find(
              (entry) => entry.vendorId === vendorId
            );

            const vendor = item?.vendor;

            const sellerName =
              vendor?.name ?? "CampusMart seller";

            const businessName =
              vendor?.vendorProfile?.businessName ??
              sellerName;

            const snapshot =
              order.vendorPickupSelections.find(
                (entry) => entry.vendorId === vendorId
              );

            if (snapshot) {
              return [
                {
                  id: snapshot.id,
                  vendorId,
                  sellerName,
                  businessName,
                  pickupPointId: snapshot.pickupPointId,
                  type: snapshot.type,
                  label: snapshot.label,
                  detail: snapshot.detail,
                  isLegacy:
                    snapshot.pickupPointId === null,
                },
              ];
            }

            if (
              vendorIds.length === 1 &&
              order.pickupLocation?.trim()
            ) {
              return [
                {
                  id: null,
                  vendorId,
                  sellerName,
                  businessName,
                  pickupPointId: null,
                  type: PickupPointType.custom,
                  label: order.pickupLocation.trim(),
                  detail: null,
                  isLegacy: true,
                },
              ];
            }

            return [];
          }
        );

      return res.status(200).json({
        success: true,
        orderId: order.id,
        pickupSelections,

        preferredSlot: order.preferredSlot,

        delivery: {
          available: false,
          label: "Door delivery",
          message: "Coming soon",
        },
      });
    }

    /*
     * SELLER VIEW
     */

    if (req.user.role !== UserRole.vendor) {
      return res.status(403).json({
        success: false,
        message:
          "You do not have access to this order.",
      });
    }

    const vendorId = req.user.id;

    const ownItems = order.items.filter(
      (item) => item.vendorId === vendorId
    );

    if (!ownItems.length) {
      return res.status(403).json({
        success: false,
        message:
          "You do not have access to this order.",
      });
    }

    const snapshot =
      order.vendorPickupSelections.find(
        (entry) => entry.vendorId === vendorId
      );

    const legacy =
      !snapshot &&
      vendorIds.length === 1 &&
      order.pickupLocation?.trim()
        ? {
            id: null,
            vendorId,
            pickupPointId: null,
            type: PickupPointType.custom,
            label: order.pickupLocation.trim(),
            detail: null,
            isLegacy: true,
          }
        : null;

    const selection = snapshot
      ? {
          id: snapshot.id,
          vendorId: snapshot.vendorId,
          pickupPointId: snapshot.pickupPointId,
          type: snapshot.type,
          label: snapshot.label,
          detail: snapshot.detail,
          isLegacy:
            snapshot.pickupPointId === null,
        }
      : legacy;

    return res.status(200).json({
      success: true,
      orderId: order.id,

      vendorStatus: portionStatus(
        ownItems.map((item) => item.status)
      ),

      paymentStatus: order.paymentStatus,

      pickupUnlocked: Boolean(selection),
      pickupSelected: Boolean(selection),
      pickupSelection: selection,

      preferredSlotUnlocked: false,
      preferredSlot: null,
    });
  } catch (error) {
    console.error(
      "Get order pickup selections error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to load order pickup information.",
    });
  }
}
