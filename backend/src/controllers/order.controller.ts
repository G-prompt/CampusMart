import { Response } from "express";

import {
  OrderStatus,
  PaymentStatus,
  UserRole,
} from "../generated/prisma/client";

import { prisma } from "../lib/prisma";

import type {
  AuthenticatedRequest,
} from "../middleware/auth.middleware";

class OrderInputError extends Error {}

type RequestedOrderItem = {
  productId: number;
  quantity: number;
};

function cleanOptionalText(
  value: unknown
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const cleaned = value.trim();

  return cleaned || null;
}

function normalizeOrderItems(
  value: unknown
): RequestedOrderItem[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const quantities =
    new Map<number, number>();

  for (const entry of value) {
    if (
      !entry ||
      typeof entry !== "object"
    ) {
      return null;
    }

    const raw = entry as {
      productId?: unknown;
      quantity?: unknown;
    };

    const productId =
      Number(raw.productId);

    const quantity =
      Number(raw.quantity);

    if (
      !Number.isInteger(productId) ||
      productId <= 0 ||
      !Number.isInteger(quantity) ||
      quantity <= 0 ||
      quantity > 99
    ) {
      return null;
    }

    const nextQuantity =
      (quantities.get(productId) ?? 0) +
      quantity;

    if (nextQuantity > 99) {
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
    ([productId, quantity]) => ({
      productId,
      quantity,
    })
  );
}

function calculateFee(
  subtotal: number
) {
  if (subtotal >= 50000) {
    return 100;
  }

  if (subtotal >= 10000) {
    return 50;
  }

  if (subtotal > 0) {
    return 20;
  }

  return 0;
}

function calculateOverallOrderStatus(
  statuses: OrderStatus[]
): OrderStatus {
  if (
    statuses.length === 0
  ) {
    return OrderStatus.pending;
  }

  if (
    statuses.every(
      (status) =>
        status ===
        OrderStatus.cancelled
    )
  ) {
    return OrderStatus.cancelled;
  }

  if (
    statuses.every(
      (status) =>
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
      (status) =>
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
  statuses: OrderStatus[]
): OrderStatus {
  return calculateOverallOrderStatus(
    statuses
  );
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

export const createOrder = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message:
          "Authentication required.",
      });
    }

    const {
      items,
      pickupLocation,
      preferredSlot,
    } = req.body;

    const requestedItems =
      normalizeOrderItems(items);

    if (
      !requestedItems ||
      requestedItems.length === 0
    ) {
      return res.status(400).json({
        success: false,
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
        async (tx) => {
          const productIds =
            requestedItems.map(
              (item) =>
                item.productId
            );

          const products =
            await tx.product.findMany({
              where: {
                id: {
                  in: productIds,
                },
              },

              select: {
                id: true,
                title: true,
                price: true,
                vendorId: true,
              },
            });

          if (
            products.length !==
            requestedItems.length
          ) {
            throw new OrderInputError(
              "One or more products in your cart no longer exist."
            );
          }

          const productMap =
            new Map(
              products.map(
                (product) => [
                  product.id,
                  product,
                ]
              )
            );

          const lineItems =
            requestedItems.map(
              (requested) => {
                const product =
                  productMap.get(
                    requested.productId
                  );

                if (!product) {
                  throw new OrderInputError(
                    "One or more products in your cart could not be found."
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
              (total, item) =>
                total +
                item.lineTotal,
              0
            );

          if (subtotal <= 0) {
            throw new OrderInputError(
              "The order total is invalid."
            );
          }

          const fee =
            calculateFee(
              subtotal
            );

          const total =
            subtotal + fee;

          return tx.order.create({
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

            include: {
              items: {
                include:
                  orderItemInclude,
              },
            },
          });
        }
      );

    return res.status(201).json({
      success: true,
      message:
        "Order created successfully.",
      order,
    });
  } catch (error) {
    if (
      error instanceof
      OrderInputError
    ) {
      return res.status(400).json({
        success: false,
        message:
          error.message,
      });
    }

    console.error(
      "Create order error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Something went wrong while creating the order.",
    });
  }
};

export const getMyOrders = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
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

    return res.status(200).json({
      success: true,
      orders,
      count:
        orders.length,
    });
  } catch (error) {
    console.error(
      "Get buyer orders error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to load your orders.",
    });
  }
};

