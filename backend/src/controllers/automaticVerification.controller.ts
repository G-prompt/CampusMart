import {
  Response,
} from "express";

import type {
  AuthenticatedRequest,
} from "../middleware/auth.middleware";

import {
  AutomaticStudentVerificationError,
  runAutomaticStudentVerification,
} from "../services/studentAutomaticVerification.service";

/*
 * =======================================================
 * CAMPUSMART AUTOMATIC STUDENT VERIFICATION CONTROLLER
 * =======================================================
 *
 * POST /api/verification/automatic
 *
 * The customer does NOT submit a user ID.
 *
 * The authenticated JWT determines which account is
 * being verified:
 *
 * req.user.id
 *
 * The service reads the student's existing:
 *
 * - official account name
 * - university
 * - matric number
 *
 * and runs those details through the university
 * verification orchestrator.
 *
 * This endpoint deliberately does NOT:
 *
 * - accept another user's ID
 * - accept a replacement name
 * - accept a replacement matric number
 * - create a Manual review appeal automatically
 * - expose roster records
 * - expose provider internals
 */

/*
 * =======================================================
 * AUTOMATIC VERIFICATION
 * =======================================================
 */

export const runAutomaticVerification =
  async (
    req:
      AuthenticatedRequest,

    res:
      Response
  ) => {
    try {
      /*
       * requireAuth should already have populated req.user,
       * but keep a defensive check here as well.
       */
      if (
        !req.user
      ) {
        return res
          .status(401)
          .json({
            success:
              false,

            code:
              "AUTHENTICATION_REQUIRED",

            message:
              "Authentication required.",
          });
      }

      const result =
        await runAutomaticStudentVerification(
          req.user.id
        );

      /*
       * -------------------------------------------------
       * VERIFIED
       * -------------------------------------------------
       */

      if (
        result.decision ===
        "verified"
      ) {
        return res
          .status(200)
          .json({
            success:
              true,

            verification: {
              decision:
                result.decision,

              studentVerificationStatus:
                result.studentVerificationStatus,

              studentVerificationSource:
                result.studentVerificationSource,

              studentVerifiedAt:
                result.studentVerifiedAt,

              manualReviewAllowed:
                false,

              definitiveFailure:
                false,

              failureCode:
                null,

              message:
                result.publicMessage,
            },
          });
      }

      /*
       * -------------------------------------------------
       * ALREADY VERIFIED
       * -------------------------------------------------
       */

      if (
        result.decision ===
        "already_verified"
      ) {
        return res
          .status(200)
          .json({
            success:
              true,

            verification: {
              decision:
                result.decision,

              studentVerificationStatus:
                result.studentVerificationStatus,

              studentVerificationSource:
                result.studentVerificationSource,

              studentVerifiedAt:
                result.studentVerifiedAt,

              manualReviewAllowed:
                false,

              definitiveFailure:
                false,

              failureCode:
                null,

              message:
                result.publicMessage,
            },
          });
      }

      /*
       * -------------------------------------------------
       * DEFINITIVE FAILURE
       * -------------------------------------------------
       *
       * This is still a successfully-executed API request.
       *
       * The verification attempt itself produced a
       * legitimate negative result, so HTTP 200 is more
       * useful than treating the business decision as a
       * transport/server error.
       */

      if (
        result.decision ===
        "failed"
      ) {
        return res
          .status(200)
          .json({
            success:
              true,

            verification: {
              decision:
                result.decision,

              studentVerificationStatus:
                result.studentVerificationStatus,

              studentVerificationSource:
                result.studentVerificationSource,

              studentVerifiedAt:
                result.studentVerifiedAt,

              manualReviewAllowed:
                false,

              definitiveFailure:
                true,

              failureCode:
                result.failureCode,

              message:
                result.publicMessage,
            },
          });
      }

      /*
       * -------------------------------------------------
       * MANUAL REVIEW AVAILABLE
       * -------------------------------------------------
       *
       * Important:
       *
       * This endpoint does not create an appeal.
       *
       * The frontend may now offer the existing Manual
       * review flow.
       */

      if (
        result.decision ===
        "manual_review_available"
      ) {
        return res
          .status(200)
          .json({
            success:
              true,

            verification: {
              decision:
                result.decision,

              studentVerificationStatus:
                result.studentVerificationStatus,

              studentVerificationSource:
                result.studentVerificationSource,

              studentVerifiedAt:
                result.studentVerifiedAt,

              manualReviewAllowed:
                true,

              definitiveFailure:
                false,

              failureCode:
                result.failureCode,

              message:
                result.publicMessage,
            },
          });
      }

      /*
       * -------------------------------------------------
       * PROFILE INCOMPLETE
       * -------------------------------------------------
       */

      if (
        result.decision ===
        "profile_incomplete"
      ) {
        return res
          .status(200)
          .json({
            success:
              true,

            verification: {
              decision:
                result.decision,

              studentVerificationStatus:
                result.studentVerificationStatus,

              studentVerificationSource:
                result.studentVerificationSource,

              studentVerifiedAt:
                result.studentVerifiedAt,

              manualReviewAllowed:
                false,

              definitiveFailure:
                false,

              failureCode:
                null,

              message:
                result.publicMessage,
            },
          });
      }

      /*
       * -------------------------------------------------
       * UNIVERSITY / VERIFICATION UNAVAILABLE
       * -------------------------------------------------
       */

      if (
        result.decision ===
          "verification_disabled" ||
        result.decision ===
          "university_unavailable"
      ) {
        return res
          .status(200)
          .json({
            success:
              true,

            verification: {
              decision:
                result.decision,

              studentVerificationStatus:
                result.studentVerificationStatus,

              studentVerificationSource:
                result.studentVerificationSource,

              studentVerifiedAt:
                result.studentVerifiedAt,

              manualReviewAllowed:
                false,

              definitiveFailure:
                false,

              failureCode:
                result.failureCode,

              message:
                result.publicMessage,
            },
          });
      }

      /*
       * -------------------------------------------------
       * UNRESOLVED
       * -------------------------------------------------
       *
       * No provider could decide and Manual review is not
       * available.
       */

      return res
        .status(200)
        .json({
          success:
            true,

          verification: {
            decision:
              "unresolved",

            studentVerificationStatus:
              result.studentVerificationStatus,

            studentVerificationSource:
              result.studentVerificationSource,

            studentVerifiedAt:
              result.studentVerifiedAt,

            manualReviewAllowed:
              false,

            definitiveFailure:
              false,

            failureCode:
              result.failureCode,

            message:
              result.publicMessage,
          },
        });
    } catch (
      error
    ) {
      if (
        error instanceof
        AutomaticStudentVerificationError
      ) {
        return res
          .status(
            error.statusCode
          )
          .json({
            success:
              false,

            code:
              error.code,

            message:
              error.message,
          });
      }

      console.error(
        "Automatic student verification failed:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          code:
            "AUTOMATIC_VERIFICATION_FAILED",

          message:
            "Unable to complete automatic student verification.",
        });
    }
  };