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
  normalizeMatricNumber,
  validateMatricNumber,
} from "../lib/studentVerification";

import {
  getSellerEligibility,
  reconcileSellerAccess,
} from "../services/sellerEligibility.service";

/*
 * =======================================================
 * TEXT HELPERS
 * =======================================================
 */

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

  return cleaned
    ? cleaned
    : null;
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
 * IMPORTANT:
 *
 * Public seller visibility now uses the same canonical
 * seller eligibility service used by products, checkout,
 * messaging and seller actions.
 *
 * Merely having accessStatus=active is not enough if the
 * rest of the seller requirements are no longer valid.
 *
 * This endpoint remains READ ONLY. Public browsing must
 * never reconcile or mutate seller state.
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
 * - pickupLocation
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

      /*
       * Canonical read-only eligibility.
       *
       * We deliberately do NOT call
       * reconcileSellerAccess() here because a buyer
       * browsing a storefront must not mutate seller
       * account state.
       */

      let eligibility;

      try {
        eligibility =
          await getSellerEligibility(
            vendorId
          );
      } catch (
        eligibilityError
      ) {
        if (
          eligibilityError instanceof
            Error &&
          eligibilityError.message ===
            "USER_NOT_FOUND"
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

        throw eligibilityError;
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
              "Seller storefront not available.",
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
       * Keep the public response deliberately identical
       * for unavailable sellers.
       */

      if (
        !vendor ||
        vendor.role !==
          UserRole.vendor ||
        !vendor.vendorProfile
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

      // Only actively granted recognition badges; no internal reasons or audit details.
      const recognition = await prisma.sellerBadgeAward.findMany({
        where: { vendorId: vendor.id, active: true },
        select: { kind: true },
      });

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
              recognition: recognition.map((badge) => badge.kind),
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
 * UPGRADE BUYER TO SELLER
 * =======================================================
 *
 * POST /api/vendor/upgrade
 *
 * Converts an EXISTING CampusMart buyer account into a
 * seller account without creating a second account.
 *
 * Existing:
 *
 * - identity
 * - university
 * - verification
 * - buyer history
 * - orders
 * - saved items
 * - messages
 *
 * remain attached to the same user ID.
 *
 * Only missing seller-specific information is supplied.
 */

export const upgradeBuyerToVendor =
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

      const requestedPhone =
        cleanOptionalText(
          req.body.phone
        );

      const requestedMatric =
        cleanOptionalText(
          req.body
            .matricNumber
        );

      /*
       * Seller-specific profile fields are always required.
       */

      if (!businessName) {
        return res
          .status(400)
          .json({
            success:
              false,

            code:
              "BUSINESS_NAME_REQUIRED",

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

            code:
              "BUSINESS_DESCRIPTION_REQUIRED",

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

            code:
              "PICKUP_LOCATION_REQUIRED",

            message:
              "Pickup location is required.",
          });
      }

      /*
       * Load the buyer's existing identity.
       *
       * We preserve all existing buyer history and simply
       * expand the same user account into seller mode.
       */

      const currentUser =
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

            phone:
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

                active:
                  true,
                sellerApplicationsOpen: true,

                matricValidationEnabled:
                  true,

                matricPattern:
                  true,

                matricFormatHint:
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
              },
            },
          },
        });

      if (!currentUser) {
        return res
          .status(404)
          .json({
            success:
              false,

            message:
              "User account not found.",
          });
      }

      /*
       * Existing vendors should use the normal seller
       * setup/dashboard flow instead of re-running the
       * upgrade operation.
       */

      if (
        currentUser.role ===
        UserRole.vendor
      ) {
        const eligibility =
          await reconcileSellerAccess(
            currentUser.id
          );

        return res
          .status(409)
          .json({
            success:
              false,

            code:
              "ALREADY_SELLER",

            message:
              "This account is already registered as a seller.",

            eligibility,
          });
      }

      /*
       * A client should never already own a VendorProfile.
       * If legacy/inconsistent data does exist, do not
       * silently create a second seller profile.
       */

      if (
        currentUser.vendorProfile
      ) {
        return res
          .status(409)
          .json({
            success:
              false,

            code:
              "SELLER_PROFILE_ALREADY_EXISTS",

            message:
              "A seller profile is already associated with this account. Contact CampusMart support.",
          });
      }

      if (currentUser.university && !currentUser.university.sellerApplicationsOpen) {
        return res.status(409).json({ success: false, code: "SELLER_ONBOARDING_NOT_OPEN",
          message: "Selling is coming to your campus! You can keep shopping on CampusMart. We'll let you know when seller applications open." });
      }

      /*
       * Buyer registration normally already provides
       * university details.
       *
       * Legacy accounts might not, so guard against that
       * rather than creating an unusable seller.
       */

      const hasListedUniversity =
        Boolean(
          currentUser.universityId &&
          currentUser.university
        );

      const hasFallbackUniversity =
        Boolean(
          currentUser
            .fallbackUniversityName
            ?.trim() &&
          currentUser
            .fallbackState
            ?.trim() &&
          currentUser
            .fallbackCity
            ?.trim()
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
              "Add your university details before becoming a seller.",
          });
      }

      if (
        currentUser.universityId &&
        !currentUser.university
      ) {
        return res
          .status(409)
          .json({
            success:
              false,

            code:
              "UNIVERSITY_NOT_AVAILABLE",

            message:
              "Your university is not currently available for seller registration.",
          });
      }

      if (
        currentUser.university &&
        !currentUser.university
          .active
      ) {
        return res
          .status(409)
          .json({
            success:
              false,

            code:
              "UNIVERSITY_NOT_AVAILABLE",

            message:
              "Your university is not currently available for seller registration.",
          });
      }

      /*
       * Vendors must have a phone number.
       *
       * Existing buyer phone is reused automatically.
       * The upgrade form only needs to ask for it when it
       * is missing.
       */

      const phone =
        requestedPhone ??
        currentUser.phone?.trim() ??
        null;

      if (!phone) {
        return res
          .status(400)
          .json({
            success:
              false,

            code:
              "PHONE_REQUIRED",

            message:
              "Add a phone number before becoming a seller.",
          });
      }

      /*
       * Listed universities require a matric number.
       *
       * Existing matric information is reused.
       * Otherwise the upgrade form supplies the missing
       * matric number.
       */

      let normalizedMatricNumber =
        currentUser.matricNumber;

      if (
        hasListedUniversity &&
        currentUser.university
      ) {
        const candidateMatric =
          requestedMatric ??
          currentUser.matricNumber;

        if (!candidateMatric) {
          return res
            .status(400)
            .json({
              success:
                false,

              code:
                "MATRIC_REQUIRED",

              message:
                `Enter your ${currentUser.university.shortName} matric number before becoming a seller.`,

              matricFormatHint:
                currentUser
                  .university
                  .matricFormatHint,
            });
        }

        const matricResult =
          validateMatricNumber(
            candidateMatric,
            currentUser.university
          );

        if (
          !matricResult.valid
        ) {
          return res
            .status(400)
            .json({
              success:
                false,

              code:
                matricResult.errorCode,

              message:
                matricResult.message,

              matricFormatHint:
                matricResult.formatHint,
            });
        }

        normalizedMatricNumber =
          matricResult
            .normalizedMatricNumber;

        /*
         * A university identity may only belong to one
         * CampusMart account.
         */

        const duplicateStudent =
          await prisma.user.findFirst({
            where: {
              id: {
                not:
                  currentUser.id,
              },

              universityId:
                currentUser.university
                  .id,

              matricNumber:
                normalizedMatricNumber,
            },

            select: {
              id:
                true,
            },
          });

        if (
          duplicateStudent
        ) {
          return res
            .status(409)
            .json({
              success:
                false,

              code:
                "STUDENT_RECORD_ALREADY_USED",

              message:
                "This student record is already associated with another CampusMart account. If you believe this is your record, contact support.",
            });
        }
      } else if (
        requestedMatric
      ) {
        /*
         * Matric numbers are optional for universities
         * that are not yet managed by CampusMart.
         */

        normalizedMatricNumber =
          normalizeMatricNumber(
            requestedMatric
          );
      }

      /*
       * Initial seller access.
       *
       * A buyer who had already completed student
       * verification should not be forced through that
       * verification again merely because they decided to
       * sell later.
       *
       * Everyone else begins in pending_review until the
       * canonical seller requirements are complete.
       */

      const initialAccessStatus =
        currentUser
          .studentVerificationStatus ===
        StudentVerificationStatus.verified
          ? VendorAccessStatus.active
          : VendorAccessStatus.pending_review;

      /*
       * Convert the existing account and create its seller
       * profile atomically.
       *
       * No second User is created.
       * No buyer history is moved or copied.
       */

      await prisma.$transaction(
        async (
          transaction
        ) => {
          await transaction.user.update({
            where: {
              id:
                currentUser.id,
            },

            data: {
              role:
                UserRole.vendor,

              phone,

              matricNumber:
                normalizedMatricNumber,
            },
          });

          await transaction.vendorProfile.create({
            data: {
              userId:
                currentUser.id,

              businessName,

              businessDescription,

              pickupLocation,

              accessStatus:
                initialAccessStatus,
            },
          });
        }
      );

      /*
       * Run the exact same canonical reconciliation used
       * everywhere else.
       *
       * This handles the case where an already-verified
       * buyer now satisfies every seller requirement.
       */

      const eligibility =
        await reconcileSellerAccess(
          currentUser.id
        );

      return res
        .status(201)
        .json({
          success:
            true,

          message:
            eligibility.canSell
              ? "Your CampusMart account is now a seller account and is ready to sell."
              : "Your CampusMart account is now a seller account. You can continue buying normally while you complete the remaining seller requirements.",

          eligibility,
        });
    } catch (
      error
    ) {
      console.error(
        "Upgrade buyer to vendor error:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            "Unable to set up seller access.",
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
 *
 * Used by vendor accounts that already have the vendor
 * role but do not yet own a VendorProfile.
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
       * Re-evaluate from persisted database state.
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