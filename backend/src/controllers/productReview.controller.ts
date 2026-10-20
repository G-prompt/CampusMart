import {
  Request,
  Response,
} from "express";

import {
  OrderStatus,
} from "../generated/prisma/client";

import {
  prisma,
} from "../lib/prisma";

import type {
  AuthenticatedRequest,
} from "../middleware/auth.middleware";

const REVIEW_WAIT_MS =
  6 *
  60 *
  60 *
  1000;

const MAX_REVIEW_LENGTH =
  1000;

type ReviewEligibility = {
  canReview:
    boolean;

  reason:
    | "eligible"
    | "already_reviewed"
    | "wait_period"
    | "purchase_required";

  eligibleAt:
    string | null;
};

function parseProductId(
  value:
    unknown
) {
  const id =
    Number(
      value
    );

  if (
    !Number.isInteger(
      id
    ) ||
    id <=
      0
  ) {
    return null;
  }

  return id;
}

async function resolveReviewEligibility(
  productId:
    number,
  buyerId:
    string
): Promise<ReviewEligibility> {
  const existingReview =
    await prisma.productReview.findUnique({
      where: {
        productId_buyerId: {
          productId,
          buyerId,
        },
      },

      select: {
        id:
          true,
      },
    });

  if (
    existingReview
  ) {
    return {
      canReview:
        false,

      reason:
        "already_reviewed",

      eligibleAt:
        null,
    };
  }

  /*
   * We deliberately use the seller-specific
   * fulfilment record rather than Order.updatedAt.
   *
   * In a multi-seller order, seller A may complete
   * their handover before seller B.
   *
   * Therefore review eligibility should unlock
   * independently for the product actually fulfilled.
   */
  const completedItems =
    await prisma.orderItem.findMany({
      where: {
        productId,

        status:
          OrderStatus.completed,

        order: {
          buyerId,
        },
      },

      select: {
        vendorId:
          true,

        order: {
          select: {
            vendorFulfillments: {
              select: {
                vendorId:
                  true,

                verifiedAt:
                  true,
              },
            },
          },
        },
      },
    });

  const fulfilmentTimes:
    Date[] =
    [];

  for (
    const item of
    completedItems
  ) {
    const fulfilment =
      item.order
        .vendorFulfillments
        .find(
          (
            row
          ) =>
            row.vendorId ===
              item.vendorId &&
            row.verifiedAt !==
              null
        );

    if (
      fulfilment?.verifiedAt
    ) {
      fulfilmentTimes.push(
        fulfilment.verifiedAt
      );
    }
  }

  if (
    fulfilmentTimes.length ===
    0
  ) {
    return {
      canReview:
        false,

      reason:
        "purchase_required",

      eligibleAt:
        null,
    };
  }

  const now =
    Date.now();

  const eligibleTimes =
    fulfilmentTimes.map(
      (
        completedAt
      ) =>
        new Date(
          completedAt.getTime() +
            REVIEW_WAIT_MS
        )
    );

  const alreadyEligible =
    eligibleTimes.some(
      (
        eligibleAt
      ) =>
        eligibleAt.getTime() <=
        now
    );

  if (
    alreadyEligible
  ) {
    return {
      canReview:
        true,

      reason:
        "eligible",

      eligibleAt:
        null,
    };
  }

  const earliestEligibility =
    eligibleTimes.reduce(
      (
        earliest,
        current
      ) =>
        current.getTime() <
        earliest.getTime()
          ? current
          : earliest
    );

  return {
    canReview:
      false,

    reason:
      "wait_period",

    eligibleAt:
      earliestEligibility.toISOString(),
  };
}

async function getReviewSummary(
  productId:
    number
) {
  const aggregation =
    await prisma.productReview.aggregate({
      where: {
        productId,
      },

      _avg: {
        rating:
          true,
      },

      _count: {
        _all:
          true,
      },
    });

  const averageRating =
    aggregation._avg.rating ??
    0;

  const reviewCount =
    aggregation._count._all;

  return {
    averageRating:
      Number(
        averageRating.toFixed(
          2
        )
      ),

    reviewCount,
  };
}

/*
 * =======================================================
 * PUBLIC REVIEWS
 * =======================================================
 */

export const getProductReviews =
  async (
    req:
      Request,
    res:
      Response
  ) => {
    try {
      const productId =
        parseProductId(
          req.params.id
        );

      if (
        !productId
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Invalid product ID.",
          });
      }

      const product =
        await prisma.product.findUnique({
          where: {
            id:
              productId,
          },

          select: {
            id:
              true,
          },
        });

      if (
        !product
      ) {
        return res
          .status(404)
          .json({
            success:
              false,

            message:
              "Product not found.",
          });
      }

      const [
        reviews,
        summary,
      ] =
        await Promise.all([
          prisma.productReview.findMany({
            where: {
              productId,
            },

            select: {
              id:
                true,

              rating:
                true,

              comment:
                true,

              createdAt:
                true,

              buyer: {
                select: {
                  id:
                    true,

                  name:
                    true,
                },
              },
            },

            orderBy: {
              createdAt:
                "desc",
            },
          }),

          getReviewSummary(
            productId
          ),
        ]);

      return res
        .status(200)
        .json({
          success:
            true,

          reviews:
            reviews.map(
              (
                review
              ) => ({
                id:
                  review.id,

                rating:
                  review.rating,

                comment:
                  review.comment,

                createdAt:
                  review.createdAt,

                author: {
                  id:
                    review.buyer.id,

                  name:
                    review.buyer.name,
                },
              })
            ),

          averageRating:
            summary.averageRating,

          reviewCount:
            summary.reviewCount,
        });
    } catch (
      error
    ) {
      console.error(
        "Get product reviews error:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            "Unable to load product reviews.",
        });
    }
  };

