import {
  Response,
} from "express";

import {
  OrderStatus,
  PaymentStatus,
  Prisma,
  StudentVerificationStatus,
  UserRole,
  VendorAccessStatus,
} from "../generated/prisma/client";

import {
  prisma,
} from "../lib/prisma";

import type {
  AuthenticatedRequest,
} from "../middleware/auth.middleware";

import {
  createFulfillmentCodeMaterial,
  decryptFulfillmentCode,
  isValidFulfillmentCode,
  verifyFulfillmentCodeHash,
} from "../services/fulfillmentCode.service";

class OrderInputError extends Error {}

type RequestedOrderItem = {
  productId: number;
  quantity: number;
};

const MAX_FULFILLMENT_ATTEMPTS =
  5;

const FULFILLMENT_LOCK_MINUTES =
  15;

function cleanOptionalText(
  value: unknown
): string | null {
  if (
    typeof value !==
    "string"
  ) {
    return null;
  }

  const cleaned =
    value.trim();

  return (
    cleaned ||
    null
  );
}

function normalizeOrderItems(
  value: unknown
): RequestedOrderItem[] | null {
  if (
    !Array.isArray(
      value
    )
  ) {
    return null;
  }

  const quantities =
    new Map<
      number,
      number
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
      productId <= 0 ||
      !Number.isInteger(
        quantity
      ) ||
      quantity <= 0 ||
      quantity > 99
    ) {
      return null;
    }

    const nextQuantity =
      (
        quantities.get(
          productId
        ) ??
        0
      ) +
      quantity;

    if (
      nextQuantity >
      99
    ) {
      return null;
    }

    quantities.set(
      productId,
      nextQuantity
    );
  }

  return Array.from(
    quantities.entries()
  ).map(
    (
      [
        productId,
        quantity,
      ]
    ) => ({
      productId,
      quantity,
    })
  );
}

function calculateFee(
  subtotal: number
) {
  if (
    subtotal >=
    50000
  ) {
    return 100;
  }

  if (
    subtotal >=
    10000
  ) {
    return 50;
  }

  if (
    subtotal >
    0
  ) {
    return 20;
  }

  return 0;
}

function calculateOverallOrderStatus(
  statuses:
    OrderStatus[]
): OrderStatus {
  if (
    statuses.length ===
    0
  ) {
    return OrderStatus.pending;
  }

  if (
    statuses.every(
      (
        status
      ) =>
        status ===
        OrderStatus.cancelled
    )
  ) {
    return OrderStatus.cancelled;
  }

  if (
    statuses.every(
      (
        status
      ) =>
        status ===
          OrderStatus.completed ||
        status ===
          OrderStatus.cancelled
    )
  ) {
    return OrderStatus.completed;
  }

  if (
    statuses.some(
      (
        status
      ) =>
        status ===
          OrderStatus.confirmed ||
        status ===
          OrderStatus.completed
    )
  ) {
    return OrderStatus.confirmed;
  }

  return OrderStatus.pending;
}

function calculateVendorStatus(
  statuses:
    OrderStatus[]
): OrderStatus {
  return calculateOverallOrderStatus(
    statuses
  );
}

/*
 * =======================================================
 * NEW-ORDER PRODUCT AVAILABILITY
 * =======================================================
 */

const orderableProductWhere:
  Prisma.ProductWhereInput = {
    isArchived:
      false,

    vendor: {
      role:
        UserRole.vendor,

      studentVerificationStatus:
        StudentVerificationStatus.verified,

      vendorProfile: {
        is: {
          accessStatus:
            VendorAccessStatus.active,

          businessName: {
            not:
              "",
          },

          businessDescription: {
            not:
              "",
          },

          pickupLocation: {
            not:
              "",
          },
        },
      },

      OR: [
        {
          universityId: {
            not:
              null,
          },

          matricNumber: {
            not:
              null,
          },
        },

        {
          universityId:
            null,

          fallbackUniversityName: {
            not:
              null,
          },

          fallbackState: {
            not:
              null,
          },

          fallbackCity: {
            not:
              null,
          },
        },
      ],
    },
  };

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