export const getVendorOrders = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
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
        },

        orderBy: {
          createdAt:
            "desc",
        },
      });

    const enrichedOrders =
      orders.map(
        (order) => ({
          ...order,

          vendorStatus:
            calculateVendorStatus(
              order.items.map(
                (item) =>
                  item.status
              )
            ),
        })
      );

    const orderCount =
      orders.length;

    const itemCount =
      orders.reduce(
        (total, order) =>
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
        (order) =>
          order.items.some(
            (item) =>
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

    return res.status(200).json({
      success: true,

      summary: {
        orderCount,
        pendingOrderCount,
        itemCount,
        revenue,
      },

      orders:
        enrichedOrders,
    });
  } catch (error) {
    console.error(
      "Get vendor orders error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to load vendor orders.",
    });
  }
};

export const updateVendorOrderStatus =
  async (
    req: AuthenticatedRequest,
    res: Response
  ) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
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

      if (!orderId) {
        return res.status(400).json({
          success: false,
          message:
            "Invalid order ID.",
        });
      }

      const allowedStatuses: OrderStatus[] = [
  OrderStatus.confirmed,
  OrderStatus.completed,
  OrderStatus.cancelled,
];

      if (
        !allowedStatuses.includes(
          requestedStatus as OrderStatus
        )
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Status must be confirmed, completed, or cancelled.",
        });
      }

      const nextStatus =
        requestedStatus as OrderStatus;

      const result =
        await prisma.$transaction(
          async (tx) => {
            const order =
              await tx.order.findUnique({
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

            const vendorItems =
              order.items.filter(
                (item) =>
                  item.vendorId ===
                  vendorId
              );

            if (
              vendorItems.length === 0
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
                (currentStatus ===
                  OrderStatus.pending &&
                  (nextStatus ===
                    OrderStatus.confirmed ||
                    nextStatus ===
                      OrderStatus.cancelled)) ||
                (currentStatus ===
                  OrderStatus.confirmed &&
                  (nextStatus ===
                    OrderStatus.completed ||
                    nextStatus ===
                      OrderStatus.cancelled));

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

            const allItems =
              await tx.orderItem.findMany({
                where: {
                  orderId,
                },

                select: {
                  status: true,
                },
              });

            const overallStatus =
              calculateOverallOrderStatus(
                allItems.map(
                  (item) =>
                    item.status
                )
              );

            const updatedOrder =
              await tx.order.update({
                where: {
                  id: orderId,
                },

                data: {
                  status:
                    overallStatus,
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
                },
              });

            return {
              ...updatedOrder,

              vendorStatus:
                calculateVendorStatus(
                  updatedOrder.items.map(
                    (item) =>
                      item.status
                  )
                ),
            };
          }
        );

      return res.status(200).json({
        success: true,

        message:
          `Order updated to ${nextStatus}.`,

        order:
          result,
      });
    } catch (error) {
      if (
        error instanceof
        OrderInputError
      ) {
        return res.status(400).json({
          success: false,
          message:
            error.message,
        });
      }

      console.error(
        "Update vendor order status error:",
        error
      );

      return res.status(500).json({
        success: false,
        message:
          "Unable to update order status.",
      });
    }
  };

export const getOrderById = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message:
          "Authentication required.",
      });
    }

    const orderId =
      String(
        req.params.id
      ).trim();

    if (!orderId) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid order ID.",
      });
    }

    const order =
      await prisma.order.findUnique({
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
            include:
              orderItemInclude,
          },
        },
      });

    if (!order) {
      return res.status(404).json({
        success: false,
        message:
          "Order not found.",
      });
    }

    if (
      order.buyerId ===
      req.user.id
    ) {
      return res.status(200).json({
        success: true,
        order,
      });
    }

    if (
      req.user.role ===
      UserRole.vendor
    ) {
      const vendorItems =
        order.items.filter(
          (item) =>
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

        return res.status(200).json({
          success: true,

          order: {
            id:
              order.id,

            status:
              order.status,

            vendorStatus:
              calculateVendorStatus(
                vendorItems.map(
                  (item) =>
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

    return res.status(403).json({
      success: false,
      message:
        "You do not have access to this order.",
    });
  } catch (error) {
    console.error(
      "Get order error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to load this order.",
    });
  }
};