import {
  Request,
  Response,
} from "express";

import type {
  AuthenticatedRequest,
} from "../middleware/auth.middleware";

import {
  prisma,
} from "../lib/prisma";

import {
  StudentVerificationStatus,
  UserRole,
  VendorAccessStatus,
  VendorVerificationStatus,
} from "../generated/prisma/client";

import {
  reconcileSellerAccess,
} from "../services/sellerEligibility.service";

function cleanRequiredText(
  value: unknown
): string {
  if (
    typeof value !==
    "string"
  ) {
    return "";
  }

  return value.trim();
}

/*
 * =======================================================
 * PUBLIC SELLER STOREFRONT
 * =======================================================
 *
 * GET /api/vendor/storefront/:vendorId
 *
 * Public endpoint.
 *
 * Only active seller storefronts are exposed.
 *
 * Public response deliberately excludes:
 *
 * - email
 * - phone
 * - matric number
 * - verification source
 * - internal access status
 * - verification timestamps
 * - private account information
 * - pickupLocation for now
 *
 * Only published products are returned.
 */

export const getPublicVendorStorefront =
  async (
    req: Request,
    res: Response
  ) => {
    try {
      const vendorId =
        String(
          req.params.vendorId ??
            ""
        ).trim();

      if (!vendorId) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Invalid seller ID.",
          });
      }

      const vendor =
        await prisma.user.findUnique({
          where: {
            id:
              vendorId,
          },

          select: {
            id:
              true,

            name:
              true,

            role:
              true,

            createdAt:
              true,

            studentVerificationStatus:
              true,

            universityId:
              true,

            university: {
              select: {
                id:
                  true,

                name:
                  true,

                shortName:
                  true,

                state:
                  true,

                city:
                  true,
              },
            },

            fallbackUniversityName:
              true,

            fallbackState:
              true,

            fallbackCity:
              true,

            vendorProfile: {
              select: {
                businessName:
                  true,

                businessDescription:
                  true,

                accessStatus:
                  true,

                vendorVerificationStatus:
                  true,
              },
            },

            products: {
              where: {
                isArchived:
                  false,
              },

              select: {
                id:
                  true,

                slug:
                  true,

                title:
                  true,

                category:
                  true,

                price:
                  true,

                rating:
                  true,

                description:
                  true,

                images:
                  true,

                createdAt:
                  true,
              },

              orderBy: {
                createdAt:
                  "desc",
              },
            },
          },
        });

      /*
       * Return the same public response for:
       *
       * - unknown user
       * - non-vendor account
       * - vendor without completed profile
       * - inactive seller storefront
       *
       * This avoids leaking unnecessary internal account
       * state through the public endpoint.
       */

      if (
        !vendor ||
        vendor.role !==
          UserRole.vendor ||
        !vendor.vendorProfile ||
        vendor.vendorProfile
          .accessStatus !==
          VendorAccessStatus.active
      ) {
        return res
          .status(404)
          .json({
            success:
              false,

            message:
              "Seller storefront not available.",
          });
      }

      const studentVerified =
        vendor.studentVerificationStatus ===
        StudentVerificationStatus.verified;

      const vendorVerified =
        vendor.vendorProfile
          .vendorVerificationStatus ===
        VendorVerificationStatus.verified;

      const university =
        vendor.university
          ? {
              id:
                vendor.university.id,

              name:
                vendor.university.name,

              shortName:
                vendor.university.shortName,

              state:
                vendor.university.state,

              city:
                vendor.university.city,

              managed:
                true,
            }
          : vendor.fallbackUniversityName
            ? {
                id:
                  null,

                name:
                  vendor.fallbackUniversityName,

                shortName:
                  null,

                state:
                  vendor.fallbackState,

                city:
                  vendor.fallbackCity,

                managed:
                  false,
              }
            : null;

      const products =
        vendor.products.map(
          (
            product
          ) => ({
            id:
              product.id,

            slug:
              product.slug,

            title:
              product.title,

            category:
              product.category,

            price:
              product.price,

            rating:
              product.rating,

            description:
              product.description,

            images:
              product.images,

            createdAt:
              product.createdAt,
          })
        );

      return res
        .status(200)
        .json({
          success:
            true,

          storefront: {
            sellerId:
              vendor.id,

            ownerName:
              vendor.name,

            businessName:
              vendor.vendorProfile
                .businessName,

            description:
              vendor.vendorProfile
                .businessDescription,

            university,

            badges: {
              studentVerified,

              vendorVerified,
            },

            memberSince:
              vendor.createdAt,

            listingCount:
              products.length,
          },

          products,
        });
    } catch (
      error
    ) {
      console.error(
        "Get public vendor storefront error:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            "Unable to load seller storefront.",
        });
    }
  };

/*
 * =======================================================
 * GET SELLER ELIGIBILITY
 * =======================================================
 *
 * GET /api/vendor/eligibility
 *
 * This endpoint also reconciles safe automatic seller
 * access transitions before returning the result.
 */