/*
 * =======================================================
 * CREATE ORDER
 * =======================================================
 *
 * Every seller represented in a new order receives one
 * private fulfilment challenge.
 *
 * The raw code is NOT returned here.
 *
 * Buyer access to the code is controlled by the separate
 * buyer fulfilment endpoint.
 */

export const createOrder =
  async (
    req: AuthenticatedRequest,
    res: Response
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
        pickupLocation,
        preferredSlot,
      } =
        req.body;

      const requestedItems =
        normalizeOrderItems(
          items
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

      const cleanPickupLocation =
        cleanOptionalText(
          pickupLocation
        );

      const cleanPreferredSlot =
        cleanOptionalText(
          preferredSlot
        );

      const buyerId =
        req.user.id;

      const order =
        await prisma.$transaction(
          async (
            tx
          ) => {
            const productIds =
              requestedItems.map(
                (
                  item
                ) =>
                  item.productId
              );

            const products =
              await tx.product.findMany({
                where: {
                  AND: [
                    {
                      id: {
                        in:
                          productIds,
                      },
                    },

                    orderableProductWhere,
                  ],
                },

                select: {
                  id:
                    true,

                  title:
                    true,

                  price:
                    true,

                  vendorId:
                    true,
                },
              });

            if (
              products.length !==
              requestedItems.length
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

                  const lineTotal =
                    product.price *
                    requested.quantity;

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

                    lineTotal,

                    status:
                      OrderStatus.pending,
                  };
                }
              );

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

            /*
             * First create the order and its item snapshots.
             */

            const createdOrder =
              await tx.order.create({
                data: {
                  buyerId,

                  subtotal,

                  fee,

                  total,

                  pickupLocation:
                    cleanPickupLocation,

                  preferredSlot:
                    cleanPreferredSlot,

                  status:
                    OrderStatus.pending,

                  paymentStatus:
                    PaymentStatus.pending,

                  items: {
                    create:
                      lineItems,
                  },
                },

                select: {
                  id:
                    true,
                },
              });

            /*
             * One challenge per DISTINCT seller.
             */

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

/*
 * =======================================================
 * BUYER ORDER HISTORY
 * =======================================================
 */

export const getMyOrders =
  async (
    req: AuthenticatedRequest,
    res: Response
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

      const orders =
        await prisma.order.findMany({
          where: {
            buyerId:
              req.user.id,
          },

          include: {
            items: {
              include:
                orderItemInclude,
            },
          },

          orderBy: {
            createdAt:
              "desc",
          },
        });

      return res
        .status(200)
        .json({
          success:
            true,

          orders,

          count:
            orders.length,
        });
    } catch (
      error
    ) {
      console.error(
        "Get buyer orders error:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            "Unable to load your orders.",
        });
    }
  };

/*
 * =======================================================
 * BUYER FULFILMENT CODES
 * =======================================================
 *
 * GET /api/orders/:id/fulfillment-codes
 *
 * Only the BUYER who owns this order may use this.
 *
 * A seller's code is exposed only while that seller's
 * portion of the order is CONFIRMED.
 *
 * Pending:
 * code remains hidden.
 *
 * Confirmed:
 * buyer can see code.
 *
 * Completed / cancelled:
 * code becomes hidden again.
 */

