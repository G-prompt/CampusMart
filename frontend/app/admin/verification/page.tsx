"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import AdminShell from "@/components/admin/AdminShell";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:5000";

const ADMIN_TOKEN_KEY =
  "campusmart-admin-token";

type VerificationAppealStatus =
  | "pending"
  | "under_review"
  | "more_information_required";

type VerificationAppealReason =
  | "record_not_found"
  | "university_system_unavailable"
  | "recent_admission_or_transfer"
  | "integration_error"
  | "university_not_supported"
  | "other";

type QueueAppeal = {
  id: string;

  reason:
    VerificationAppealReason;

  status:
    VerificationAppealStatus;

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

  reviewedAt?:
    | string
    | null;

  decisionReason?:
    | string
    | null;

  evidenceCount:
    number;

  university?:
    | {
        id: string;
        name: string;
        shortName: string;
      }
    | null;

  studentVerificationStatus:
    string;

  studentVerificationSource:
    string;

  reviewedBy?:
    | {
        id: string;
        name: string;
        role: string;
      }
    | null;
};

type FilterStatus =
  | "all"
  | VerificationAppealStatus;

function statusLabel(
  status:
    VerificationAppealStatus
) {
  switch (status) {
    case "pending":
      return "Pending";

    case "under_review":
      return "Under review";

    case "more_information_required":
      return "More information required";

    default:
      return status;
  }
}

function statusClass(
  status:
    VerificationAppealStatus
) {
  switch (status) {
    case "pending":
      return "border-amber-200 bg-amber-50 text-amber-800";

    case "under_review":
      return "border-blue-200 bg-blue-50 text-blue-700";

    case "more_information_required":
      return "border-orange-200 bg-orange-50 text-orange-800";

    default:
      return "border-slate-200 bg-slate-100 text-slate-700";
  }
}

function reasonLabel(
  reason:
    VerificationAppealReason
) {
  switch (reason) {
    case "record_not_found":
      return "Student record not found";

    case "university_system_unavailable":
      return "University system unavailable";

    case "recent_admission_or_transfer":
      return "Recent admission or transfer";

    case "integration_error":
      return "Verification system problem";

    case "university_not_supported":
      return "University not supported";

    case "other":
      return "Other verification issue";

    default:
      return "Verification issue";
  }
}

function formatDate(
  value:
    | string
    | null
    | undefined
) {
  if (!value) {
    return "Not submitted";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "Unknown";
  }

  return date.toLocaleDateString(
    "en-GB",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
    }
  );
}

