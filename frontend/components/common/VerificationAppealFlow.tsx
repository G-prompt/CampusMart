"use client";

import {
  useState,
} from "react";

import ManualVerificationAppealFlow, {
  type VerificationAppeal,
} from "./ManualVerificationAppealFlow";

export type {
  VerificationAppeal,
  VerificationAppealReason,
  VerificationAppealStatus,
  VerificationEvidence,
  VerificationEvidenceType,
} from "./ManualVerificationAppealFlow";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:5000";

type AutomaticVerificationDecision =
  | "verified"
  | "failed"
  | "manual_review_available"
  | "unresolved"
  | "verification_disabled"
  | "university_unavailable"
  | "profile_incomplete"
  | "already_verified";

type AutomaticVerificationResult = {
  decision:
    AutomaticVerificationDecision;

  studentVerificationStatus:
    | "not_started"
    | "pending"
    | "verified"
    | "failed";

  studentVerificationSource:
    string;

  studentVerifiedAt?:
    | string
    | null;

  manualReviewAllowed:
    boolean;

  definitiveFailure:
    boolean;

  failureCode?:
    | string
    | null;

  message:
    string;
};

type Props = {
  appeal:
    | VerificationAppeal
    | null;

  universityName:
    string;

  universityListed:
    boolean;

  studentDetailsMissing:
    boolean;

  studentVerified:
    boolean;

  onAppealChanged: (
    appeal:
      | VerificationAppeal
      | null
  ) => void;

  onSubmitted?: () => void;
};