export const getBuyerFulfillmentCodes =
  async (
    req: AuthenticatedRequest,
    res: Response
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

      const orderId =
        String(
          req.params.id ??
            ""
        ).trim();

      if (
        !orderId
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Invalid order ID.",
          });
      }

      const order =
        await prisma.order.findUnique({
          where: {
            id:
              orderId,
          },

          select: {
            id:
              true,

            buyerId:
              true,

            items: {
              select: {
                vendorId:
                  true,

                status:
                  true,

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
                      },
                    },
                  },
                },
              },
            },

            vendorFulfillments: {
              select: {
                vendorId:
                  true,

                codeCiphertext:
                  true,

                verifiedAt:
                  true,
              },
            },
          },
        });

      if (
        !order
      ) {
        return res
          .status(404)
          .json({
            success:
              false,

            message:
              "Order not found.",
          });
      }

      if (
        order.buyerId !==
        req.user.id
      ) {
        return res
          .status(403)
          .json({
            success:
              false,

            message:
              "You do not have access to this order.",
          });
      }

      const itemsByVendor =
        new Map<
          string,
          typeof order.items
        >();

      for (
        const item of
        order.items
      ) {
        const current =
          itemsByVendor.get(
            item.vendorId
          ) ??
          [];

        current.push(
          item
        );

        itemsByVendor.set(
          item.vendorId,
          current
        );
      }

      const fulfillmentMap =
        new Map(
          order.vendorFulfillments.map(
            (
              fulfillment
            ) => [
              fulfillment.vendorId,
              fulfillment,
            ]
          )
        );

      const portions =
        Array.from(
          itemsByVendor.entries()
        ).map(
          (
            [
              vendorId,
              items,
            ]
          ) => {
            const vendorStatus =
              calculateVendorStatus(
                items.map(
                  (
                    item
                  ) =>
                    item.status
                )
              );

            const vendor =
              items[0]
                ?.vendor;

            const fulfillment =
              fulfillmentMap.get(
                vendorId
              );

            let code:
              string | null =
              null;

            /*
             * The buyer only gets the live code after
             * seller confirmation.
             */

            if (
              vendorStatus ===
                OrderStatus.confirmed &&
              fulfillment &&
              !fulfillment.verifiedAt
            ) {
              code =
                decryptFulfillmentCode(
                  fulfillment.codeCiphertext
                );
            }

            return {
              vendorId,

              sellerName:
                vendor
                  ?.vendorProfile
                  ?.businessName ||
                vendor?.name ||
                "CampusMart seller",

              status:
                vendorStatus,

              code,

              codeAvailable:
                Boolean(
                  code
                ),

              verified:
                Boolean(
                  fulfillment
                    ?.verifiedAt
                ),
            };
          }
        );

      return res
        .status(200)
        .json({
          success:
            true,

          orderId:
            order.id,

          portions,
        });
    } catch (
      error
    ) {
      console.error(
        "Get buyer fulfillment codes error:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            "Unable to load fulfilment codes.",
        });
    }
  };

/*
 * =======================================================
 * SELLER ORDER HISTORY
 * =======================================================
 */

export const getVendorOrders =
  async (
    req: AuthenticatedRequest,
    res: Response
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

      const vendorId =
        req.user.id;

      const orders =
        await prisma.order.findMany({
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
                id:
                  true,

                name:
                  true,

                campus:
                  true,

                phone:
                  true,
              },
            },

            items: {
              where: {
                vendorId,
              },

              include: {
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
              },
            },
          },

          orderBy: {
            createdAt:
              "desc",
          },
        });

      const enrichedOrders =
        orders.map(
          (
            order
          ) => ({
            ...order,

            vendorStatus:
              calculateVendorStatus(
                order.items.map(
                  (
                    item
                  ) =>
                    item.status
                )
              ),
          })
        );

      const orderCount =
        orders.length;

      const itemCount =
        orders.reduce(
          (
            total,
            order
          ) =>
            total +
            order.items.reduce(
              (
                itemTotal,
                item
              ) =>
                itemTotal +
                item.quantity,
              0
            ),
          0
        );

      const pendingOrderCount =
        orders.filter(
          (
            order
          ) =>
            order.items.some(
              (
                item
              ) =>
                item.status ===
                OrderStatus.pending
            )
        ).length;

      const revenue =
        orders.reduce(
          (
            total,
            order
          ) => {
            if (
              order.paymentStatus !==
              PaymentStatus.paid
            ) {
              return total;
            }

            const completedRevenue =
              order.items.reduce(
                (
                  itemTotal,
                  item
                ) =>
                  item.status ===
                  OrderStatus.completed
                    ? itemTotal +
                      item.lineTotal
                    : itemTotal,
                0
              );

            return (
              total +
              completedRevenue
            );
          },
          0
        );

      return res
        .status(200)
        .json({
          success:
            true,

          summary: {
            orderCount,

            pendingOrderCount,

            itemCount,

            revenue,
          },

          orders:
            enrichedOrders,
        });
    } catch (
      error
    ) {
      console.error(
        "Get vendor orders error:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            "Unable to load vendor orders.",
        });
    }
  };

