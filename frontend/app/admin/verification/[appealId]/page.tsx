"use client";
import { useCampusMartConfirm } from "@/components/common/CampusMartConfirm";


import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useParams,
  useRouter,
} from "next/navigation";

import AdminShell from "@/components/admin/AdminShell";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:5000";

const ADMIN_TOKEN_KEY =
  "campusmart-admin-token";

type AppealStatus =
  | "draft"
  | "pending"
  | "under_review"
  | "more_information_required"
  | "approved"
  | "rejected"
  | "cancelled";

type AppealReason =
  | "record_not_found"
  | "university_system_unavailable"
  | "recent_admission_or_transfer"
  | "integration_error"
  | "university_not_supported"
  | "other";

type EvidenceType =
  | "student_id"
  | "student_portal"
  | "institutional_email"
  | "admission_record"
  | "other";

type Evidence = {
  id: string;
  type: EvidenceType;
  originalFileName?: string | null;
  mimeType?: string | null;
  fileSizeBytes?: number | null;
  createdAt: string;
};

type Appeal = {
  id: string;

  reason: AppealReason;

  explanation?: string | null;

  status: AppealStatus;

  submittedName: string;

  submittedMatricNumber?: string | null;

  submittedUniversityName: string;

  submittedState?: string | null;

  submittedCity?: string | null;

  decisionReason?: string | null;

  createdAt: string;

  submittedAt?: string | null;

  reviewedAt?: string | null;

  updatedAt: string;

  university?: {
    id: string;
    name: string;
    shortName: string;
    state: string;
    city: string;
  } | null;

  user: {
    id: string;
    name: string;
    email: string;

    studentVerificationStatus:
      | "not_started"
      | "pending"
      | "verified"
      | "failed";

    studentVerificationSource: string;

    studentVerifiedAt?: string | null;

    role:
      | "client"
      | "vendor";
  };

  reviewedByAdmin?: {
    id: string;
    name: string;
    email: string;
    role: string;
  } | null;

  evidence: Evidence[];
};

type CurrentAdmin = {
  id: string;
  name: string;
  email: string;
  role: string;
};

function statusLabel(
  status: AppealStatus
) {
  switch (status) {
    case "draft":
      return "Draft";

    case "pending":
      return "Pending";

    case "under_review":
      return "Under review";

    case "more_information_required":
      return "More information required";

    case "approved":
      return "Approved";

    case "rejected":
      return "Rejected";

    case "cancelled":
      return "Cancelled";

    default:
      return status;
  }
}

function statusClass(
  status: AppealStatus
) {
  switch (status) {
    case "pending":
      return "border-amber-200 bg-amber-50 text-amber-800";

    case "under_review":
      return "border-blue-200 bg-blue-50 text-blue-700";

    case "more_information_required":
      return "border-orange-200 bg-orange-50 text-orange-800";

    case "approved":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";

    case "rejected":
    case "cancelled":
      return "border-red-200 bg-red-50 text-red-700";

    default:
      return "border-slate-200 bg-slate-100 text-slate-700";
  }
}

function reasonLabel(
  reason: AppealReason
) {
  switch (reason) {
    case "record_not_found":
      return "Student record could not be found";

    case "university_system_unavailable":
      return "University verification system unavailable";

    case "recent_admission_or_transfer":
      return "Recent admission or transfer";

    case "integration_error":
      return "Verification system problem";

    case "university_not_supported":
      return "University is not currently supported";

    case "other":
      return "Other verification issue";

    default:
      return "Verification issue";
  }
}

function evidenceLabel(
  type: EvidenceType
) {
  switch (type) {
    case "student_id":
      return "Student ID card";

    case "student_portal":
      return "Student portal record";

    case "institutional_email":
      return "Institutional email evidence";

    case "admission_record":
      return "Admission or student record";

    case "other":
      return "Other supporting proof";

    default:
      return "Verification evidence";
  }
}

