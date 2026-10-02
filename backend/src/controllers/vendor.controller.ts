import { Response } from "express";

import type { AuthenticatedRequest } from "../middleware/auth.middleware";

import { prisma } from "../lib/prisma";

import {
  StudentVerificationStatus,
  UserRole,
  VendorAccessStatus,
} from "../generated/prisma/client";

function cleanRequiredText(
  value: unknown
): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

export const completeVendorProfile =
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

      if (
        req.user.role !==
        UserRole.vendor
      ) {
        return res.status(403).json({
          success: false,

          code:
            "VENDOR_ROLE_REQUIRED",

          message:
            "This account is not registered as a seller.",
        });
      }

      const businessName =
        cleanRequiredText(
          req.body.businessName
        );

      const businessDescription =
        cleanRequiredText(
          req.body.businessDescription
        );

      const pickupLocation =
        cleanRequiredText(
          req.body.pickupLocation
        );

      if (!businessName) {
        return res.status(400).json({
          success: false,

          message:
            "Shop or business name is required.",
        });
      }

      if (
        !businessDescription
      ) {
        return res.status(400).json({
          success: false,

          message:
            "Please describe what you sell.",
        });
      }

      if (!pickupLocation) {
        return res.status(400).json({
          success: false,

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
            id: true,
            role: true,

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
                id: true,
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
        return res.status(404).json({
          success: false,

          message:
            "User account not found.",
        });
      }

      if (
        user.role !==
        UserRole.vendor
      ) {
        return res.status(403).json({
          success: false,

          code:
            "VENDOR_ROLE_REQUIRED",

          message:
            "This account is not registered as a seller.",
        });
      }

      /*
       * Do not create a second
       * VendorProfile.
       */
      if (user.vendorProfile) {
        return res.status(409).json({
          success: false,

          code:
            "VENDOR_PROFILE_ALREADY_EXISTS",

          message:
            "Your seller profile has already been set up.",

          vendorProfile:
            user.vendorProfile,
        });
      }

      /*
       * Legacy seller accounts must first
       * enter their university/student
       * information.
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
        return res.status(409).json({
          success: false,

          code:
            "STUDENT_DETAILS_REQUIRED",

          message:
            "Complete your university details before setting up your seller profile.",
        });
      }

      /*
       * Sellers attached to a listed
       * university must also have their
       * matric number stored.
       */
      if (
        hasListedUniversity &&
        !user.matricNumber
      ) {
        return res.status(409).json({
          success: false,

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
       * Student verification controls
       * seller access.
       *
       * Verified student:
       *   seller access can be active.
       *
       * Not yet verified:
       *   seller profile exists, but
       *   seller access stays pending.
       *
       * Vendor verification remains a
       * separate stronger trust check.
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
            id: true,

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

      return res.status(201).json({
        success: true,

        message:
          accessStatus ===
          VendorAccessStatus.active
            ? "Your seller profile has been created and seller access is active."
            : "Your seller profile has been created. You can continue buying normally while your student verification is pending.",

        vendorProfile,
      });
    } catch (error) {
      console.error(
        "Complete vendor profile error:",
        error
      );

      return res.status(500).json({
        success: false,

        message:
          "Unable to complete your seller profile.",
      });
    }
  };