/*
 * =======================================================
 * UPDATE SELLER ORDER STATUS
 * =======================================================
 *
 * This endpoint now supports:
 *
 * pending -> confirmed
 * pending -> cancelled
 * confirmed -> cancelled
 *
 * It deliberately DOES NOT support:
 *
 * confirmed -> completed
 *
 * Completion requires the buyer's fulfilment code through
 * verifyVendorFulfillmentCode.
 */

export const updateVendorOrderStatus =
  async (
    req: AuthenticatedRequest,
    res: Response
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

      const vendorId =
        req.user.id;

      const orderId =
        String(
          req.params.id
        ).trim();

      const requestedStatus =
        String(
          req.body.status ??
            ""
        )
          .trim()
          .toLowerCase();

      if (
        !orderId
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Invalid order ID.",
          });
      }

      /*
       * Completion is no longer seller-declared.
       */

      if (
        requestedStatus ===
        OrderStatus.completed
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            code:
              "FULFILLMENT_CODE_REQUIRED",

            message:
              "Complete this order using the buyer's 4-digit fulfilment code.",
          });
      }

      const allowedStatuses:
        OrderStatus[] = [
          OrderStatus.confirmed,
          OrderStatus.cancelled,
        ];

      if (
        !allowedStatuses.includes(
          requestedStatus as
            OrderStatus
        )
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Status must be confirmed or cancelled.",
          });
      }

      const nextStatus =
        requestedStatus as
          OrderStatus;

      const result =
        await prisma.$transaction(
          async (
            tx
          ) => {
            const order =
              await tx.order.findUnique({
                where: {
                  id:
                    orderId,
                },

                include: {
                  items: {
                    select: {
                      id:
                        true,

                      vendorId:
                        true,

                      status:
                        true,
                    },
                  },
                },
              });

            if (
              !order
            ) {
              throw new OrderInputError(
                "Order not found."
              );
            }

            const vendorItems =
              order.items.filter(
                (
                  item
                ) =>
                  item.vendorId ===
                  vendorId
              );

            if (
              vendorItems.length ===
              0
            ) {
              throw new OrderInputError(
                "This order does not contain any of your products."
              );
            }

            for (
              const item of
              vendorItems
            ) {
              const currentStatus =
                item.status;

              if (
                currentStatus ===
                nextStatus
              ) {
                continue;
              }

              const validTransition =
                (
                  currentStatus ===
                    OrderStatus.pending &&
                  (
                    nextStatus ===
                      OrderStatus.confirmed ||
                    nextStatus ===
                      OrderStatus.cancelled
                  )
                ) ||
                (
                  currentStatus ===
                    OrderStatus.confirmed &&
                  nextStatus ===
                    OrderStatus.cancelled
                );

              if (
                !validTransition
              ) {
                throw new OrderInputError(
                  `Cannot change an item from ${currentStatus} to ${nextStatus}.`
                );
              }
            }

            await tx.orderItem.updateMany({
              where: {
                orderId,

                vendorId,
              },

              data: {
                status:
                  nextStatus,
              },
            });

            /*
             * Compatibility for orders created before the
             * fulfilment-code feature.
             *
             * If an older pending order is now confirmed,
             * create its missing seller challenge.
             */

            if (
              nextStatus ===
              OrderStatus.confirmed
            ) {
              const existingFulfillment =
                await tx.orderVendorFulfillment.findUnique({
                  where: {
                    orderId_vendorId: {
                      orderId,

                      vendorId,
                    },
                  },

                  select: {
                    id:
                      true,
                  },
                });

              if (
                !existingFulfillment
              ) {
                const material =
                  createFulfillmentCodeMaterial();

                await tx.orderVendorFulfillment.create({
                  data: {
                    orderId,

                    vendorId,

                    codeHash:
                      material.codeHash,

                    codeCiphertext:
                      material.codeCiphertext,

                    codeCreatedAt:
                      new Date(),
                  },
                });
              }
            }

            const allItems =
              await tx.orderItem.findMany({
                where: {
                  orderId,
                },

                select: {
                  status:
                    true,
                },
              });

            const overallStatus =
              calculateOverallOrderStatus(
                allItems.map(
                  (
                    item
                  ) =>
                    item.status
                )
              );

            const updatedOrder =
              await tx.order.update({
                where: {
                  id:
                    orderId,
                },

                data: {
                  status:
                    overallStatus,
                },

                include: {
                  buyer: {
                    select: {
                      id:
                        true,

                      name:
                        true,

                      campus:
                        true,

                      phone:
                        true,
                    },
                  },

                  items: {
                    where: {
                      vendorId,
                    },

                    include: {
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
                    },
                  },
                },
              });

            return {
              ...updatedOrder,

              vendorStatus:
                calculateVendorStatus(
                  updatedOrder.items.map(
                    (
                      item
                    ) =>
                      item.status
                  )
                ),
            };
          }
        );

      return res
        .status(200)
        .json({
          success:
            true,

          message:
            nextStatus ===
            OrderStatus.confirmed
              ? "Order confirmed. The buyer's fulfilment code is now active."
              : "Order cancelled.",

          order:
            result,
        });
    } catch (
      error
    ) {
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
        "Update vendor order status error:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            "Unable to update order status.",
        });
    }
  };

