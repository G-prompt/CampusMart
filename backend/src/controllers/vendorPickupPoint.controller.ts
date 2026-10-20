import {
  Request,
  Response,
} from "express";

import {
  PickupPointType,
} from "../generated/prisma/client";

import {
  prisma,
} from "../lib/prisma";

import type {
  AuthenticatedRequest,
} from "../middleware/auth.middleware";

import {
  getSellerEligibility,
} from "../services/sellerEligibility.service";

const MAX_ACTIVE_PICKUP_POINTS =
  10;

function cleanText(
  value: unknown
) {
  if (
    typeof value !==
    "string"
  ) {
    return "";
  }

  return value.trim();
}

function cleanOptionalText(
  value: unknown
) {
  const valueText =
    cleanText(
      value
    );

  return valueText ||
    null;
}

function validPickupType(
  value: unknown
): value is PickupPointType {
  return Object.values(
    PickupPointType
  ).includes(
    value as
      PickupPointType
  );
}

function legacyPickupPoint(
  vendorId: string,
  pickupLocation: string
) {
  return {
    id:
      `legacy:${vendorId}`,

    type:
      PickupPointType.custom,

    label:
      pickupLocation,

    detail:
      null,

    isLegacy:
      true,
  };
}

/*
 * =======================================================
 * SELLER'S OWN PICKUP POINTS
 * =======================================================
 */

export const getMyVendorPickupPoints =
  async (
    req: AuthenticatedRequest,
    res: Response
  ) => {
    try {
      if (!req.user) {
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

      const [
        points,
        profile,
      ] =
        await Promise.all([
          prisma.vendorPickupPoint.findMany({
            where: {
              vendorId,

              isActive:
                true,
            },

            orderBy: [
              {
                createdAt:
                  "asc",
              },

              {
                id:
                  "asc",
              },
            ],
          }),

          prisma.vendorProfile.findUnique({
            where: {
              userId:
                vendorId,
            },

            select: {
              pickupLocation:
                true,
            },
          }),
        ]);

      const responsePoints =
        points.length >
        0
          ? points.map(
              (
                point
              ) => ({
                id:
                  point.id,

                type:
                  point.type,

                label:
                  point.label,

                detail:
                  point.detail,

                isLegacy:
                  false,
              })
            )
          : profile
              ?.pickupLocation
              ?.trim()
            ? [
                legacyPickupPoint(
                  vendorId,
                  profile.pickupLocation.trim()
                ),
              ]
            : [];

      return res.json({
        success:
          true,

        pickupPoints:
          responsePoints,
      });
    } catch (error) {
      console.error(
        "Get vendor pickup points error:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            "Unable to load pickup points.",
        });
    }
  };

/*
 * =======================================================
 * CREATE PICKUP POINT
 * =======================================================
 */

export const createVendorPickupPoint =
  async (
    req: AuthenticatedRequest,
    res: Response
  ) => {
    try {
      if (!req.user) {
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
        type,
        label,
        detail,
      } =
        req.body;

      if (
        !validPickupType(
          type
        )
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Choose a valid pickup-point type.",
          });
      }

      const cleanLabel =
        cleanText(
          label
        );

      const cleanDetail =
        cleanOptionalText(
          detail
        );

      if (
        cleanLabel.length <
          2 ||
        cleanLabel.length >
          80
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Pickup-point name must be between 2 and 80 characters.",
          });
      }

      if (
        cleanDetail &&
        cleanDetail.length >
          160
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Pickup instructions can be up to 160 characters.",
          });
      }

      const activeCount =
        await prisma.vendorPickupPoint.count({
          where: {
            vendorId:
              req.user.id,

            isActive:
              true,
          },
        });

      if (
        activeCount >=
        MAX_ACTIVE_PICKUP_POINTS
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              `You can currently keep up to ${MAX_ACTIVE_PICKUP_POINTS} active pickup points.`,
          });
      }

      const point =
        await prisma.vendorPickupPoint.create({
          data: {
            vendorId:
              req.user.id,

            type,

            label:
              cleanLabel,

            detail:
              cleanDetail,
          },
        });

      return res
        .status(201)
        .json({
          success:
            true,

          message:
            "Pickup point added.",

          pickupPoint: {
            id:
              point.id,

            type:
              point.type,

            label:
              point.label,

            detail:
              point.detail,

            isLegacy:
              false,
          },
        });
    } catch (error) {
      console.error(
        "Create vendor pickup point error:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            "Unable to add pickup point.",
        });
    }
  };

/*
 * =======================================================
 * UPDATE PICKUP POINT
 * =======================================================
 */