function formatBytes(
  bytes?: number | null
) {
  if (!bytes) {
    return "Unknown size";
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

function formatDateTime(
  value?: string | null
) {
  if (!value) {
    return "Not available";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "Not available";
  }

  return date.toLocaleString(
    "en-GB",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  );
}

export default function VerificationCasePage() {
  const campusMartConfirm = useCampusMartConfirm();

  const params =
    useParams<{
      appealId: string;
    }>();

  const router =
    useRouter();

  const appealId =
    Array.isArray(
      params.appealId
    )
      ? params.appealId[0]
      : params.appealId;

  const [
    appeal,
    setAppeal,
  ] =
    useState<Appeal | null>(
      null
    );

  const [
    currentAdmin,
    setCurrentAdmin,
  ] =
    useState<CurrentAdmin | null>(
      null
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    actionLoading,
    setActionLoading,
  ] =
    useState("");

  const [
    openingEvidenceId,
    setOpeningEvidenceId,
  ] =
    useState("");

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] =
    useState("");

  const [
    requestPanelOpen,
    setRequestPanelOpen,
  ] =
    useState(false);

  const [
    rejectPanelOpen,
    setRejectPanelOpen,
  ] =
    useState(false);

  const [
    informationRequest,
    setInformationRequest,
  ] =
    useState("");

  const [
    approvalNote,
    setApprovalNote,
  ] =
    useState("");

  const [
    rejectionReason,
    setRejectionReason,
  ] =
    useState("");

  const loadCase =
    useCallback(
      async () => {
        if (!appealId) {
          return;
        }

        setLoading(
          true
        );

        setError(
          ""
        );

        const token =
          sessionStorage.getItem(
            ADMIN_TOKEN_KEY
          );

        if (!token) {
          router.replace(
            "/admin/login"
          );

          return;
        }

        try {
          const [
            caseResponse,
            adminResponse,
          ] =
            await Promise.all([
              fetch(
                `${API_URL}/api/admin/verification/appeals/${appealId}`,
                {
                  headers: {
                    Authorization:
                      `Bearer ${token}`,
                  },

                  cache:
                    "no-store",
                }
              ),

              fetch(
                `${API_URL}/api/admin/auth/me`,
                {
                  headers: {
                    Authorization:
                      `Bearer ${token}`,
                  },

                  cache:
                    "no-store",
                }
              ),
            ]);

          const caseData =
            await caseResponse.json();

          const adminData =
            await adminResponse.json();

          if (
            caseResponse.status ===
              401 ||
            adminResponse.status ===
              401
          ) {
            sessionStorage.removeItem(
              ADMIN_TOKEN_KEY
            );

            router.replace(
              "/admin/login"
            );

            return;
          }

          if (
            caseResponse.status ===
            403
          ) {
            throw new Error(
              caseData.message ||
                "You do not have permission to access this verification case."
            );
          }

          if (
            !caseResponse.ok ||
            !caseData.success ||
            !caseData.appeal
          ) {
            throw new Error(
              caseData.message ||
                "Unable to load this verification case."
            );
          }

          setAppeal(
            caseData.appeal
          );

          if (
            adminResponse.ok &&
            adminData.success &&
            adminData.admin
          ) {
            setCurrentAdmin(
              adminData.admin
            );
          }
        } catch (
          requestError
        ) {
          console.error(
            "Load verification case failed:",
            requestError
          );

          setError(
            requestError instanceof
              Error
              ? requestError.message
              : "Unable to load this verification case."
          );
        } finally {
          setLoading(
            false
          );
        }
      },
      [
        appealId,
        router,
      ]
    );

  useEffect(() => {
    void loadCase();
  }, [
    loadCase,
  ]);

  const location =
    useMemo(() => {
      if (!appeal) {
        return "";
      }

      return [
        appeal.submittedCity,
        appeal.submittedState,
      ]
        .filter(Boolean)
        .join(", ");
    }, [
      appeal,
    ]);

  const assignedToCurrentAdmin =
    Boolean(
      appeal &&
        currentAdmin &&
        appeal.reviewedByAdmin?.id ===
          currentAdmin.id
    );

  const makeActionRequest =
    async ({
      endpoint,
      body,
      loadingKey,
    }: {
      endpoint: string;
      body?: unknown;
      loadingKey: string;
    }) => {
      const token =
        sessionStorage.getItem(
          ADMIN_TOKEN_KEY
        );

      if (!token) {
        router.replace(
          "/admin/login"
        );

        return false;
      }

      setActionLoading(
        loadingKey
      );

      setError(
        ""
      );

      setSuccessMessage(
        ""
      );

      try {
        const response =
          await fetch(
            `${API_URL}${endpoint}`,
            {
              method:
                "POST",

              headers: {
                Authorization:
                  `Bearer ${token}`,

                ...(body
                  ? {
                      "Content-Type":
                        "application/json",
                    }
                  : {}),
              },

              ...(body
                ? {
                    body:
                      JSON.stringify(
                        body
                      ),
                  }
                : {}),
            }
          );

        const data =
          await response.json();

        if (
          response.status ===
          401
        ) {
          sessionStorage.removeItem(
            ADMIN_TOKEN_KEY
          );

          router.replace(
            "/admin/login"
          );

          return false;
        }

        if (
          !response.ok ||
          !data.success
        ) {
          setError(
            data.message ||
              "Unable to update this verification case."
          );

          return false;
        }

        setSuccessMessage(
          data.message ||
            "Verification case updated."
        );

        await loadCase();

        return true;
      } catch (
        requestError
      ) {
        console.error(
          "Verification action failed:",
          requestError
        );

        setError(
          "Unable to connect to the CampusMart Admin service."
        );

        return false;
      } finally {
        setActionLoading(
          ""
        );
      }
    };

  const startReview =
    async () => {
      if (!appeal) {
        return;
      }

      await makeActionRequest({
        endpoint:
          `/api/admin/verification/appeals/${appeal.id}/start-review`,

        loadingKey:
          "start-review",
      });
    };

  const requestMoreInformation =
    async () => {
      if (!appeal) {
        return;
      }

      const cleaned =
        informationRequest.trim();

      if (
        cleaned.length <
        10
      ) {
        setError(
          "Explain clearly what additional information the student needs to provide."
        );

        return;
      }

      const success =
        await makeActionRequest({
          endpoint:
            `/api/admin/verification/appeals/${appeal.id}/request-more-information`,

          body: {
            decisionReason:
              cleaned,
          },

          loadingKey:
            "more-information",
        });

      if (success) {
        setInformationRequest(
          ""
        );

        setRequestPanelOpen(
          false
        );
      }
    };

  const approveAppeal =
    async () => {
      if (!appeal) {
        return;
      }

      const confirmed =
        await campusMartConfirm({ title: "Confirm action", description: `Approve the student identity for ${appeal.submittedName}?`, danger: false });

      if (!confirmed) {
        return;
      }

      await makeActionRequest({
        endpoint:
          `/api/admin/verification/appeals/${appeal.id}/approve`,

        body: {
          decisionReason:
            approvalNote.trim(),
        },

        loadingKey:
          "approve",
      });
    };

  const rejectAppeal =
    async () => {
      if (!appeal) {
        return;
      }

      const cleaned =
        rejectionReason.trim();

      if (
        cleaned.length <
        10
      ) {
        setError(
          "Explain clearly why this verification appeal is being rejected."
        );

        return;
      }

      const confirmed =
        await campusMartConfirm({ title: "Confirm action", description: `Reject the student verification appeal for ${appeal.submittedName}?`, danger: true });

      if (!confirmed) {
        return;
      }

      const success =
        await makeActionRequest({
          endpoint:
            `/api/admin/verification/appeals/${appeal.id}/reject`,

          body: {
            decisionReason:
              cleaned,
          },

          loadingKey:
            "reject",
        });

      if (success) {
        setRejectionReason(
          ""
        );

        setRejectPanelOpen(
          false
        );
      }
    };

  const openEvidence =
    async (
      evidence: Evidence
    ) => {
      if (
        !appeal ||
        openingEvidenceId
      ) {
        return;
      }

      const token =
        sessionStorage.getItem(
          ADMIN_TOKEN_KEY
        );

      if (!token) {
        router.replace(
          "/admin/login"
        );

        return;
      }

      setOpeningEvidenceId(
        evidence.id
      );

      setError(
        ""
      );

      try {
        const response =
          await fetch(
            `${API_URL}/api/admin/verification/appeals/${appeal.id}/evidence/${evidence.id}/access`,
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
          response.status ===
          401
        ) {
          sessionStorage.removeItem(
            ADMIN_TOKEN_KEY
          );

          router.replace(
            "/admin/login"
          );

          return;
        }

        if (
          !response.ok ||
          !data.success ||
          !data.access?.signedUrl
        ) {
          setError(
            data.message ||
              "Unable to open this verification document."
          );

          return;
        }

        const anchor =
          document.createElement(
            "a"
          );

        anchor.href =
          data.access.signedUrl;

        anchor.target =
          "_blank";

        anchor.rel =
          "noopener noreferrer";

        document.body.appendChild(
          anchor
        );

        anchor.click();

        anchor.remove();
      } catch (
        requestError
      ) {
        console.error(
          "Open verification evidence failed:",
          requestError
        );

        setError(
          "Unable to connect while opening this verification document."
        );
      } finally {
        setOpeningEvidenceId(
          ""
        );
      }
    };

  return (
    <AdminShell title="Verification case">
      <div className="mx-auto max-w-[1450px] p-5 sm:p-8">
        <button
          type="button"
          onClick={() =>
            router.push(
              "/admin/verification"
            )
          }
          className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 transition hover:text-slate-950"
        >
          <span aria-hidden="true">
            ←
          </span>

          Verification queue
        </button>

        {loading ? (
          <div className="mt-6 flex min-h-[420px] items-center justify-center rounded-2xl border border-slate-200 bg-white">
            <div className="text-center">
              <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-slate-950" />

              <p className="mt-4 text-sm font-semibold text-slate-500">
                Loading verification
                case...
              </p>
            </div>
          </div>
        ) : null}

        {!loading &&
        error &&
        !appeal ? (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-6">
            <h2 className="font-bold text-red-900">
              Unable to open case
            </h2>

            <p className="mt-2 text-sm leading-6 text-red-700">
              {error}
            </p>
          </div>
        ) : null}

        {!loading &&
        appeal ? (
          <>
            <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-start">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-600">
                    Student verification
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <h2 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
                      {
                        appeal.submittedName
                      }
                    </h2>

                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-bold ${statusClass(
                        appeal.status
                      )}`}
                    >
                      {statusLabel(
                        appeal.status
                      )}
                    </span>
                  </div>

                  <p className="mt-3 text-sm font-semibold text-slate-700">
                    {
                      appeal.submittedUniversityName
                    }
                  </p>

                  {location ? (
                    <p className="mt-1 text-sm text-slate-500">
                      {location}
                    </p>
                  ) : null}
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 lg:min-w-[250px]">
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">
                    Submitted
                  </p>

                  <p className="mt-1 text-sm font-bold text-slate-800">
                    {formatDateTime(
                      appeal.submittedAt
                    )}
                  </p>
                </div>
              </div>
            </section>

            {error ? (
              <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4">
                <p className="text-sm font-semibold leading-6 text-red-700">
                  {error}
                </p>
              </div>
            ) : null}

            {successMessage ? (
              <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-sm font-semibold leading-6 text-emerald-700">
                  {
                    successMessage
                  }
                </p>
              </div>
            ) : null}

            <div className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
              <div className="space-y-6">
                <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                      Identity
                    </p>

                    <h3 className="mt-2 text-xl font-bold text-slate-950">
                      Student details
                    </h3>
                  </div>

                  <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                        Submitted name
                      </p>

                      <p className="mt-2 font-bold text-slate-950">
                        {
                          appeal.submittedName
                        }
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                        Matric number
                      </p>

                      <p className="mt-2 font-bold text-slate-950">
                        {appeal.submittedMatricNumber ||
                          "Not provided"}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                        Account email
                      </p>

                      <p className="mt-2 break-all font-semibold text-slate-800">
                        {
                          appeal.user.email
                        }
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                        Account type
                      </p>

                      <p className="mt-2 font-bold text-slate-950">
                        {appeal.user.role ===
                        "vendor"
                          ? "Vendor"
                          : "Buyer"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl border border-slate-200 p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                      University
                    </p>

                    <p className="mt-2 font-bold text-slate-950">
                      {
                        appeal.submittedUniversityName
                      }
                    </p>

                    {location ? (
                      <p className="mt-1 text-sm text-slate-500">
                        {
                          location
                        }
                      </p>
                    ) : null}
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                    Appeal
                  </p>

                  <h3 className="mt-2 text-xl font-bold text-slate-950">
                    Verification issue
                  </h3>

                  <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-bold text-slate-950">
                      {reasonLabel(
                        appeal.reason
                      )}
                    </p>

                    {appeal.explanation ? (
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-600">
                        {
                          appeal.explanation
                        }
                      </p>
                    ) : (
                      <p className="mt-2 text-sm text-slate-500">
                        No additional
                        explanation was
                        provided.
                      </p>
                    )}
                  </div>

                  {appeal.decisionReason ? (
                    <div
                      className={`mt-4 rounded-xl border p-4 ${
                        appeal.status ===
                        "rejected"
                          ? "border-red-200 bg-red-50"
                          : "border-orange-200 bg-orange-50"
                      }`}
                    >
                      <p
                        className={`text-xs font-bold uppercase tracking-wide ${
                          appeal.status ===
                          "rejected"
                            ? "text-red-700"
                            : "text-orange-700"
                        }`}
                      >
                        {appeal.status ===
                        "rejected"
                          ? "Rejection reason"
                          : "Latest review note"}
                      </p>

                      <p
                        className={`mt-2 whitespace-pre-wrap text-sm leading-6 ${
                          appeal.status ===
                          "rejected"
                            ? "text-red-950"
                            : "text-orange-950"
                        }`}
                      >
                        {
                          appeal.decisionReason
                        }
                      </p>
                    </div>
                  ) : null}
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                        Private documents
                      </p>

                      <h3 className="mt-2 text-xl font-bold text-slate-950">
                        Verification evidence
                      </h3>
                    </div>

                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                      {
                        appeal.evidence
                          .length
                      }{" "}
                      file
                      {appeal.evidence
                        .length ===
                      1
                        ? ""
                        : "s"}
                    </span>
                  </div>

                  <p className="mt-3 text-sm leading-6 text-slate-500">
                    Evidence is stored
                    privately. Opening a
                    document creates a
                    short-lived access
                    link.
                  </p>

                  <div className="mt-5 space-y-3">
                    {appeal.evidence
                      .length ===
                    0 ? (
                      <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                        No evidence files
                        are attached.
                      </div>
                    ) : (
                      appeal.evidence.map(
                        (
                          evidence,
                          index
                        ) => (
                          <div
                            key={
                              evidence.id
                            }
                            className="flex flex-col justify-between gap-4 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-3">
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-xs font-bold text-amber-400">
                                  {String(
                                    index +
                                      1
                                  ).padStart(
                                    2,
                                    "0"
                                  )}
                                </div>

                                <div className="min-w-0">
                                  <p className="font-bold text-slate-950">
                                    {evidenceLabel(
                                      evidence.type
                                    )}
                                  </p>

                                  <p className="mt-1 truncate text-xs text-slate-500">
                                    {evidence.originalFileName ||
                                      "Verification evidence"}
                                  </p>
                                </div>
                              </div>

                              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 pl-12 text-xs text-slate-500">
                                <span>
                                  {formatBytes(
                                    evidence.fileSizeBytes
                                  )}
                                </span>

                                {evidence.mimeType ? (
                                  <span>
                                    {
                                      evidence.mimeType
                                    }
                                  </span>
                                ) : null}
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                void openEvidence(
                                  evidence
                                )
                              }
                              disabled={
                                Boolean(
                                  openingEvidenceId
                                )
                              }
                              className="shrink-0 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {openingEvidenceId ===
                              evidence.id
                                ? "Opening..."
                                : "Open document"}
                            </button>
                          </div>
                        )
                      )
                    )}
                  </div>
                </section>
              </div>

              <div className="space-y-6">
                <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                    Review
                  </p>

                  <h3 className="mt-2 text-xl font-bold text-slate-950">
                    Case ownership
                  </h3>

                  <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                      Reviewer
                    </p>

                    <p className="mt-2 font-bold text-slate-950">
                      {appeal.reviewedByAdmin
                        ?.name ||
                        "Unassigned"}
                    </p>

                    {appeal.reviewedByAdmin ? (
                      <p className="mt-1 text-sm text-slate-500">
                        {appeal.reviewedByAdmin.role.replace(
                          /_/g,
                          " "
                        )}
                      </p>
                    ) : (
                      <p className="mt-1 text-sm text-slate-500">
                        Waiting for an
                        Admin to claim
                        this case.
                      </p>
                    )}
                  </div>

                  {appeal.status ===
                  "pending" ? (
                    <button
                      type="button"
                      onClick={() =>
                        void startReview()
                      }
                      disabled={
                        Boolean(
                          actionLoading
                        )
                      }
                      className="mt-4 w-full rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {actionLoading ===
                      "start-review"
                        ? "Starting review..."
                        : "Start review"}
                    </button>
                  ) : null}

                  {appeal.status ===
                  "under_review" ? (
                    <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
                      <p className="font-bold text-blue-950">
                        Review in progress
                      </p>

                      <p className="mt-1 text-sm leading-6 text-blue-700">
                        {assignedToCurrentAdmin
                          ? "This case is assigned to you."
                          : "This case is currently assigned to another Admin."}
                      </p>
                    </div>
                  ) : null}

                  {appeal.status ===
                  "more_information_required" ? (
                    <div className="mt-4 rounded-xl border border-orange-200 bg-orange-50 p-4">
                      <p className="font-bold text-orange-950">
                        Waiting for student
                      </p>

                      <p className="mt-1 text-sm leading-6 text-orange-800">
                        The student needs
                        to provide the
                        requested
                        information and
                        resubmit the
                        appeal.
                      </p>
                    </div>
                  ) : null}

                  {appeal.status ===
                  "approved" ? (
                    <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                      <p className="font-bold text-emerald-950">
                        Verification approved
                      </p>

                      <p className="mt-1 text-sm leading-6 text-emerald-700">
                        This student
                        identity has
                        been verified.
                      </p>
                    </div>
                  ) : null}

                  {appeal.status ===
                  "rejected" ? (
                    <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4">
                      <p className="font-bold text-red-950">
                        Verification rejected
                      </p>

                      <p className="mt-1 text-sm leading-6 text-red-700">
                        This appeal did
                        not establish the
                        student&apos;s
                        identity.
                      </p>

                      {appeal.reviewedAt ? (
                        <p className="mt-2 text-xs font-semibold text-red-600">
                          Decision made{" "}
                          {formatDateTime(
                            appeal.reviewedAt
                          )}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </section>

                {appeal.status ===
                  "under_review" &&
                assignedToCurrentAdmin ? (
                  <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                      Decision
                    </p>

                    <h3 className="mt-2 text-xl font-bold text-slate-950">
                      Review actions
                    </h3>

                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      Inspect the
                      submitted
                      evidence before
                      completing this
                      review.
                    </p>

                    <div className="mt-5">
                      <label className="block text-sm font-semibold text-slate-700">
                        Approval note

                        <span className="ml-1 font-normal text-slate-400">
                          optional
                        </span>

                        <textarea
                          rows={3}
                          maxLength={
                            1000
                          }
                          value={
                            approvalNote
                          }
                          onChange={(
                            event
                          ) =>
                            setApprovalNote(
                              event.target
                                .value
                            )
                          }
                          placeholder="Optional internal review note..."
                          className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-400 focus:bg-white"
                        />
                      </label>

                      <button
                        type="button"
                        onClick={() =>
                          void approveAppeal()
                        }
                        disabled={
                          Boolean(
                            actionLoading
                          )
                        }
                        className="mt-3 w-full rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {actionLoading ===
                        "approve"
                          ? "Approving..."
                          : "Approve student verification"}
                      </button>
                    </div>

                    <div className="my-6 border-t border-slate-200" />

                    {!requestPanelOpen ? (
                      <button
                        type="button"
                        onClick={() => {
                          setRequestPanelOpen(
                            true
                          );

                          setRejectPanelOpen(
                            false
                          );

                          setError(
                            ""
                          );
                        }}
                        className="w-full rounded-xl border border-orange-300 bg-orange-50 px-5 py-3 text-sm font-bold text-orange-800 transition hover:bg-orange-100"
                      >
                        Request more information
                      </button>
                    ) : (
                      <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
                        <p className="font-bold text-orange-950">
                          Request more information
                        </p>

                        <p className="mt-1 text-sm leading-6 text-orange-800">
                          Tell the
                          student
                          exactly what
                          additional
                          proof is
                          needed.
                        </p>

                        <textarea
                          rows={5}
                          maxLength={
                            1000
                          }
                          value={
                            informationRequest
                          }
                          onChange={(
                            event
                          ) =>
                            setInformationRequest(
                              event.target
                                .value
                            )
                          }
                          placeholder="Example: Please provide a recent student portal record showing your current enrolment status."
                          className="mt-4 w-full resize-y rounded-xl border border-orange-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-orange-400"
                        />

                        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                          <button
                            type="button"
                            onClick={() =>
                              void requestMoreInformation()
                            }
                            disabled={
                              Boolean(
                                actionLoading
                              ) ||
                              informationRequest.trim()
                                .length <
                                10
                            }
                            className="rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {actionLoading ===
                            "more-information"
                              ? "Sending request..."
                              : "Send request"}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setRequestPanelOpen(
                                false
                              );

                              setInformationRequest(
                                ""
                              );
                            }}
                            disabled={
                              Boolean(
                                actionLoading
                              )
                            }
                            className="rounded-xl border border-orange-200 bg-white px-4 py-2.5 text-sm font-bold text-orange-800"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="my-6 border-t border-slate-200" />

                    {!rejectPanelOpen ? (
                      <button
                        type="button"
                        onClick={() => {
                          setRejectPanelOpen(
                            true
                          );

                          setRequestPanelOpen(
                            false
                          );

                          setError(
                            ""
                          );
                        }}
                        className="w-full rounded-xl border border-red-300 bg-red-50 px-5 py-3 text-sm font-bold text-red-700 transition hover:bg-red-100"
                      >
                        Reject verification
                      </button>
                    ) : (
                      <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                        <p className="font-bold text-red-950">
                          Reject verification
                        </p>

                        <p className="mt-1 text-sm leading-6 text-red-800">
                          Give a clear
                          reason for the
                          rejection. The
                          student may
                          need this
                          information
                          before making
                          another
                          verification
                          attempt.
                        </p>

                        <label className="mt-4 block text-sm font-semibold text-red-900">
                          Rejection reason

                          <textarea
                            rows={5}
                            maxLength={
                              1000
                            }
                            value={
                              rejectionReason
                            }
                            onChange={(
                              event
                            ) =>
                              setRejectionReason(
                                event.target
                                  .value
                              )
                            }
                            placeholder="Example: The submitted documents do not provide enough information to confirm current student status."
                            className="mt-2 w-full resize-y rounded-xl border border-red-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-red-400"
                          />
                        </label>

                        <p className="mt-2 text-xs text-red-600">
                          {
                            rejectionReason
                              .trim()
                              .length
                          }
                          /1000 characters
                        </p>

                        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                          <button
                            type="button"
                            onClick={() =>
                              void rejectAppeal()
                            }
                            disabled={
                              Boolean(
                                actionLoading
                              ) ||
                              rejectionReason.trim()
                                .length <
                                10
                            }
                            className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {actionLoading ===
                            "reject"
                              ? "Rejecting..."
                              : "Confirm rejection"}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setRejectPanelOpen(
                                false
                              );

                              setRejectionReason(
                                ""
                              );
                            }}
                            disabled={
                              Boolean(
                                actionLoading
                              )
                            }
                            className="rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-bold text-red-700"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </section>
                ) : null}

                <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                    Student state
                  </p>

                  <div className="mt-4 space-y-3 text-sm">
                    <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-3">
                      <span className="text-slate-500">
                        Verification
                      </span>

                      <span className="font-bold text-slate-900">
                        {appeal.user.studentVerificationStatus.replace(
                          /_/g,
                          " "
                        )}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-4">
                      <span className="text-slate-500">
                        Source
                      </span>

                      <span className="text-right font-bold text-slate-900">
                        {appeal.user.studentVerificationSource.replace(
                          /_/g,
                          " "
                        )}
                      </span>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </AdminShell>
  );
}