/*
 * =======================================================
 * VERIFY SELLER FULFILMENT CODE
 * =======================================================
 *
 * POST /api/orders/vendor/:id/fulfillment
 *
 * Body:
 *
 * {
 *   "code": "0427"
 * }
 *
 * Seller never receives the expected code from this
 * endpoint.
 */

export const verifyVendorFulfillmentCode =
  async (
    req: AuthenticatedRequest,
    res: Response
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

      const vendorId =
        req.user.id;

      const orderId =
        String(
          req.params.id ??
            ""
        ).trim();

      const code =
        typeof req.body
          ?.code ===
          "string"
          ? req.body.code.trim()
          : "";

      if (
        !orderId
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Invalid order ID.",
          });
      }

      if (
        !isValidFulfillmentCode(
          code
        )
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Enter the 4-digit fulfilment code provided by the buyer.",
          });
      }

      const result =
        await prisma.$transaction(
          async (
            tx
          ) => {
            const order =
              await tx.order.findUnique({
                where: {
                  id:
                    orderId,
                },

                include: {
                  items: {
                    where: {
                      vendorId,
                    },

                    select: {
                      id:
                        true,

                      status:
                        true,
                    },
                  },
                },
              });

            if (
              !order
            ) {
              throw new OrderInputError(
                "Order not found."
              );
            }

            if (
              order.items.length ===
              0
            ) {
              throw new OrderInputError(
                "This order does not contain any of your products."
              );
            }

            const vendorStatus =
              calculateVendorStatus(
                order.items.map(
                  (
                    item
                  ) =>
                    item.status
                )
              );

            if (
              vendorStatus ===
              OrderStatus.completed
            ) {
              return {
                alreadyCompleted:
                  true,

                orderId,

                vendorStatus:
                  OrderStatus.completed,
              };
            }

            if (
              vendorStatus ===
              OrderStatus.cancelled
            ) {
              throw new OrderInputError(
                "A cancelled order cannot be completed."
              );
            }

            if (
              vendorStatus !==
              OrderStatus.confirmed
            ) {
              throw new OrderInputError(
                "Confirm this order before attempting fulfilment."
              );
            }

            const fulfillment =
              await tx.orderVendorFulfillment.findUnique({
                where: {
                  orderId_vendorId: {
                    orderId,

                    vendorId,
                  },
                },
              });

            if (
              !fulfillment
            ) {
              throw new OrderInputError(
                "A fulfilment code is not available for this order."
              );
            }

            if (
              fulfillment.verifiedAt
            ) {
              return {
                alreadyCompleted:
                  true,

                orderId,

                vendorStatus:
                  OrderStatus.completed,
              };
            }

            const now =
              new Date();

            if (
              fulfillment.lockedUntil &&
              fulfillment.lockedUntil >
                now
            ) {
              return {
                locked:
                  true,

                lockedUntil:
                  fulfillment.lockedUntil,
              };
            }

            const correct =
              verifyFulfillmentCodeHash(
                code,
                fulfillment.codeHash
              );

            if (
              !correct
            ) {
              /*
               * If a previous lock has already expired,
               * begin a fresh attempt window.
               */

              const previousAttempts =
                fulfillment.lockedUntil &&
                fulfillment.lockedUntil <=
                  now
                  ? 0
                  : fulfillment.failedAttemptCount;

              const nextAttempts =
                previousAttempts +
                1;

              const shouldLock =
                nextAttempts >=
                MAX_FULFILLMENT_ATTEMPTS;

              const lockedUntil =
                shouldLock
                  ? new Date(
                      now.getTime() +
                        FULFILLMENT_LOCK_MINUTES *
                          60 *
                          1000
                    )
                  : null;

              await tx.orderVendorFulfillment.update({
                where: {
                  id:
                    fulfillment.id,
                },

                data: {
                  failedAttemptCount:
                    shouldLock
                      ? 0
                      : nextAttempts,

                  lastFailedAttemptAt:
                    now,

                  lockedUntil,
                },
              });

              return {
                incorrect:
                  true,

                attemptsRemaining:
                  shouldLock
                    ? 0
                    : MAX_FULFILLMENT_ATTEMPTS -
                      nextAttempts,

                lockedUntil,
              };
            }

            /*
             * Correct buyer code.
             */

            await tx.orderVendorFulfillment.update({
              where: {
                id:
                  fulfillment.id,
              },

              data: {
                verifiedAt:
                  now,

                failedAttemptCount:
                  0,

                lastFailedAttemptAt:
                  null,

                lockedUntil:
                  null,
              },
            });

            await tx.orderItem.updateMany({
              where: {
                orderId,

                vendorId,

                status:
                  OrderStatus.confirmed,
              },

              data: {
                status:
                  OrderStatus.completed,
              },
            });

            const allItems =
              await tx.orderItem.findMany({
                where: {
                  orderId,
                },

                select: {
                  status:
                    true,
                },
              });

            const overallStatus =
              calculateOverallOrderStatus(
                allItems.map(
                  (
                    item
                  ) =>
                    item.status
                )
              );

            await tx.order.update({
              where: {
                id:
                  orderId,
              },

              data: {
                status:
                  overallStatus,
              },
            });

            return {
              completed:
                true,

              orderId,

              vendorStatus:
                OrderStatus.completed,

              overallStatus,
            };
          }
        );

      if (
        "locked" in
          result &&
        result.locked
      ) {
        return res
          .status(429)
          .json({
            success:
              false,

            code:
              "FULFILLMENT_CODE_LOCKED",

            message:
              "Too many incorrect attempts. Try again later.",

            lockedUntil:
              result.lockedUntil,
          });
      }

      if (
        "incorrect" in
          result &&
        result.incorrect
      ) {
        if (
          result.lockedUntil
        ) {
          return res
            .status(429)
            .json({
              success:
                false,

              code:
                "FULFILLMENT_CODE_LOCKED",

              message:
                "Too many incorrect attempts. Fulfilment-code entry has been temporarily locked.",

              lockedUntil:
                result.lockedUntil,
            });
        }

        return res
          .status(400)
          .json({
            success:
              false,

            code:
              "INCORRECT_FULFILLMENT_CODE",

            message:
              "That fulfilment code is incorrect.",

            attemptsRemaining:
              result.attemptsRemaining,
          });
      }

      if (
        "alreadyCompleted" in
          result &&
        result.alreadyCompleted
      ) {
        return res
          .status(200)
          .json({
            success:
              true,

            message:
              "This order has already been completed.",

            orderId:
              result.orderId,

            vendorStatus:
              result.vendorStatus,
          });
      }

      return res
        .status(200)
        .json({
          success:
            true,

          message:
            "Fulfilment confirmed. Your seller portion of the order is now complete.",

          orderId:
            result.orderId,

          vendorStatus:
            result.vendorStatus,

          overallStatus:
            "overallStatus" in
              result
              ? result.overallStatus
              : undefined,
        });
    } catch (
      error
    ) {
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
        "Verify vendor fulfillment code error:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            "Unable to verify fulfilment.",
        });
    }
  };

