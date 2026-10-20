import {
  Response,
} from "express";

import {
  NotificationType,
  OrderStatus,
  PaymentStatus,
  PickupPointType,
} from "../generated/prisma/client";

import {
  prisma,
} from "../lib/prisma";

import type {
  AuthenticatedRequest,
} from "../middleware/auth.middleware";

import {
  createFulfillmentCodeMaterial,
} from "../services/fulfillmentCode.service";

import {
  evaluateSellerState,
  sellerEligibilityStateSelect,
} from "../services/sellerEligibility.service";

class OrderInputError extends Error {}
class InsufficientFundsError extends Error {}

type RequestedOrderItem = {
  productId: number;
  quantity: number;
  selectedSize: string | null;
  selectedColor: string | null;
};

type RequestedPickupSelection = {
  vendorId: string;
  pickupPointId: string;
};

function cleanOptionalText(
  value:
    unknown
): string | null {
  if (
    typeof value !==
    "string"
  ) {
    return null;
  }

  const cleaned =
    value.trim();

  return cleaned ||
    null;
}

function safeBuyerName(
  value:
    unknown
) {
  if (
    typeof value !==
    "string"
  ) {
    return "A buyer";
  }

  return value.trim() ||
    "A buyer";
}

function normalizeOrderItems(
  value:
    unknown
): RequestedOrderItem[] | null {
  if (
    !Array.isArray(
      value
    )
  ) {
    return null;
  }

  const merged =
    new Map<
      string,
      RequestedOrderItem
    >();

  for (
    const entry of
    value
  ) {
    if (
      !entry ||
      typeof entry !==
        "object"
    ) {
      return null;
    }

    const raw =
      entry as {
        productId?: unknown;
        quantity?: unknown;
        selectedSize?: unknown;
        selectedColor?: unknown;
      };

    const productId =
      Number(
        raw.productId
      );

    const quantity =
      Number(
        raw.quantity
      );

    if (
      !Number.isInteger(
        productId
      ) ||
      productId <=
        0 ||
      !Number.isInteger(
        quantity
      ) ||
      quantity <=
        0 ||
      quantity >
        99
    ) {
      return null;
    }

    const selectedSize =
      cleanOptionalText(
        raw.selectedSize
      );

    const selectedColor =
      cleanOptionalText(
        raw.selectedColor
      );

    const key =
      [
        productId,
        selectedSize ??
          "",
        selectedColor ??
          "",
      ].join(
        "::"
      );

    const existing =
      merged.get(
        key
      );

    const nextQuantity =
      (
        existing?.quantity ??
        0
      ) +
      quantity;

    if (
      nextQuantity >
      99
    ) {
      return null;
    }

    merged.set(
      key,
      {
        productId,
        quantity:
          nextQuantity,
        selectedSize,
        selectedColor,
      }
    );
  }

  return Array.from(
    merged.values()
  );
}

function normalizePickupSelections(
  value:
    unknown
):
  | RequestedPickupSelection[]
  | null {
  if (
    value ===
      undefined ||
    value ===
      null
  ) {
    return [];
  }

  if (
    !Array.isArray(
      value
    )
  ) {
    return null;
  }

  const vendorIds =
    new Set<string>();

  const selections:
    RequestedPickupSelection[] =
    [];

  for (
    const entry of
    value
  ) {
    if (
      !entry ||
      typeof entry !==
        "object"
    ) {
      return null;
    }

    const raw =
      entry as {
        vendorId?: unknown;
        pickupPointId?: unknown;
      };

    const vendorId =
      typeof raw.vendorId ===
      "string"
        ? raw.vendorId.trim()
        : "";

    const pickupPointId =
      typeof raw.pickupPointId ===
      "string"
        ? raw.pickupPointId.trim()
        : "";

    if (
      !vendorId ||
      !pickupPointId ||
      vendorIds.has(
        vendorId
      )
    ) {
      return null;
    }

    vendorIds.add(
      vendorId
    );

    selections.push({
      vendorId,
      pickupPointId,
    });
  }

  return selections;
}

function calculateFee(subtotal: number) { return subtotal > 0 ? 100 : 0; }