export const updateVendorPickupPoint =
  async (
    req: AuthenticatedRequest,
    res: Response
  ) => {
    try {
      if (!req.user) {
        return res
          .status(401)
          .json({
            success:
              false,

            message:
              "Authentication required.",
          });
      }

      const pickupPointId =
        cleanText(
          req.params.pickupPointId
        );

      const {
        type,
        label,
        detail,
      } =
        req.body;

      if (
        !pickupPointId ||
        !validPickupType(
          type
        )
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Invalid pickup point.",
          });
      }

      const cleanLabel =
        cleanText(
          label
        );

      const cleanDetail =
        cleanOptionalText(
          detail
        );

      if (
        cleanLabel.length <
          2 ||
        cleanLabel.length >
          80
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Pickup-point name must be between 2 and 80 characters.",
          });
      }

      if (
        cleanDetail &&
        cleanDetail.length >
          160
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Pickup instructions can be up to 160 characters.",
          });
      }

      const existing =
        await prisma.vendorPickupPoint.findFirst({
          where: {
            id:
              pickupPointId,

            vendorId:
              req.user.id,

            isActive:
              true,
          },

          select: {
            id:
              true,
          },
        });

      if (!existing) {
        return res
          .status(404)
          .json({
            success:
              false,

            message:
              "Pickup point not found.",
          });
      }

      const point =
        await prisma.vendorPickupPoint.update({
          where: {
            id:
              pickupPointId,
          },

          data: {
            type,

            label:
              cleanLabel,

            detail:
              cleanDetail,
          },
        });

      return res.json({
        success:
          true,

        message:
          "Pickup point updated.",

        pickupPoint: {
          id:
            point.id,

          type:
            point.type,

          label:
            point.label,

          detail:
            point.detail,

          isLegacy:
            false,
        },
      });
    } catch (error) {
      console.error(
        "Update vendor pickup point error:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            "Unable to update pickup point.",
        });
    }
  };

/*
 * =======================================================
 * REMOVE PICKUP POINT
 * =======================================================
 *
 * Soft removal preserves historical order references.
 */

export const removeVendorPickupPoint =
  async (
    req: AuthenticatedRequest,
    res: Response
  ) => {
    try {
      if (!req.user) {
        return res
          .status(401)
          .json({
            success:
              false,

            message:
              "Authentication required.",
          });
      }

      const pickupPointId =
        cleanText(
          req.params.pickupPointId
        );

      const existing =
        await prisma.vendorPickupPoint.findFirst({
          where: {
            id:
              pickupPointId,

            vendorId:
              req.user.id,

            isActive:
              true,
          },

          select: {
            id:
              true,
          },
        });

      if (!existing) {
        return res
          .status(404)
          .json({
            success:
              false,

            message:
              "Pickup point not found.",
          });
      }

      await prisma.vendorPickupPoint.update({
        where: {
          id:
            pickupPointId,
        },

        data: {
          isActive:
            false,
        },
      });

      return res.json({
        success:
          true,

        message:
          "Pickup point removed.",
      });
    } catch (error) {
      console.error(
        "Remove vendor pickup point error:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            "Unable to remove pickup point.",
        });
    }
  };

/*
 * =======================================================
 * PUBLIC CHECKOUT PICKUP POINTS
 * =======================================================
 */

export const getPublicVendorPickupPoints =
  async (
    req: Request,
    res: Response
  ) => {
    try {
      const vendorId =
        cleanText(
          req.params.vendorId
        );

      if (!vendorId) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Invalid seller.",
          });
      }

      let eligibility;

      try {
        eligibility =
          await getSellerEligibility(
            vendorId
          );
      } catch {
        return res
          .status(404)
          .json({
            success:
              false,

            message:
              "Seller pickup options are unavailable.",
          });
      }

      if (
        !eligibility.canSell
      ) {
        return res
          .status(404)
          .json({
            success:
              false,

            message:
              "Seller pickup options are unavailable.",
          });
      }

      const [
        points,
        profile,
      ] =
        await Promise.all([
          prisma.vendorPickupPoint.findMany({
            where: {
              vendorId,

              isActive:
                true,
            },

            orderBy: [
              {
                createdAt:
                  "asc",
              },

              {
                id:
                  "asc",
              },
            ],

            select: {
              id:
                true,

              type:
                true,

              label:
                true,

              detail:
                true,
            },
          }),

          prisma.vendorProfile.findUnique({
            where: {
              userId:
                vendorId,
            },

            select: {
              pickupLocation: true,
              user: { select: { universityId: true } },
            },
          }),
        ]);

      const responsePoints =
        points.length >
        0
          ? points.map(
              (
                point
              ) => ({
                ...point,

                isLegacy:
                  false,
              })
            )
          : profile
              ?.pickupLocation
              ?.trim()
            ? [
                legacyPickupPoint(
                  vendorId,
                  profile.pickupLocation.trim()
                ),
              ]
            : [];

      return res.json({
        success:
          true,

        vendorId,
        universityId: profile?.user.universityId ?? null,

        pickupPoints:
          responsePoints,

        delivery: {
          available:
            false,

          label:
            "Door delivery",

          message:
            "Coming soon",
        },
      });
    } catch (error) {
      console.error(
        "Public vendor pickup points error:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            "Unable to load pickup options.",
        });
    }
  };