/*
 * =======================================================
 * REVIEW ELIGIBILITY
 * =======================================================
 */

export const getProductReviewEligibility =
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

      const productId =
        parseProductId(
          req.params.id
        );

      if (
        !productId
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Invalid product ID.",
          });
      }

      const product =
        await prisma.product.findUnique({
          where: {
            id:
              productId,
          },

          select: {
            id:
              true,
          },
        });

      if (
        !product
      ) {
        return res
          .status(404)
          .json({
            success:
              false,

            message:
              "Product not found.",
          });
      }

      const eligibility =
        await resolveReviewEligibility(
          productId,
          req.user.id
        );

      return res
        .status(200)
        .json({
          success:
            true,

          eligibility,
        });
    } catch (
      error
    ) {
      console.error(
        "Review eligibility error:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            "Unable to check review eligibility.",
        });
    }
  };

/*
 * =======================================================
 * CREATE VERIFIED-PURCHASE REVIEW
 * =======================================================
 */

export const createProductReview =
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

      const productId =
        parseProductId(
          req.params.id
        );

      if (
        !productId
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Invalid product ID.",
          });
      }

      const rating =
        Number(
          req.body.rating
        );

      const comment =
        typeof req.body.comment ===
        "string"
          ? req.body.comment.trim()
          : "";

      if (
        !Number.isInteger(
          rating
        ) ||
        rating <
          1 ||
        rating >
          5
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Rating must be between 1 and 5.",
          });
      }

      if (
        !comment
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Write a short review before submitting.",
          });
      }

      if (
        comment.length >
        MAX_REVIEW_LENGTH
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              `Reviews can be up to ${MAX_REVIEW_LENGTH} characters.`,
          });
      }

      const product =
        await prisma.product.findUnique({
          where: {
            id:
              productId,
          },

          select: {
            id:
              true,

            vendorId:
              true,
          },
        });

      if (
        !product
      ) {
        return res
          .status(404)
          .json({
            success:
              false,

            message:
              "Product not found.",
          });
      }

      const eligibility =
        await resolveReviewEligibility(
          productId,
          req.user.id
        );

      if (
        !eligibility.canReview
      ) {
        let message =
          "You are not currently eligible to review this product.";

        if (
          eligibility.reason ===
          "already_reviewed"
        ) {
          message =
            "You have already reviewed this product.";
        }

        if (
          eligibility.reason ===
          "wait_period"
        ) {
          message =
            "Reviews unlock 6 hours after fulfilment is completed.";
        }

        if (
          eligibility.reason ===
          "purchase_required"
        ) {
          message =
            "Only buyers with a completed purchase can review this product.";
        }

        return res
          .status(403)
          .json({
            success:
              false,

            code:
              "REVIEW_NOT_ELIGIBLE",

            message,

            eligibility,
          });
      }

      const result =
        await prisma.$transaction(
          async (
            tx
          ) => {
            const review =
              await tx.productReview.create({
                data: {
                  productId,

                  buyerId:
                    req.user!.id,

                  rating,

                  comment,
                },

                select: {
                  id:
                    true,

                  rating:
                    true,

                  comment:
                    true,

                  createdAt:
                    true,

                  buyer: {
                    select: {
                      id:
                        true,

                      name:
                        true,
                    },
                  },
                },
              });

            const aggregation =
              await tx.productReview.aggregate({
                where: {
                  productId,
                },

                _avg: {
                  rating:
                    true,
                },

                _count: {
                  _all:
                    true,
                },
              });

            const averageRating =
              Number(
                (
                  aggregation._avg.rating ??
                  0
                ).toFixed(
                  2
                )
              );

            await tx.product.update({
              where: {
                id:
                  productId,
              },

              data: {
                rating:
                  averageRating,
              },
            });

            return {
              review,

              averageRating,

              reviewCount:
                aggregation._count._all,
            };
          }
        );

      return res
        .status(201)
        .json({
          success:
            true,

          message:
            "Review posted successfully.",

          review: {
            id:
              result.review.id,

            rating:
              result.review.rating,

            comment:
              result.review.comment,

            createdAt:
              result.review.createdAt,

            author: {
              id:
                result.review.buyer.id,

              name:
                result.review.buyer.name,
            },
          },

          averageRating:
            result.averageRating,

          reviewCount:
            result.reviewCount,
        });
    } catch (
      error
    ) {
      /*
       * Protect against two requests racing to create the
       * buyer's one-review-per-product record.
       */
      if (
        error &&
        typeof error ===
          "object" &&
        "code" in
          error &&
        (
          error as {
            code?: string;
          }
        ).code ===
          "P2002"
      ) {
        return res
          .status(409)
          .json({
            success:
              false,

            message:
              "You have already reviewed this product.",
          });
      }

      console.error(
        "Create product review error:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            "Unable to post your review.",
        });
    }
  };