export default function VerificationAppealFlow(
  props:
    Props
) {
  const {
    appeal,
    universityListed,
    studentDetailsMissing,
    studentVerified,
    onSubmitted,
  } = props;

  const [
    automaticChecking,
    setAutomaticChecking,
  ] =
    useState(false);

  const [
    automaticVerification,
    setAutomaticVerification,
  ] =
    useState<
      AutomaticVerificationResult | null
    >(null);

  const [
    error,
    setError,
  ] =
    useState("");

  const runAutomaticVerification =
    async () => {
      if (
        automaticChecking
      ) {
        return;
      }

      setError("");

      setAutomaticChecking(
        true
      );

      try {
        const token =
          localStorage.getItem(
            "campusmart-token"
          );

        if (!token) {
          setError(
            "Please sign in again."
          );

          return;
        }

        const response =
          await fetch(
            `${API_URL}/api/verification/automatic`,
            {
              method:
                "POST",

              headers: {
                Authorization:
                  `Bearer ${token}`,
              },

              cache:
                "no-store",
            }
          );

        const data =
          await response
            .json()
            .catch(
              () =>
                null
            );

        if (
          !response.ok ||
          !data?.success ||
          !data.verification
        ) {
          setError(
            data?.message ||
              "Unable to complete automatic student verification."
          );

          return;
        }

        const verification =
          data.verification as
            AutomaticVerificationResult;

        setAutomaticVerification(
          verification
        );

        /*
         * AccountPanel already refreshes its account data
         * whenever onSubmitted is called.
         *
         * Reuse that existing mechanism after successful
         * automatic verification.
         */
        if (
          verification.decision ===
            "verified" ||
          verification.decision ===
            "already_verified"
        ) {
          onSubmitted?.();
        }
      } catch (
        requestError
      ) {
        console.error(
          "Automatic student verification failed:",
          requestError
        );

        setError(
          "Unable to connect to the verification service."
        );
      } finally {
        setAutomaticChecking(
          false
        );
      }
    };

  /*
   * =====================================================
   * EXISTING MANUAL-REVIEW CASE
   * =====================================================
   *
   * Existing appeal state must continue through the
   * already-working Manual review flow.
   */

  if (
    appeal ||
    studentVerified ||
    studentDetailsMissing
  ) {
    return (
      <ManualVerificationAppealFlow
        {...props}
      />
    );
  }

  /*
   * =====================================================
   * UNLISTED UNIVERSITY
   * =====================================================
   *
   * CampusMart has no managed automated source to query
   * for an unlisted university.
   *
   * Preserve the existing Manual review process.
   */

  if (
    !universityListed
  ) {
    return (
      <ManualVerificationAppealFlow
        {...props}
      />
    );
  }

  /*
   * =====================================================
   * MANUAL REVIEW ALLOWED BY BACKEND
   * =====================================================
   *
   * Manual review only becomes available for managed
   * universities when the backend explicitly allows it.
   */

  if (
    automaticVerification
      ?.manualReviewAllowed
  ) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <p className="font-bold text-blue-950">
            Automatic verification
            could not complete your
            case
          </p>

          <p className="mt-1 text-sm leading-6 text-blue-800">
            {
              automaticVerification.message
            }
          </p>

          <p className="mt-2 text-xs font-semibold leading-5 text-blue-700">
            Manual review is
            available for this
            verification attempt.
          </p>
        </div>

        <ManualVerificationAppealFlow
          {...props}
        />
      </div>
    );
  }

  const decision =
    automaticVerification
      ?.decision ??
    null;

  const isVerified =
    decision ===
      "verified" ||
    decision ===
      "already_verified";

  const isDefinitiveFailure =
    decision ===
      "failed" &&
    automaticVerification
      ?.definitiveFailure ===
      true;

  const isUnavailable =
    decision ===
      "unresolved" ||
    decision ===
      "verification_disabled" ||
    decision ===
      "university_unavailable" ||
    decision ===
      "profile_incomplete";

  /*
   * =====================================================
   * AUTOMATIC VERIFICATION GATE
   * =====================================================
   */

  return (
    <div
      className={`rounded-xl border p-5 ${
        isDefinitiveFailure
          ? "border-red-200 bg-red-50"
          : isVerified
            ? "border-emerald-200 bg-emerald-50"
            : isUnavailable
              ? "border-amber-200 bg-amber-50"
              : "border-slate-200 bg-slate-50"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p
            className={`font-bold ${
              isDefinitiveFailure
                ? "text-red-950"
                : isVerified
                  ? "text-emerald-950"
                  : isUnavailable
                    ? "text-amber-950"
                    : "text-slate-950"
            }`}
          >
            {isDefinitiveFailure
              ? "Student details could not be verified"
              : isVerified
                ? "Student identity verified"
                : isUnavailable
                  ? "Automatic verification is unavailable"
                  : "Verify your student status"}
          </p>

          <p
            className={`mt-1 text-sm leading-6 ${
              isDefinitiveFailure
                ? "text-red-800"
                : isVerified
                  ? "text-emerald-800"
                  : isUnavailable
                    ? "text-amber-800"
                    : "text-slate-600"
            }`}
          >
            {automaticVerification
              ?.message ||
              "CampusMart will first check your saved university, matric number, and official account name against the university's available verification source."}
          </p>
        </div>

        {!automaticVerification ? (
          <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">
            Automatic check
          </span>
        ) : null}
      </div>

      {isDefinitiveFailure ? (
        <div className="mt-4 rounded-lg border border-red-200 bg-white/70 p-3 text-xs font-semibold leading-5 text-red-700">
          This result came from
          the configured university
          source. Manual review is
          not available as an
          override for a definitive
          mismatch.
        </div>
      ) : null}

      {!isVerified ? (
        <button
          type="button"
          disabled={
            automaticChecking
          }
          onClick={() =>
            void runAutomaticVerification()
          }
          className="mt-5 rounded-[10px] bg-accent-400 px-5 py-3 text-sm font-bold text-black disabled:cursor-not-allowed disabled:opacity-60"
        >
          {automaticChecking
            ? "Checking university records..."
            : automaticVerification
              ? "Check again"
              : "Verify student status"}
        </button>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-lg bg-red-100 px-3 py-2 text-sm font-semibold text-red-700"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}