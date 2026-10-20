"use client";

import {
  FormEvent,
  useMemo,
  useRef,
  useState,
} from "react";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:5000";

export type VerificationAppealStatus =
  | "draft"
  | "pending"
  | "under_review"
  | "more_information_required"
  | "approved"
  | "rejected"
  | "cancelled";

export type VerificationAppealReason =
  | "record_not_found"
  | "university_system_unavailable"
  | "recent_admission_or_transfer"
  | "integration_error"
  | "university_not_supported"
  | "other";

export type VerificationEvidenceType =
  | "student_id"
  | "student_portal"
  | "institutional_email"
  | "admission_record"
  | "other";

export type VerificationEvidence = {
  id: string;

  type:
    VerificationEvidenceType;

  originalFileName?:
    | string
    | null;

  mimeType?:
    | string
    | null;

  fileSizeBytes?:
    | number
    | null;

  createdAt:
    string;
};

export type VerificationAppeal = {
  id: string;

  reason:
    VerificationAppealReason;

  explanation?:
    | string
    | null;

  status:
    VerificationAppealStatus;

  /*
   * Admin-facing review message.
   *
   * For more_information_required this
   * tells the student exactly what the
   * reviewer needs from them.
   */
  decisionReason?:
    | string
    | null;

  submittedName:
    string;

  submittedMatricNumber?:
    | string
    | null;

  submittedUniversityName:
    string;

  submittedState?:
    | string
    | null;

  submittedCity?:
    | string
    | null;

  createdAt:
    string;

  submittedAt?:
    | string
    | null;

  updatedAt?:
    string;

  evidence:
    VerificationEvidence[];
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

const REASONS: {
  value:
    VerificationAppealReason;

  label:
    string;
}[] = [
  {
    value:
      "record_not_found",

    label:
      "My student record could not be found",
  },

  {
    value:
      "university_system_unavailable",

    label:
      "My university verification system is unavailable",
  },

  {
    value:
      "recent_admission_or_transfer",

    label:
      "I was recently admitted or transferred",
  },

  {
    value:
      "integration_error",

    label:
      "There was a verification system problem",
  },

  {
    value:
      "university_not_supported",

    label:
      "My university is not currently supported",
  },

  {
    value:
      "other",

    label:
      "Another verification issue",
  },
];

const EVIDENCE_TYPES: {
  value:
    VerificationEvidenceType;

  label:
    string;
}[] = [
  {
    value:
      "student_id",

    label:
      "Student ID card",
  },

  {
    value:
      "student_portal",

    label:
      "Student portal record",
  },

  {
    value:
      "admission_record",

    label:
      "Admission or student record",
  },

  {
    value:
      "institutional_email",

    label:
      "Institutional email evidence",
  },

  {
    value:
      "other",

    label:
      "Other supporting proof",
  },
];

const PRIMARY_TYPES =
  new Set<
    VerificationEvidenceType
  >([
    "student_id",
    "student_portal",
    "admission_record",
  ]);

function evidenceLabel(
  type:
    VerificationEvidenceType
) {
  return (
    EVIDENCE_TYPES.find(
      (item) =>
        item.value ===
        type
    )?.label ??
    "Supporting evidence"
  );
}

function formatBytes(
  bytes:
    | number
    | null
    | undefined
) {
  if (!bytes) {
    return "";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (
    bytes <
    1024 * 1024
  ) {
    return `${(
      bytes / 1024
    ).toFixed(1)} KB`;
  }

  return `${(
    bytes /
    (1024 * 1024)
  ).toFixed(1)} MB`;
}

function RequirementItem({
  complete,
  children,
}: {
  complete:
    boolean;

  children:
    React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2">
      <span
        className={`mt-[1px] flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold ${
          complete
            ? "border-emerald-300 bg-emerald-100 text-emerald-700"
            : "border-slate-300 bg-white text-slate-400"
        }`}
      >
        {complete
          ? "✓"
          : "○"}
      </span>

      <span
        className={
          complete
            ? "text-emerald-800"
            : "text-slate-600"
        }
      >
        {children}
      </span>
    </div>
  );
}

export default function VerificationAppealFlow({
  appeal,
  universityName,
  universityListed,
  studentDetailsMissing,
  studentVerified,
  onAppealChanged,
  onSubmitted,
}: Props) {
  const fileInputRef =
    useRef<HTMLInputElement | null>(
      null
    );

  const [
    reason,
    setReason,
  ] =
    useState<
      VerificationAppealReason
    >(
      universityListed
        ? "record_not_found"
        : "university_not_supported"
    );

  const [
    explanation,
    setExplanation,
  ] =
    useState("");

  const [
    evidenceType,
    setEvidenceType,
  ] =
    useState<
      VerificationEvidenceType
    >("student_id");

  const [
    evidenceFile,
    setEvidenceFile,
  ] =
    useState<
      File | null
    >(null);

  const [
    creating,
    setCreating,
  ] =
    useState(false);

  const [
    uploading,
    setUploading,
  ] =
    useState(false);

  const [
    submitting,
    setSubmitting,
  ] =
    useState(false);

  const [
    message,
    setMessage,
  ] =
    useState("");

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    consent,
    setConsent,
  ] =
    useState(false);

  const evidence =
    appeal?.evidence ??
    [];

  const evidenceTypes =
    useMemo(
      () =>
        new Set(
          evidence.map(
            (item) =>
              item.type
          )
        ),
      [
        evidence,
      ]
    );

  const hasTwoFiles =
    evidence.length >= 2;

  const hasTwoEvidenceTypes =
    evidenceTypes.size >= 2;

  const hasPrimaryEvidence =
    evidence.some(
      (item) =>
        PRIMARY_TYPES.has(
          item.type
        )
    );

  const readyToSubmit =
    hasTwoFiles &&
    hasTwoEvidenceTypes &&
    hasPrimaryEvidence;

  const refreshAppeal =
    async () => {
      const token =
        localStorage.getItem(
          "campusmart-token"
        );

      if (!token) {
        return;
      }

      const response =
        await fetch(
          `${API_URL}/api/verification/appeals/current`,
          {
            headers: {
              Authorization:
                `Bearer ${token}`,
            },

            cache:
              "no-store",
          }
        );

      const data =
        await response.json();

      if (
        response.ok &&
        data.success
      ) {
        onAppealChanged(
          data.appeal ??
            null
        );
      }
    };

  const createAppeal =
    async (
      event:
        FormEvent
    ) => {
      event.preventDefault();

      if (creating) {
        return;
      }

      setError("");
      setMessage("");

      if (!reason) {
        setError(
          "Choose the verification problem you are having."
        );

        return;
      }

      setCreating(
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
            `${API_URL}/api/verification/appeals`,
            {
              method:
                "POST",

              headers: {
                "Content-Type":
                  "application/json",

                Authorization:
                  `Bearer ${token}`,
              },

              body:
                JSON.stringify({
                  reason,

                  explanation:
                    explanation.trim(),
                }),
            }
          );

        const data =
          await response.json();

        if (
          !response.ok ||
          !data.success
        ) {
          setError(
            data.message ||
              "Unable to start verification review."
          );

          return;
        }

        setMessage(
          "Verification review started. Add your supporting evidence below."
        );

        await refreshAppeal();
      } catch (
        requestError
      ) {
        console.error(
          "Create verification appeal failed:",
          requestError
        );

        setError(
          "Unable to connect to the server."
        );
      } finally {
        setCreating(
          false
        );
      }
    };

  const uploadEvidence =
    async (
      event:
        FormEvent
    ) => {
      event.preventDefault();

      if (
        !appeal ||
        uploading
      ) {
        return;
      }

      setError("");
      setMessage("");

      if (
        !evidenceFile
      ) {
        setError(
          "Choose a file to upload."
        );

        return;
      }

      if (
        evidenceFile.size >
        5 * 1024 * 1024
      ) {
        setError(
          "Verification files must be 5 MB or smaller."
        );

        return;
      }

      setUploading(
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

        const formData =
          new FormData();

        formData.append(
          "type",
          evidenceType
        );

        formData.append(
          "file",
          evidenceFile
        );

        const response =
          await fetch(
            `${API_URL}/api/verification/appeals/${appeal.id}/evidence`,
            {
              method:
                "POST",

              headers: {
                Authorization:
                  `Bearer ${token}`,
              },

              body:
                formData,
            }
          );

        const data =
          await response.json();

        if (
          !response.ok ||
          !data.success
        ) {
          setError(
            data.message ||
              "Unable to upload verification evidence."
          );

          return;
        }

        setEvidenceFile(
          null
        );

        if (
          fileInputRef.current
        ) {
          fileInputRef.current.value =
            "";
        }

        setMessage(
          "Evidence uploaded securely."
        );

        await refreshAppeal();
      } catch (
        requestError
      ) {
        console.error(
          "Upload verification evidence failed:",
          requestError
        );

        setError(
          "Unable to connect to the server."
        );
      } finally {
        setUploading(
          false
        );
      }
    };

  const submitAppeal =
    async () => {
      if (
        !appeal ||
        submitting
      ) {
        return;
      }

      setError("");
      setMessage("");

      if (
        !readyToSubmit
      ) {
        setError(
          "Add at least two different types of proof, including a student ID, portal record, or admission/student record."
        );

        return;
      }

      if (!consent) {
        setError(
          "Confirm that CampusMart may use these documents to review your student identity."
        );

        return;
      }

      setSubmitting(
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
            `${API_URL}/api/verification/appeals/${appeal.id}/submit`,
            {
              method:
                "POST",

              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            }
          );

        const data =
          await response.json();

        if (
          !response.ok ||
          !data.success
        ) {
          setError(
            data.message ||
              "Unable to submit your verification appeal."
          );

          return;
        }

        setConsent(
          false
        );

        setMessage(
          appeal.status ===
            "more_information_required"
            ? "Your additional evidence has been submitted for review."
            : "Your verification appeal has been submitted for review."
        );

        await refreshAppeal();

        onSubmitted?.();
      } catch (
        requestError
      ) {
        console.error(
          "Submit verification appeal failed:",
          requestError
        );

        setError(
          "Unable to connect to the server."
        );
      } finally {
        setSubmitting(
          false
        );
      }
    };

  if (
    studentVerified
  ) {
    return null;
  }

  if (
    studentDetailsMissing
  ) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <p className="font-bold text-amber-950">
          Complete your
          student details
        </p>

        <p className="mt-1 text-sm leading-6 text-amber-800">
          Add your
          university
          information before
          requesting a manual
          verification review.
        </p>
      </div>
    );
  }

  if (
    appeal &&
    ![
      "draft",
      "more_information_required",
    ].includes(
      appeal.status
    )
  ) {
    return null;
  }

  if (!appeal) {
    return (
      <form
        onSubmit={
          createAppeal
        }
        className="rounded-xl border border-slate-200 bg-slate-50 p-5"
      >
        <p className="font-bold text-slate-950">
          Having trouble
          verifying?
        </p>

        <p className="mt-1 text-sm leading-6 text-slate-600">
          If automatic
          student
          verification cannot
          be completed,
          CampusMart can
          manually review
          proof of your
          studentship.
        </p>

        <div className="mt-5 space-y-4">
          <label className="block text-sm font-semibold text-slate-700">
            What happened?

            <select
              value={reason}
              onChange={(
                event
              ) =>
                setReason(
                  event.target
                    .value as VerificationAppealReason
                )
              }
              className="mt-2 w-full rounded-[10px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-black"
            >
              {REASONS.map(
                (
                  item
                ) => (
                  <option
                    key={
                      item.value
                    }
                    value={
                      item.value
                    }
                  >
                    {
                      item.label
                    }
                  </option>
                )
              )}
            </select>
          </label>

          <label className="block text-sm font-semibold text-slate-700">
            Explain the
            problem

            <textarea
              rows={4}
              value={
                explanation
              }
              onChange={(
                event
              ) =>
                setExplanation(
                  event.target
                    .value
                )
              }
              className="mt-2 w-full resize-y rounded-[10px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-black"
              placeholder="Tell us what happened while trying to verify your student details."
            />
          </label>

          <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs leading-5 text-slate-600">
            <span className="font-bold text-slate-900">
              University:
            </span>{" "}
            {universityName}
          </div>

          {error ? (
            <p
              role="alert"
              className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700"
            >
              {error}
            </p>
          ) : null}

          {message ? (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
              {message}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={
              creating
            }
            className="rounded-[10px] bg-accent-400 px-5 py-3 text-sm font-bold text-black disabled:cursor-not-allowed disabled:opacity-60"
          >
            {creating
              ? "Starting review..."
              : "Request manual review"}
          </button>
        </div>
      </form>
    );
  }

  const canAddEvidence =
    appeal.status ===
      "draft" ||
    appeal.status ===
      "more_information_required";

  const isMoreInformationRequest =
    appeal.status ===
    "more_information_required";

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-bold text-amber-950">
            {isMoreInformationRequest
              ? "More information required"
              : "Verification review draft"}
          </p>

          <p className="mt-1 text-sm leading-6 text-amber-800">
            {isMoreInformationRequest
              ? "Your reviewer needs some additional information before they can complete your student verification."
              : "Add supporting documents, then submit your review request."}
          </p>
        </div>

        <span className="rounded-full border border-amber-300 bg-white px-2.5 py-1 text-xs font-bold text-amber-800">
          {isMoreInformationRequest
            ? "Action required"
            : "Draft"}
        </span>
      </div>

      {isMoreInformationRequest &&
      appeal.decisionReason ? (
        <div className="mt-5 rounded-xl border border-orange-200 bg-orange-50 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-orange-700">
            Reviewer request
          </p>

          <p className="mt-2 text-sm font-semibold leading-6 text-orange-950">
            {
              appeal.decisionReason
            }
          </p>

          <p className="mt-2 text-xs leading-5 text-orange-800">
            Add the requested
            proof below, then
            submit the appeal
            again for review.
          </p>
        </div>
      ) : null}

      <div className="mt-5 rounded-xl bg-white/70 p-4">
        <p className="text-sm font-bold text-slate-950">
          Evidence
          requirements
        </p>

        <div className="mt-3 space-y-2 text-xs leading-5">
          <RequirementItem
            complete={
              hasTwoFiles
            }
          >
            At least 2
            evidence files
          </RequirementItem>

          <RequirementItem
            complete={
              hasTwoEvidenceTypes
            }
          >
            At least 2
            different evidence
            types
          </RequirementItem>

          <RequirementItem
            complete={
              hasPrimaryEvidence
            }
          >
            At least one
            student ID,
            student portal
            record, or
            admission/student
            record
          </RequirementItem>

          <div className="pt-1 text-slate-500">
            Maximum 4 files,
            5 MB each.
          </div>
        </div>
      </div>

      {evidence.length >
      0 ? (
        <div className="mt-5 space-y-3">
          <p className="text-sm font-bold text-amber-950">
            Uploaded evidence
          </p>

          {evidence.map(
            (
              item
            ) => (
              <div
                key={
                  item.id
                }
                className="rounded-lg border border-amber-200 bg-white p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-950">
                      {evidenceLabel(
                        item.type
                      )}
                    </p>

                    <p className="mt-1 truncate text-xs text-slate-500">
                      {item.originalFileName ||
                        "Verification evidence"}
                    </p>
                  </div>

                  {item.fileSizeBytes ? (
                    <span className="shrink-0 text-xs font-semibold text-slate-500">
                      {formatBytes(
                        item.fileSizeBytes
                      )}
                    </span>
                  ) : null}
                </div>
              </div>
            )
          )}
        </div>
      ) : null}

      {canAddEvidence ? (
        <form
          onSubmit={
            uploadEvidence
          }
          className="mt-5 space-y-4 rounded-xl border border-amber-200 bg-white p-4"
        >
          <p className="font-bold text-slate-950">
            {isMoreInformationRequest
              ? "Add requested proof"
              : "Add proof"}
          </p>

          <label className="block text-sm font-semibold text-slate-700">
            Evidence type

            <select
              value={
                evidenceType
              }
              onChange={(
                event
              ) =>
                setEvidenceType(
                  event.target
                    .value as VerificationEvidenceType
                )
              }
              className="mt-2 w-full rounded-[10px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-black"
            >
              {EVIDENCE_TYPES.map(
                (
                  item
                ) => (
                  <option
                    key={
                      item.value
                    }
                    value={
                      item.value
                    }
                  >
                    {
                      item.label
                    }
                  </option>
                )
              )}
            </select>
          </label>

          <label className="block text-sm font-semibold text-slate-700">
            File

            <input
              ref={
                fileInputRef
              }
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={(
                event
              ) =>
                setEvidenceFile(
                  event.target
                    .files?.[0] ??
                    null
                )
              }
              className="mt-2 block w-full rounded-[10px] border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700"
            />
          </label>

          <p className="text-xs leading-5 text-slate-500">
            JPEG, PNG, WebP
            or PDF. Maximum
            5 MB. Documents
            are stored
            privately and are
            not public
            marketplace files.
          </p>

          <button
            type="submit"
            disabled={
              uploading ||
              !evidenceFile
            }
            className="rounded-[10px] border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {uploading
              ? "Uploading securely..."
              : "Upload evidence"}
          </button>
        </form>
      ) : null}

      <div className="mt-5 rounded-xl border border-amber-200 bg-white p-4">
        <p className="font-bold text-slate-950">
          {isMoreInformationRequest
            ? "Resubmit for review"
            : "Submit for review"}
        </p>

        <p className="mt-1 text-sm leading-6 text-slate-600">
          {isMoreInformationRequest
            ? "When you have added the requested information, resubmit your verification appeal so a reviewer can continue."
            : "Once submitted, your evidence will be reviewed by CampusMart. Reviews may take up to 5 working days."}
        </p>

        <label className="mt-4 flex items-start gap-3 text-sm leading-6 text-slate-700">
          <input
            type="checkbox"
            checked={
              consent
            }
            onChange={(
              event
            ) =>
              setConsent(
                event.target
                  .checked
              )
            }
            className="mt-1 h-4 w-4 shrink-0 accent-black"
          />

          <span>
            I understand that
            the documents I
            provide contain
            personal/student
            information and
            may be used by
            CampusMart solely
            to review my
            student identity.
          </span>
        </label>

        <div className="mt-4">
          <button
            type="button"
            disabled={
              submitting ||
              !readyToSubmit
            }
            onClick={
              submitAppeal
            }
            className="rounded-[10px] bg-accent-400 px-5 py-3 text-sm font-bold text-black disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting
              ? "Submitting..."
              : isMoreInformationRequest
                ? "Resubmit for review"
                : "Submit for review"}
          </button>
        </div>

        {!readyToSubmit ? (
          <p className="mt-3 text-xs font-semibold leading-5 text-amber-800">
            Complete all
            evidence
            requirements
            before submitting.
          </p>
        ) : (
          <p className="mt-3 text-xs font-semibold leading-5 text-emerald-700">
            Evidence
            requirements
            complete. Confirm
            the statement above
            when you are ready
            to submit.
          </p>
        )}
      </div>

      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700"
        >
          {error}
        </p>
      ) : null}

      {message ? (
        <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
          {message}
        </p>
      ) : null}
    </div>
  );
}