const orderItemInclude = {
  product: {
    select: {
      id:
        true,

      slug:
        true,

      title:
        true,

      images:
        true,
    },
  },

  vendor: {
    select: {
      id:
        true,

      name:
        true,

      vendorProfile: {
        select: {
          businessName:
            true,

          pickupLocation:
            true,

          verified:
            true,
        },
      },
    },
  },
};

export const createOrder =
  async (
    req:
      AuthenticatedRequest,
    res:
      Response
  ) => {
    try {
      if (
        !req.user
      ) {
        return res
          .status(401)
          .json({
            success:
              false,

            message:
              "Authentication required.",
          });
      }

      const {
        items,
        pickupSelections,
        pickupLocation,
        preferredSlot,
        secondaryPhone,
        checkoutKey,
      } =
        req.body;

      const requestedItems =
        normalizeOrderItems(
          items
        );

      const requestedPickupSelections =
        normalizePickupSelections(
          pickupSelections
        );

      if (
        !requestedItems ||
        requestedItems.length ===
          0
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Your order must contain at least one valid item.",
          });
      }

      if (
        requestedPickupSelections ===
        null
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Invalid pickup selection.",
          });
      }

      const cleanLegacyPickup =
        cleanOptionalText(
          pickupLocation
        );

      // Legacy order-wide pickup text cannot authenticate seller agreement
      // and would bypass the campus/university rules. Require snapshots.
      if (cleanLegacyPickup) {
        return res.status(400).json({
          success: false,
          code: "LEGACY_PICKUP_UNSUPPORTED",
          message: "Refresh checkout and choose a current pickup method.",
        });
      }

      const cleanPreferredSlot =
        cleanOptionalText(
          preferredSlot
        );

      // Explicit pickup modes prevent ambiguous or unchecked shared locations.
      const pickupMode = req.body?.pickupMode === undefined
        ? "seller_points"
        : req.body.pickupMode;

      if (pickupMode !== "seller_points" && pickupMode !== "shared_campus") {
        return res.status(400).json({ success: false, code: "INVALID_PICKUP_MODE", message: "Choose a valid pickup method." });
      }

      const sharedCampusLocation = cleanOptionalText(req.body?.campusMeetupLocation)
        ?.replace(/\s+/g, " ") ?? null;

      if (pickupMode === "shared_campus") {
        if (
          !sharedCampusLocation ||
          sharedCampusLocation.length < 5 ||
          sharedCampusLocation.length > 120 ||
          /(?:https?:|www\.|@)/i.test(sharedCampusLocation) ||
          /\+?\d[\d\s()\-]{7,}\d/.test(sharedCampusLocation)
        ) {
          return res.status(400).json({
            success: false,
            code: "INVALID_CAMPUS_MEETUP",
            message: "Enter a clear campus meeting place (5–120 characters, no contact details).",
          });
        }
        if (requestedPickupSelections.length || cleanLegacyPickup) {
          return res.status(400).json({ success: false, code: "PICKUP_MODE_CONFLICT", message: "Choose either a shared campus meetup or seller pickup points." });
        }
      } else if (sharedCampusLocation) {
        return res.status(400).json({ success: false, code: "PICKUP_MODE_CONFLICT", message: "Choose a pickup mode for the location supplied." });
      }

      const safeSecondaryPhone = cleanOptionalText(secondaryPhone);
      if (safeSecondaryPhone && !/^\+?[0-9 ()-]{7,20}$/.test(safeSecondaryPhone)) {
        return res.status(400).json({ success:false, code:"INVALID_SECONDARY_PHONE", message:"Enter a valid secondary phone." });
      }
      if (typeof checkoutKey !== "string" || !/^[a-f0-9-]{36}$/i.test(checkoutKey)) {
        return res.status(400).json({ success:false, code:"CHECKOUT_KEY_REQUIRED", message:"Refresh checkout and try again." });
      }
      const buyerId =
        req.user.id;

      const buyerName =
        safeBuyerName(
          req.user.name
        );

      const prior = await prisma.order.findUnique({ where: { checkoutKey }, select: { id: true, buyerId: true } });
      if (prior) {
        if (prior.buyerId !== buyerId) return res.status(409).json({ success:false, message:"Checkout reference is already used." });
        const existing = await prisma.order.findUnique({ where: { id: prior.id }, include: { items: { include: orderItemInclude }, vendorPickupSelections: true } });
        return res.status(200).json({ success:true, order: existing, message:"Order already placed." });
      }
      const order =
        await prisma.$transaction(
          async (
            tx
          ) => {
            const productIds =
              Array.from(
                new Set(
                  requestedItems.map(
                    (
                      item
                    ) =>
                      item.productId
                  )
                )
              );

            const products =
              await tx.product.findMany({
                where: {
                  id: {
                    in:
                      productIds,
                  },

                  isArchived:
                    false,
                },

                select: {
                  id:
                    true,

                  title:
                    true,

                  price:
                    true,

                  sizes:
                    true,

                  colors:
                    true,

                  vendorId:
                    true,

                  vendor: {
                    select:
                      sellerEligibilityStateSelect,
                  },
                },
              });

            if (
              products.length !==
              productIds.length
            ) {
              throw new OrderInputError(
                "One or more products in your cart are no longer available."
              );
            }

            const sellerUnavailable =
              products.some(
                (
                  product
                ) =>
                  !evaluateSellerState(
                    product.vendor
                  ).canSell
              );

            if (
              sellerUnavailable
            ) {
              throw new OrderInputError(
                "One or more products in your cart are no longer available."
              );
            }

            const productMap =
              new Map(
                products.map(
                  (
                    product
                  ) => [
                    product.id,
                    product,
                  ]
                )
              );

            const sellerStateMap =
              new Map(
                products.map(
                  (
                    product
                  ) => [
                    product.vendorId,
                    product.vendor,
                  ]
                )
              );

            const lineItems =
              requestedItems.map(
                (
                  requested
                ) => {
                  const product =
                    productMap.get(
                      requested.productId
                    );

                  if (
                    !product
                  ) {
                    throw new OrderInputError(
                      "One or more products in your cart are no longer available."
                    );
                  }

                  if (
                    product.vendorId ===
                    buyerId
                  ) {
                    throw new OrderInputError(
                      `You cannot order your own listing: ${product.title}.`
                    );
                  }

                  if (
                    product.sizes.length >
                    0
                  ) {
                    if (
                      !requested.selectedSize ||
                      !product.sizes.includes(
                        requested.selectedSize
                      )
                    ) {
                      throw new OrderInputError(
                        `Choose an available size for ${product.title}.`
                      );
                    }
                  } else if (
                    requested.selectedSize
                  ) {
                    throw new OrderInputError(
                      `The selected size for ${product.title} is no longer available.`
                    );
                  }

                  if (
                    product.colors.length >
                    0
                  ) {
                    if (
                      !requested.selectedColor ||
                      !product.colors.includes(
                        requested.selectedColor
                      )
                    ) {
                      throw new OrderInputError(
                        `Choose an available colour for ${product.title}.`
                      );
                    }
                  } else if (
                    requested.selectedColor
                  ) {
                    throw new OrderInputError(
                      `The selected colour for ${product.title} is no longer available.`
                    );
                  }

                  return {
                    productId:
                      product.id,

                    vendorId:
                      product.vendorId,

                    productTitle:
                      product.title,

                    unitPrice:
                      product.price,

                    quantity:
                      requested.quantity,

                    lineTotal:
                      product.price *
                      requested.quantity,

                    selectedSize:
                      requested.selectedSize,

                    selectedColor:
                      requested.selectedColor,

                    status:
                      OrderStatus.pending,
                  };
                }
              );

            const vendorIds =
              Array.from(
                new Set(
                  lineItems.map(
                    (
                      item
                    ) =>
                      item.vendorId
                  )
                )
              );

            const activePickupPoints =
              await tx.vendorPickupPoint.findMany({
                where: {
                  vendorId: {
                    in:
                      vendorIds,
                  },

                  isActive:
                    true,
                },
              });

            const pointsByVendor =
              new Map<
                string,
                typeof activePickupPoints
              >();

            for (
              const vendorId of
              vendorIds
            ) {
              pointsByVendor.set(
                vendorId,
                activePickupPoints.filter(
                  (
                    point
                  ) =>
                    point.vendorId ===
                    vendorId
                )
              );
            }

            // A shared meeting place is allowed only when the buyer
            // and every participating seller belong to the SAME university.
            // Each vendor still has to confirm its own order portion.
            if (pickupMode === "shared_campus") {
              const participants = await tx.user.findMany({
                where: { id: { in: [buyerId, ...vendorIds] } },
                select: { id: true, universityId: true },
              });
              const buyerUniversity = participants.find((person) => person.id === buyerId)?.universityId;
              if (
                !buyerUniversity ||
                vendorIds.some((id) => participants.find((person) => person.id === id)?.universityId !== buyerUniversity)
              ) {
                throw new OrderInputError("Shared campus meetup is only available when you and all sellers attend the same university. Choose seller pickup points instead.");
              }
            }

            const usingLegacyRequest =
              requestedPickupSelections.length ===
                0 &&
              Boolean(
                cleanLegacyPickup
              );

            const resolvedPickupSelections =
              vendorIds.map(
                (
                  vendorId
                ) => {
                  if (pickupMode === "shared_campus" && sharedCampusLocation) {
                    // Snapshot the same requested location separately
                    // for each vendor, preserving multi-vendor isolation.
                    return {
                      vendorId,
                      pickupPointId: null as string | null,
                      type: PickupPointType.campus,
                      label: "On campus",
                      detail: sharedCampusLocation,
                    };
                  }

                  if (
                    usingLegacyRequest &&
                    cleanLegacyPickup
                  ) {
                    return {
                      vendorId,

                      pickupPointId:
                        null as
                          | string
                          | null,

                      type:
                        PickupPointType.custom,

                      label:
                        cleanLegacyPickup,

                      detail:
                        null as
                          | string
                          | null,
                    };
                  }

                  const requested =
                    requestedPickupSelections.find(
                      (
                        selection
                      ) =>
                        selection.vendorId ===
                        vendorId
                    );

                  if (
                    !requested
                  ) {
                    throw new OrderInputError(
                      "Choose a pickup point for every seller in your order."
                    );
                  }

                  const vendorPoints =
                    pointsByVendor.get(
                      vendorId
                    ) ??
                    [];

                  if (
                    vendorPoints.length >
                    0
                  ) {
                    const point =
                      vendorPoints.find(
                        (
                          candidate
                        ) =>
                          candidate.id ===
                          requested.pickupPointId
                      );

                    if (
                      !point
                    ) {
                      throw new OrderInputError(
                        "One of your selected pickup points is no longer available."
                      );
                    }

                    return {
                      vendorId,

                      pickupPointId:
                        point.id,

                      type:
                        point.type,

                      label:
                        point.label,

                      detail:
                        point.detail,
                    };
                  }

                  const expectedLegacyId =
                    `legacy:${vendorId}`;

                  const sellerState =
                    sellerStateMap.get(
                      vendorId
                    );

                  const legacyLocation =
                    sellerState
                      ?.vendorProfile
                      ?.pickupLocation
                      ?.trim();

                  if (
                    requested.pickupPointId !==
                      expectedLegacyId ||
                    !legacyLocation
                  ) {
                    throw new OrderInputError(
                      "This seller's pickup options have changed. Refresh checkout and choose again."
                    );
                  }

                  return {
                    vendorId,

                    pickupPointId:
                      null as
                        | string
                        | null,

                    type:
                      PickupPointType.custom,

                    label:
                      legacyLocation,

                    detail:
                      null as
                        | string
                        | null,
                  };
                }
              );

            if (
              pickupMode === "seller_points" &&
              !usingLegacyRequest &&
              requestedPickupSelections.length !==
                vendorIds.length
            ) {
              throw new OrderInputError(
                "Choose exactly one pickup point for every seller."
              );
            }

            const subtotal =
              lineItems.reduce(
                (
                  total,
                  item
                ) =>
                  total +
                  item.lineTotal,
                0
              );

            if (
              subtotal <=
              0
            ) {
              throw new OrderInputError(
                "The order total is invalid."
              );
            }

            const fee =
              calculateFee(
                subtotal
              );

            const total =
              subtotal +
              fee;

            const legacyOrderPickup =
              resolvedPickupSelections.length ===
              1
                ? [
                    resolvedPickupSelections[0]
                      .label,

                    resolvedPickupSelections[0]
                      .detail,
                  ]
                    .filter(
                      Boolean
                    )
                    .join(
                      " — "
                    )
                : null;

            const createdOrder =
              await tx.order.create({
                data: {
                  buyerId,

                  subtotal,

                  fee,

                  total,

                  pickupLocation:
                    legacyOrderPickup,

                  preferredSlot: null,
                  secondaryPhone: safeSecondaryPhone,
                  checkoutKey,

                  status:
                    OrderStatus.pending,

                  paymentStatus:
                    PaymentStatus.paid,

                  items: {
                    create:
                      lineItems,
                  },

                  vendorPickupSelections: {
                    create:
                      resolvedPickupSelections.map(
                        (
                          selection
                        ) => ({
                          vendorId:
                            selection.vendorId,

                          pickupPointId:
                            selection.pickupPointId,

                          type:
                            selection.type,

                          label:
                            selection.label,

                          detail:
                            selection.detail,
                        })
                      ),
                  },
                },

                select: {
                  id:
                    true,
                },
              });

            const debit = await tx.wallet.updateMany({
              where: { userId: buyerId, balance: { gte: total } },
              data: { balance: { decrement: total } },
            });
            if (debit.count !== 1) throw new InsufficientFundsError();
            await tx.walletEntry.create({ data: { userId: buyerId, reference: "checkout:" + createdOrder.id,
              kind: "checkout_debit", amount: -total, orderId: createdOrder.id } });
            for (const vendorId of vendorIds) {
              const amount = lineItems.filter((item) => item.vendorId === vendorId)
                .reduce((sum, item) => sum + item.lineTotal, 0);
              await tx.walletHold.create({ data: { orderId: createdOrder.id, vendorId, amount } });
            }
            const fulfillmentRows =
              vendorIds.map(
                (
                  vendorId
                ) => {
                  const material =
                    createFulfillmentCodeMaterial();

                  return {
                    orderId:
                      createdOrder.id,

                    vendorId,

                    codeHash:
                      material.codeHash,

                    codeCiphertext:
                      material.codeCiphertext,

                    codeCreatedAt:
                      new Date(),
                  };
                }
              );

            if (
              fulfillmentRows.length >
              0
            ) {
              await tx.orderVendorFulfillment.createMany({
                data:
                  fulfillmentRows,
              });
            }

            if (
              vendorIds.length >
              0
            ) {
              await tx.notification.createMany({
                data:
                  vendorIds.map(
                    (
                      vendorId
                    ) => {
                      const quantity =
                        lineItems
                          .filter(
                            (
                              item
                            ) =>
                              item.vendorId ===
                              vendorId
                          )
                          .reduce(
                            (
                              total,
                              item
                            ) =>
                              total +
                              item.quantity,
                            0
                          );

                      return {
                        userId:
                          vendorId,

                        type:
                          NotificationType.order_received,

                        title:
                          "New order",

                        message:
                          `${buyerName} placed an order for ${quantity} ${
                            quantity ===
                            1
                              ? "item"
                              : "items"
                          } from you.`,

                        href:
                          "/vendor/orders",

                        orderId:
                          createdOrder.id,
                      };
                    }
                  ),
              });
            }

            return tx.order.findUniqueOrThrow({
              where: {
                id:
                  createdOrder.id,
              },

              include: {
                items: {
                  include:
                    orderItemInclude,
                },

                vendorPickupSelections:
                  true,
              },
            });
          }
        );

      return res
        .status(201)
        .json({
          success:
            true,

          message:
            "Order created successfully.",

          order,
        });
    } catch (
      error
    ) {
      // Concurrent retry with an already committed checkout key.
      if (error && typeof error === "object" && "code" in error && error.code === "P2002" && typeof req.body?.checkoutKey === "string") {
        const existing = await prisma.order.findUnique({ where: { checkoutKey: req.body.checkoutKey }, include: { items: { include: orderItemInclude }, vendorPickupSelections: true } });
        if (existing?.buyerId === req.user?.id) return res.status(200).json({ success:true, message:"Order already placed.", order:existing });
      }
      if (error instanceof InsufficientFundsError) {
        return res.status(402).json({ success:false, code:"INSUFFICIENT_FUNDS", message:"Insufficient wallet balance. Please top up before checkout." });
      }
      if (
        error instanceof
        OrderInputError
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              error.message,
          });
      }

      console.error(
        "Create order error:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            "Something went wrong while creating the order.",
        });
    }
  };