/*
 * =======================================================
 * GET INDIVIDUAL ORDER
 * =======================================================
 */

export const getOrderById =
  async (
    req: AuthenticatedRequest,
    res: Response
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

      const orderId =
        String(
          req.params.id
        ).trim();

      if (
        !orderId
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Invalid order ID.",
          });
      }

      const order =
        await prisma.order.findUnique({
          where: {
            id:
              orderId,
          },

          include: {
            buyer: {
              select: {
                id:
                  true,

                name:
                  true,

                campus:
                  true,

                phone:
                  true,
              },
            },

            items: {
              include:
                orderItemInclude,
            },
          },
        });

      if (
        !order
      ) {
        return res
          .status(404)
          .json({
            success:
              false,

            message:
              "Order not found.",
          });
      }

      /*
       * Buyer may view the complete order.
       */

      if (
        order.buyerId ===
        req.user.id
      ) {
        return res
          .status(200)
          .json({
            success:
              true,

            order,
          });
      }

      /*
       * Seller sees only their own portion.
       */

      if (
        req.user.role ===
        UserRole.vendor
      ) {
        const vendorItems =
          order.items.filter(
            (
              item
            ) =>
              item.vendorId ===
              req.user?.id
          );

        if (
          vendorItems.length >
          0
        ) {
          const vendorSubtotal =
            vendorItems.reduce(
              (
                total,
                item
              ) =>
                total +
                item.lineTotal,
              0
            );

          return res
            .status(200)
            .json({
              success:
                true,

              order: {
                id:
                  order.id,

                status:
                  order.status,

                vendorStatus:
                  calculateVendorStatus(
                    vendorItems.map(
                      (
                        item
                      ) =>
                        item.status
                    )
                  ),

                paymentStatus:
                  order.paymentStatus,

                pickupLocation:
                  order.pickupLocation,

                preferredSlot:
                  order.preferredSlot,

                createdAt:
                  order.createdAt,

                updatedAt:
                  order.updatedAt,

                buyer:
                  order.buyer,

                items:
                  vendorItems,

                vendorSubtotal,
              },
            });
        }
      }

      return res
        .status(403)
        .json({
          success:
            false,

          message:
            "You do not have access to this order.",
        });
    } catch (
      error
    ) {
      console.error(
        "Get order error:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            "Unable to load this order.",
        });
    }
  };