function formatTime(
  value:
    | string
    | null
    | undefined
) {
  if (!value) {
    return "";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  return date.toLocaleTimeString(
    "en-GB",
    {
      hour: "2-digit",
      minute: "2-digit",
    }
  );
}

export default function AdminVerificationPage() {
  const router =
    useRouter();

  const [
    appeals,
    setAppeals,
  ] =
    useState<
      QueueAppeal[]
    >([]);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    search,
    setSearch,
  ] =
    useState("");

  const [
    filter,
    setFilter,
  ] =
    useState<FilterStatus>(
      "all"
    );

  const [
    refreshVersion,
    setRefreshVersion,
  ] =
    useState(0);

  useEffect(() => {
    let cancelled =
      false;

    const loadQueue =
      async () => {
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
          const response =
            await fetch(
              `${API_URL}/api/admin/verification/appeals`,
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
            response.status ===
            403
          ) {
            if (!cancelled) {
              setError(
                data.message ||
                  "Your Admin account does not have permission to review student verification cases."
              );
            }

            return;
          }

          if (
            !response.ok ||
            !data.success ||
            !Array.isArray(
              data.appeals
            )
          ) {
            throw new Error(
              data.message ||
                "Unable to load the verification queue."
            );
          }

          if (!cancelled) {
            setAppeals(
              data.appeals
            );
          }
        } catch (
          requestError
        ) {
          console.error(
            "Load verification queue failed:",
            requestError
          );

          if (!cancelled) {
            setError(
              requestError instanceof
                Error
                ? requestError.message
                : "Unable to load the verification queue."
            );
          }
        } finally {
          if (!cancelled) {
            setLoading(
              false
            );
          }
        }
      };

    void loadQueue();

    return () => {
      cancelled =
        true;
    };
  }, [
    router,
    refreshVersion,
  ]);

  const stats =
    useMemo(
      () => ({
        total:
          appeals.length,

        pending:
          appeals.filter(
            (appeal) =>
              appeal.status ===
              "pending"
          ).length,

        underReview:
          appeals.filter(
            (appeal) =>
              appeal.status ===
              "under_review"
          ).length,

        actionRequired:
          appeals.filter(
            (appeal) =>
              appeal.status ===
              "more_information_required"
          ).length,
      }),
      [
        appeals,
      ]
    );

  const visibleAppeals =
    useMemo(() => {
      const normalizedSearch =
        search
          .trim()
          .toLowerCase();

      return appeals.filter(
        (appeal) => {
          if (
            filter !==
              "all" &&
            appeal.status !==
              filter
          ) {
            return false;
          }

          if (
            !normalizedSearch
          ) {
            return true;
          }

          const searchable =
            [
              appeal.submittedName,
              appeal.submittedUniversityName,
              appeal.submittedMatricNumber ||
                "",
              appeal.submittedState ||
                "",
              appeal.submittedCity ||
                "",
              appeal.reviewedBy
                ?.name ||
                "",
              reasonLabel(
                appeal.reason
              ),
            ]
              .join(
                " "
              )
              .toLowerCase();

          return searchable.includes(
            normalizedSearch
          );
        }
      );
    }, [
      appeals,
      filter,
      search,
    ]);

  const openCase = (
    appealId: string
  ) => {
    router.push(
      `/admin/verification/${appealId}`
    );
  };

  return (
    <AdminShell title="Verification">
      <div className="mx-auto max-w-[1500px] p-5 sm:p-8">
        <section className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-600">
              Trust & Identity
            </p>

            <h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
              Student verification
            </h2>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Review student
              identity cases,
              inspect supporting
              evidence and manage
              verification
              decisions.
            </p>
          </div>

          <button
            type="button"
            disabled={
              loading
            }
            onClick={() =>
              setRefreshVersion(
                (value) =>
                  value + 1
              )
            }
            className="w-fit rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-800 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading
              ? "Refreshing..."
              : "Refresh queue"}
          </button>
        </section>

        <section className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-500">
              Open cases
            </p>

            <p className="mt-3 text-3xl font-bold text-slate-950">
              {
                stats.total
              }
            </p>

            <p className="mt-2 text-xs text-slate-400">
              All reviewable
              verification cases
            </p>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <p className="text-sm font-semibold text-amber-800">
              Pending
            </p>

            <p className="mt-3 text-3xl font-bold text-amber-950">
              {
                stats.pending
              }
            </p>

            <p className="mt-2 text-xs text-amber-700">
              Waiting for a
              reviewer
            </p>
          </div>

          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
            <p className="text-sm font-semibold text-blue-700">
              Under review
            </p>

            <p className="mt-3 text-3xl font-bold text-blue-950">
              {
                stats.underReview
              }
            </p>

            <p className="mt-2 text-xs text-blue-700">
              Currently assigned
            </p>
          </div>

          <div className="rounded-2xl border border-orange-200 bg-orange-50 p-5">
            <p className="text-sm font-semibold text-orange-700">
              Student action
            </p>

            <p className="mt-3 text-3xl font-bold text-orange-950">
              {
                stats.actionRequired
              }
            </p>

            <p className="mt-2 text-xs text-orange-700">
              More information
              requested
            </p>
          </div>
        </section>

        <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5 sm:p-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-950">
                  Verification
                  queue
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  Oldest submitted
                  cases are shown
                  first.
                </p>
              </div>

              <div className="flex w-full flex-col gap-3 sm:flex-row xl:w-auto">
                <label className="block min-w-0 sm:w-[300px]">
                  <span className="sr-only">
                    Search
                    verification
                    queue
                  </span>

                  <input
                    value={
                      search
                    }
                    onChange={(
                      event
                    ) =>
                      setSearch(
                        event.target
                          .value
                      )
                    }
                    placeholder="Search student, university or matric..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:bg-white"
                  />
                </label>

                <label className="block sm:w-[210px]">
                  <span className="sr-only">
                    Filter by status
                  </span>

                  <select
                    value={
                      filter
                    }
                    onChange={(
                      event
                    ) =>
                      setFilter(
                        event.target
                          .value as FilterStatus
                      )
                    }
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 outline-none focus:border-slate-400 focus:bg-white"
                  >
                    <option value="all">
                      All open cases
                    </option>

                    <option value="pending">
                      Pending
                    </option>

                    <option value="under_review">
                      Under review
                    </option>

                    <option value="more_information_required">
                      More information required
                    </option>
                  </select>
                </label>
              </div>
            </div>
          </div>

          {error ? (
            <div className="m-5 rounded-xl border border-red-200 bg-red-50 p-4 sm:m-6">
              <p className="font-bold text-red-800">
                Unable to load
                verification cases
              </p>

              <p className="mt-1 text-sm leading-6 text-red-700">
                {error}
              </p>
            </div>
          ) : null}

          {loading ? (
            <div className="flex min-h-[300px] items-center justify-center p-8">
              <div className="text-center">
                <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-slate-950" />

                <p className="mt-4 text-sm font-semibold text-slate-500">
                  Loading verification
                  queue...
                </p>
              </div>
            </div>
          ) : null}

          {!loading &&
          !error &&
          appeals.length ===
            0 ? (
            <div className="px-6 py-16 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-lg font-bold text-emerald-700">
                ✓
              </div>

              <h3 className="mt-4 text-lg font-bold text-slate-950">
                Verification queue
                is clear
              </h3>

              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                There are no
                pending,
                under-review or
                information-requested
                student cases right
                now.
              </p>
            </div>
          ) : null}

          {!loading &&
          !error &&
          appeals.length >
            0 &&
          visibleAppeals.length ===
            0 ? (
            <div className="px-6 py-14 text-center">
              <h3 className="font-bold text-slate-950">
                No matching cases
              </h3>

              <p className="mt-2 text-sm text-slate-500">
                Try another search
                or status filter.
              </p>
            </div>
          ) : null}

          {!loading &&
          !error &&
          visibleAppeals.length >
            0 ? (
            <div className="divide-y divide-slate-200">
              {visibleAppeals.map(
                (
                  appeal
                ) => {
                  const location =
                    [
                      appeal.submittedCity,
                      appeal.submittedState,
                    ]
                      .filter(
                        Boolean
                      )
                      .join(
                        ", "
                      );

                  return (
                    <article
                      key={
                        appeal.id
                      }
                      className="p-5 transition hover:bg-slate-50/70 sm:p-6"
                    >
                      <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-start">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-base font-bold text-slate-950 sm:text-lg">
                              {
                                appeal.submittedName
                              }
                            </h4>

                            <span
                              className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${statusClass(
                                appeal.status
                              )}`}
                            >
                              {statusLabel(
                                appeal.status
                              )}
                            </span>
                          </div>

                          <p className="mt-2 text-sm font-semibold text-slate-700">
                            {
                              appeal.submittedUniversityName
                            }
                          </p>

                          {location ? (
                            <p className="mt-1 text-xs text-slate-500">
                              {
                                location
                              }
                            </p>
                          ) : null}

                          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-3 text-sm">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                Matric
                              </p>

                              <p className="mt-1 font-semibold text-slate-700">
                                {appeal.submittedMatricNumber ||
                                  "Not provided"}
                              </p>
                            </div>

                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                Issue
                              </p>

                              <p className="mt-1 font-semibold text-slate-700">
                                {reasonLabel(
                                  appeal.reason
                                )}
                              </p>
                            </div>

                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                                Evidence
                              </p>

                              <p className="mt-1 font-semibold text-slate-700">
                                {
                                  appeal.evidenceCount
                                }{" "}
                                file
                                {appeal.evidenceCount ===
                                1
                                  ? ""
                                  : "s"}
                              </p>
                            </div>
                          </div>

                          {appeal.status ===
                            "more_information_required" &&
                          appeal.decisionReason ? (
                            <div className="mt-4 max-w-2xl rounded-xl border border-orange-200 bg-orange-50 px-4 py-3">
                              <p className="text-xs font-bold uppercase tracking-wide text-orange-700">
                                Reviewer
                                request
                              </p>

                              <p className="mt-1 text-sm leading-6 text-orange-900">
                                {
                                  appeal.decisionReason
                                }
                              </p>
                            </div>
                          ) : null}
                        </div>

                        <div className="grid shrink-0 gap-3 sm:grid-cols-2 xl:min-w-[430px] xl:grid-cols-2">
                          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                              Submitted
                            </p>

                            <p className="mt-1 text-sm font-bold text-slate-800">
                              {formatDate(
                                appeal.submittedAt
                              )}
                            </p>

                            <p className="mt-0.5 text-xs text-slate-500">
                              {formatTime(
                                appeal.submittedAt
                              )}
                            </p>
                          </div>

                          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                              Reviewer
                            </p>

                            <p className="mt-1 truncate text-sm font-bold text-slate-800">
                              {appeal.reviewedBy
                                ?.name ||
                                "Unassigned"}
                            </p>

                            <p className="mt-0.5 text-xs text-slate-500">
                              {appeal.status ===
                              "pending"
                                ? "Waiting to be claimed"
                                : appeal.reviewedBy
                                    ?.role
                                  ? appeal.reviewedBy.role.replace(
                                      /_/g,
                                      " "
                                    )
                                  : "No reviewer"}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              openCase(
                                appeal.id
                              )
                            }
                            className="group rounded-xl bg-slate-950 p-4 text-left text-white transition hover:bg-slate-800 sm:col-span-2"
                          >
                            <div className="flex items-center justify-between gap-4">
                              <div>
                                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">
                                  Case
                                </p>

                                <p className="mt-1 text-sm font-bold text-white">
                                  {appeal.status ===
                                  "pending"
                                    ? "Ready for review"
                                    : appeal.status ===
                                        "under_review"
                                      ? "Continue review"
                                      : "View student request"}
                                </p>
                              </div>

                              <span className="text-lg text-amber-400 transition group-hover:translate-x-1">
                                →
                              </span>
                            </div>
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                }
              )}
            </div>
          ) : null}
        </section>
      </div>
    </AdminShell>
  );
}