export const getVendorEligibility =
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

      if (
        req.user.role !==
        UserRole.vendor
      ) {
        return res
          .status(403)
          .json({
            success:
              false,

            code:
              "VENDOR_ROLE_REQUIRED",

            message:
              "This account is not registered as a seller.",
          });
      }

      const eligibility =
        await reconcileSellerAccess(
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
        "Get vendor eligibility error:",
        error
      );

      if (
        error instanceof
          Error &&
        error.message ===
          "USER_NOT_FOUND"
      ) {
        return res
          .status(404)
          .json({
            success:
              false,

            message:
              "User account not found.",
          });
      }

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            "Unable to check seller eligibility.",
        });
    }
  };

/*
 * =======================================================
 * COMPLETE SELLER PROFILE
 * =======================================================
 */

export const completeVendorProfile =
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

      if (
        req.user.role !==
        UserRole.vendor
      ) {
        return res
          .status(403)
          .json({
            success:
              false,

            code:
              "VENDOR_ROLE_REQUIRED",

            message:
              "This account is not registered as a seller.",
          });
      }

      const businessName =
        cleanRequiredText(
          req.body
            .businessName
        );

      const businessDescription =
        cleanRequiredText(
          req.body
            .businessDescription
        );

      const pickupLocation =
        cleanRequiredText(
          req.body
            .pickupLocation
        );

      if (!businessName) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Shop or business name is required.",
          });
      }

      if (
        !businessDescription
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Please describe what you sell.",
          });
      }

      if (
        !pickupLocation
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Pickup location is required.",
          });
      }

      const user =
        await prisma.user.findUnique({
          where: {
            id:
              req.user.id,
          },

          select: {
            id:
              true,

            role:
              true,

            universityId:
              true,

            university: {
              select: {
                shortName:
                  true,
              },
            },

            matricNumber:
              true,

            fallbackUniversityName:
              true,

            fallbackState:
              true,

            fallbackCity:
              true,

            studentVerificationStatus:
              true,

            vendorProfile: {
              select: {
                id:
                  true,

                businessName:
                  true,

                businessDescription:
                  true,

                pickupLocation:
                  true,

                accessStatus:
                  true,

                vendorVerificationStatus:
                  true,
              },
            },
          },
        });

      if (!user) {
        return res
          .status(404)
          .json({
            success:
              false,

            message:
              "User account not found.",
          });
      }

      if (
        user.role !==
        UserRole.vendor
      ) {
        return res
          .status(403)
          .json({
            success:
              false,

            code:
              "VENDOR_ROLE_REQUIRED",

            message:
              "This account is not registered as a seller.",
          });
      }

      /*
       * Do not create a second VendorProfile.
       */

      if (
        user.vendorProfile
      ) {
        return res
          .status(409)
          .json({
            success:
              false,

            code:
              "VENDOR_PROFILE_ALREADY_EXISTS",

            message:
              "Your seller profile has already been set up.",

            vendorProfile:
              user.vendorProfile,
          });
      }

      /*
       * Legacy seller accounts must first enter university
       * or fallback university/location information.
       */

      const hasListedUniversity =
        Boolean(
          user.universityId
        );

      const hasFallbackUniversity =
        Boolean(
          user.fallbackUniversityName &&
          user.fallbackState &&
          user.fallbackCity
        );

      if (
        !hasListedUniversity &&
        !hasFallbackUniversity
      ) {
        return res
          .status(409)
          .json({
            success:
              false,

            code:
              "STUDENT_DETAILS_REQUIRED",

            message:
              "Complete your university details before setting up your seller profile.",
          });
      }

      /*
       * Managed universities require a matric number.
       */

      if (
        hasListedUniversity &&
        !user.matricNumber
      ) {
        return res
          .status(409)
          .json({
            success:
              false,

            code:
              "MATRIC_REQUIRED",

            message:
              user.university
                ?.shortName
                ? `Enter your ${user.university.shortName} matric number before completing your seller profile.`
                : "Enter your matric number before completing your seller profile.",
          });
      }

      /*
       * Student verification controls the INITIAL seller
       * access state.
       *
       * The reconciliation service will continue keeping
       * safe active/pending transitions in sync later.
       */

      const accessStatus =
        user.studentVerificationStatus ===
        StudentVerificationStatus.verified
          ? VendorAccessStatus.active
          : VendorAccessStatus.pending_review;

      const vendorProfile =
        await prisma.vendorProfile.create({
          data: {
            userId:
              user.id,

            businessName,

            businessDescription,

            pickupLocation,

            accessStatus,
          },

          select: {
            id:
              true,

            businessName:
              true,

            businessDescription:
              true,

            pickupLocation:
              true,

            verified:
              true,

            accessStatus:
              true,

            vendorVerificationStatus:
              true,

            verificationSubmittedAt:
              true,

            vendorVerifiedAt:
              true,

            createdAt:
              true,
          },
        });

      /*
       * Re-evaluate from the persisted database state so
       * the API response uses the same central eligibility
       * rules as every later seller action.
       */

      const eligibility =
        await reconcileSellerAccess(
          user.id
        );

      return res
        .status(201)
        .json({
          success:
            true,

          message:
            eligibility.canSell
              ? "Your seller profile has been created and seller access is active."
              : "Your seller profile has been created. You can continue buying normally while you complete the requirements needed to sell.",

          vendorProfile,

          eligibility,
        });
    } catch (
      error
    ) {
      console.error(
        "Complete vendor profile error:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            "Unable to complete your seller profile.",
        });
    }
  };