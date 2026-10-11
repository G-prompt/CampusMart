"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import type {
  FormEvent,
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

type VerificationSource =
  | "none"
  | "university_api"
  | "roster_import"
  | "university_database";

type AdminUniversity = {
  id: string;

  name: string;

  shortName: string;

  slug: string;

  country: string;

  state: string;

  city: string;

  logoUrl?:
    | string
    | null;

  active: boolean;

  studentVerificationEnabled:
    boolean;

  primaryVerificationSource:
    VerificationSource;

  fallbackVerificationSource:
    VerificationSource;

  manualReviewEnabled:
    boolean;

  matricValidationEnabled:
    boolean;

  matricPattern?:
    | string
    | null;

  matricFormatHint?:
    | string
    | null;

  userCount: number;

  createdAt: string;

  updatedAt: string;
};

type ActiveFilter =
  | "all"
  | "active"
  | "inactive";

type VerificationFilter =
  | "all"
  | "enabled"
  | "disabled";

type CreateUniversityForm = {
  name: string;

  shortName: string;

  country: string;

  state: string;

  city: string;

  logoUrl: string;

  active: boolean;
};

const EMPTY_CREATE_FORM:
  CreateUniversityForm = {
    name: "",

    shortName: "",

    country:
      "Nigeria",

    state: "",

    city: "",

    logoUrl: "",

    active: true,
  };

function sourceLabel(
  source:
    VerificationSource
) {
  switch (source) {
    case "university_api":
      return "University API";

    case "roster_import":
      return "Roster import";

    case "university_database":
      return "University database";

    case "none":
    default:
      return "None";
  }
}

function sourceClass(
  source:
    VerificationSource
) {
  switch (source) {
    case "university_api":
      return "border-violet-200 bg-violet-50 text-violet-700";

    case "roster_import":
      return "border-cyan-200 bg-cyan-50 text-cyan-700";

    case "university_database":
      return "border-blue-200 bg-blue-50 text-blue-700";

    case "none":
    default:
      return "border-slate-200 bg-slate-100 text-slate-600";
  }
}

function formatDate(
  value:
    | string
    | null
    | undefined
) {
  if (!value) {
    return "Unknown";
  }

  const date =
    new Date(
      value
    );

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
      day:
        "numeric",

      month:
        "short",

      year:
        "numeric",
    }
  );
}

function Toggle({
  checked,
  disabled = false,
  onChange,
  label,
}: {
  checked: boolean;

  disabled?:
    boolean;

  onChange:
    (
      checked:
        boolean
    ) => void;

  label:
    string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={
        checked
      }
      aria-label={
        label
      }
      disabled={
        disabled
      }
      onClick={() =>
        onChange(
          !checked
        )
      }
      className={`relative inline-flex h-7 w-12 shrink-0 rounded-full transition ${
        checked
          ? "bg-slate-950"
          : "bg-slate-300"
      } ${
        disabled
          ? "cursor-not-allowed opacity-50"
          : "cursor-pointer"
      }`}
    >
      <span
        className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition ${
          checked
            ? "left-6"
            : "left-1"
        }`}
      />
    </button>
  );
}

function SourceBadge({
  source,
}: {
  source:
    VerificationSource;
}) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${sourceClass(
        source
      )}`}
    >
      {sourceLabel(
        source
      )}
    </span>
  );
}

export default function AdminUniversitiesPage() {
  const router =
    useRouter();

  const [
    universities,
    setUniversities,
  ] =
    useState<
      AdminUniversity[]
    >([]);

  const [
    loading,
    setLoading,
  ] =
    useState(
      true
    );

  const [
    error,
    setError,
  ] =
    useState(
      ""
    );

  const [
    actionError,
    setActionError,
  ] =
    useState(
      ""
    );

  const [
    notice,
    setNotice,
  ] =
    useState(
      ""
    );

  const [
    search,
    setSearch,
  ] =
    useState(
      ""
    );

  const [
    activeFilter,
    setActiveFilter,
  ] =
    useState<ActiveFilter>(
      "all"
    );

  const [
    verificationFilter,
    setVerificationFilter,
  ] =
    useState<VerificationFilter>(
      "all"
    );

  const [
    busyUniversityId,
    setBusyUniversityId,
  ] =
    useState<
      string | null
    >(null);

  const [
    createOpen,
    setCreateOpen,
  ] =
    useState(
      false
    );

  const [
    creating,
    setCreating,
  ] =
    useState(
      false
    );

  const [
    createError,
    setCreateError,
  ] =
    useState(
      ""
    );

  const [
    createForm,
    setCreateForm,
  ] =
    useState<CreateUniversityForm>(
      EMPTY_CREATE_FORM
    );

  const loadUniversities =
    useCallback(
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
              `${API_URL}/api/admin/universities`,
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
            await response
              .json()
              .catch(
                () =>
                  null
              );

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
            throw new Error(
              data?.message ||
                "Your Admin account does not have permission to manage universities."
            );
          }

          if (
            !response.ok ||
            !data?.success ||
            !Array.isArray(
              data.universities
            )
          ) {
            throw new Error(
              data?.message ||
                "Unable to load universities."
            );
          }

          setUniversities(
            data.universities as
              AdminUniversity[]
          );
        } catch (
          requestError
        ) {
          console.error(
            "Load Admin universities failed:",
            requestError
          );

          setError(
            requestError instanceof
              Error
              ? requestError.message
              : "Unable to load universities."
          );
        } finally {
          setLoading(
            false
          );
        }
      },
      [
        router,
      ]
    );

  useEffect(() => {
    void loadUniversities();
  }, [
    loadUniversities,
  ]);

  const stats =
    useMemo(
      () => {
        const active =
          universities.filter(
            (
              university
            ) =>
              university.active
          ).length;

        const verificationEnabled =
          universities.filter(
            (
              university
            ) =>
              university
                .studentVerificationEnabled
          ).length;

        const manualReview =
          universities.filter(
            (
              university
            ) =>
              university
                .manualReviewEnabled
          ).length;

        const automatedConfigured =
          universities.filter(
            (
              university
            ) =>
              university
                .primaryVerificationSource !==
                "none" ||
              university
                .fallbackVerificationSource !==
                "none"
          ).length;

        const linkedUsers =
          universities.reduce(
            (
              total,
              university
            ) =>
              total +
              university.userCount,
            0
          );

        return {
          total:
            universities.length,

          active,

          verificationEnabled,

          manualReview,

          automatedConfigured,

          linkedUsers,
        };
      },
      [
        universities,
      ]
    );

  const visibleUniversities =
    useMemo(
      () => {
        const normalizedSearch =
          search
            .trim()
            .toLowerCase();

        return universities.filter(
          (
            university
          ) => {
            if (
              activeFilter ===
                "active" &&
              !university.active
            ) {
              return false;
            }

            if (
              activeFilter ===
                "inactive" &&
              university.active
            ) {
              return false;
            }

            if (
              verificationFilter ===
                "enabled" &&
              !university
                .studentVerificationEnabled
            ) {
              return false;
            }

            if (
              verificationFilter ===
                "disabled" &&
              university
                .studentVerificationEnabled
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
                university.name,

                university.shortName,

                university.slug,

                university.country,

                university.state,

                university.city,

                sourceLabel(
                  university.primaryVerificationSource
                ),

                sourceLabel(
                  university.fallbackVerificationSource
                ),

                university.manualReviewEnabled
                  ? "manual review"
                  : "",

                university.matricValidationEnabled
                  ? "matric validation"
                  : "",

                university.matricFormatHint ||
                  "",
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
      },
      [
        universities,
        search,
        activeFilter,
        verificationFilter,
      ]
    );

  const openUniversity =
    (
      universityId:
        string
    ) => {
      router.push(
        `/admin/universities/${universityId}`
      );
    };

  const toggleUniversityActive =
    async (
      university:
        AdminUniversity
    ) => {
      setActionError(
        ""
      );

      setNotice(
        ""
      );

      const nextActive =
        !university.active;

      if (
        !nextActive
      ) {
        const confirmed =
          window.confirm(
            `Deactivate ${university.name}?\n\nIt will stop appearing in the public university selector, but existing users and historical records will remain linked.`
          );

        if (
          !confirmed
        ) {
          return;
        }
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

      setBusyUniversityId(
        university.id
      );

      try {
        const response =
          await fetch(
            `${API_URL}/api/admin/universities/${university.id}/active`,
            {
              method:
                "PATCH",

              headers: {
                "Content-Type":
                  "application/json",

                Authorization:
                  `Bearer ${token}`,
              },

              body:
                JSON.stringify({
                  active:
                    nextActive,
                }),
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
          !data?.success
        ) {
          throw new Error(
            data?.message ||
              "Unable to update university status."
          );
        }

        setUniversities(
          (
            current
          ) =>
            current.map(
              (
                item
              ) =>
                item.id ===
                university.id
                  ? {
                      ...item,

                      active:
                        nextActive,
                    }
                  : item
            )
        );

        setNotice(
          nextActive
            ? `${university.name} is now active.`
            : `${university.name} has been deactivated.`
        );
      } catch (
        requestError
      ) {
        console.error(
          "Update university active state failed:",
          requestError
        );

        setActionError(
          requestError instanceof
            Error
            ? requestError.message
            : "Unable to update university status."
        );
      } finally {
        setBusyUniversityId(
          null
        );
      }
    };

  const openCreateModal =
    () => {
      setCreateForm({
        ...EMPTY_CREATE_FORM,
      });

      setCreateError(
        ""
      );

      setCreateOpen(
        true
      );
    };

  const closeCreateModal =
    () => {
      if (
        creating
      ) {
        return;
      }

      setCreateOpen(
        false
      );

      setCreateError(
        ""
      );
    };

  const createUniversity =
    async (
      event:
        FormEvent
    ) => {
      event.preventDefault();

      setCreateError(
        ""
      );

      setActionError(
        ""
      );

      setNotice(
        ""
      );

      const name =
        createForm.name.trim();

      const shortName =
        createForm.shortName
          .trim()
          .toUpperCase();

      const country =
        createForm.country.trim();

      const state =
        createForm.state.trim();

      const city =
        createForm.city.trim();

      const logoUrl =
        createForm.logoUrl.trim();

      if (
        !name ||
        !shortName ||
        !country ||
        !state ||
        !city
      ) {
        setCreateError(
          "University name, short name, country, state, and city are required."
        );

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

      setCreating(
        true
      );

      try {
        const response =
          await fetch(
            `${API_URL}/api/admin/universities`,
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
                  name,

                  shortName,

                  country,

                  state,

                  city,

                  logoUrl:
                    logoUrl ||
                    null,

                  active:
                    createForm.active,

                  studentVerificationEnabled:
                    false,

                  primaryVerificationSource:
                    "none",

                  fallbackVerificationSource:
                    "none",

                  manualReviewEnabled:
                    false,

                  matricValidationEnabled:
                    false,

                  matricPattern:
                    null,

                  matricFormatHint:
                    null,
                }),
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
          throw new Error(
            data?.message ||
              "You do not have permission to create universities."
          );
        }

        if (
          !response.ok ||
          !data?.success ||
          !data.university
        ) {
          throw new Error(
            data?.message ||
              "Unable to create this university."
          );
        }

        setCreateOpen(
          false
        );

        setCreateForm({
          ...EMPTY_CREATE_FORM,
        });

        setNotice(
          `${name} was added successfully.`
        );

        await loadUniversities();
      } catch (
        requestError
      ) {
        console.error(
          "Create university failed:",
          requestError
        );

        setCreateError(
          requestError instanceof
            Error
            ? requestError.message
            : "Unable to create this university."
        );
      } finally {
        setCreating(
          false
        );
      }
    };

  return (
    <AdminShell title="Universities">
      <div className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-600">
              University management
            </p>

            <h1 className="mt-2 text-2xl font-black text-slate-950 sm:text-3xl">
              Campus network
            </h1>

            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
              Manage CampusMart universities,
              campus availability, student
              verification paths, and matric
              validation settings.
            </p>
          </div>

          <button
            type="button"
            onClick={
              openCreateModal
            }
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
          >
            <span
              aria-hidden="true"
              className="text-lg leading-none"
            >
              +
            </span>

            Add university
          </button>
        </div>

        {error ? (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="text-sm font-semibold leading-6 text-red-700">
              {error}
            </p>

            <button
              type="button"
              onClick={() =>
                void loadUniversities()
              }
              className="mt-3 rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-bold text-red-700"
            >
              Try again
            </button>
          </div>
        ) : null}

        {actionError ? (
          <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold leading-6 text-red-700">
            {
              actionError
            }
          </div>
        ) : null}

        {notice ? (
          <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold leading-6 text-emerald-700">
            {
              notice
            }
          </div>
        ) : null}

        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
              Universities
            </p>

            <p className="mt-3 text-3xl font-black text-slate-950">
              {
                stats.total
              }
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
              Active
            </p>

            <p className="mt-3 text-3xl font-black text-slate-950">
              {
                stats.active
              }
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
              Verification on
            </p>

            <p className="mt-3 text-3xl font-black text-slate-950">
              {
                stats.verificationEnabled
              }
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
              Manual review
            </p>

            <p className="mt-3 text-3xl font-black text-slate-950">
              {
                stats.manualReview
              }
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
              Automated
            </p>

            <p className="mt-3 text-3xl font-black text-slate-950">
              {
                stats.automatedConfigured
              }
            </p>

            <p className="mt-1 text-xs font-semibold text-slate-400">
              configured sources
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
              Linked users
            </p>

            <p className="mt-3 text-3xl font-black text-slate-950">
              {
                stats.linkedUsers
              }
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-violet-200 bg-violet-50 p-5">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-violet-700">
            Multi-source verification architecture
          </p>

          <p className="mt-2 text-sm leading-6 text-violet-900">
            CampusMart can now represent a
            primary automated source, a fallback
            automated source, and a separate
            Manual review path for each university.
            Automated providers remain unavailable
            until a real university API, roster
            verifier, or approved database
            integration is implemented and tested.
          </p>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_180px_200px]">
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                Search
              </span>

              <input
                value={
                  search
                }
                onChange={(
                  event
                ) =>
                  setSearch(
                    event.target.value
                  )
                }
                placeholder="Search name, short name, location or verification source..."
                className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-950 focus:bg-white"
              />
            </label>

            <label className="block">
              <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                Campus status
              </span>

              <select
                value={
                  activeFilter
                }
                onChange={(
                  event
                ) =>
                  setActiveFilter(
                    event
                      .target
                      .value as
                      ActiveFilter
                  )
                }
                className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none focus:border-slate-950 focus:bg-white"
              >
                <option value="all">
                  All
                </option>

                <option value="active">
                  Active
                </option>

                <option value="inactive">
                  Inactive
                </option>
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                Student verification
              </span>

              <select
                value={
                  verificationFilter
                }
                onChange={(
                  event
                ) =>
                  setVerificationFilter(
                    event
                      .target
                      .value as
                      VerificationFilter
                  )
                }
                className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none focus:border-slate-950 focus:bg-white"
              >
                <option value="all">
                  All
                </option>

                <option value="enabled">
                  Enabled
                </option>

                <option value="disabled">
                  Disabled
                </option>
              </select>
            </label>
          </div>
        </div>

        <div className="mt-6">
          {loading ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
              <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-slate-950" />

              <p className="mt-4 text-sm font-semibold text-slate-500">
                Loading universities...
              </p>
            </div>
          ) : null}

          {!loading &&
          !error &&
          visibleUniversities.length ===
            0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
              <p className="text-lg font-bold text-slate-950">
                No universities found
              </p>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                Try changing your search or
                filters.
              </p>
            </div>
          ) : null}

          {!loading &&
          visibleUniversities.length >
            0 ? (
            <div className="grid gap-4 xl:grid-cols-2">
              {visibleUniversities.map(
                (
                  university
                ) => {
                  const busy =
                    busyUniversityId ===
                    university.id;

                  return (
                    <article
                      key={
                        university.id
                      }
                      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 hover:shadow-md sm:p-6"
                    >
                      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex min-w-0 gap-4">
                          {university.logoUrl ? (
                            <img
                              src={
                                university.logoUrl
                              }
                              alt=""
                              className="h-14 w-14 shrink-0 rounded-xl border border-slate-200 bg-white object-contain p-2"
                            />
                          ) : (
                            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-sm font-black text-white">
                              {university.shortName.slice(
                                0,
                                4
                              )}
                            </div>
                          )}

                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h2 className="text-lg font-black text-slate-950">
                                {
                                  university.name
                                }
                              </h2>

                              <span
                                className={`rounded-full border px-2.5 py-1 text-xs font-bold ${
                                  university.active
                                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                    : "border-slate-200 bg-slate-100 text-slate-600"
                                }`}
                              >
                                {university.active
                                  ? "Active"
                                  : "Inactive"}
                              </span>
                            </div>

                            <p className="mt-1 text-sm font-semibold text-slate-500">
                              {
                                university.shortName
                              }{" "}
                              ·{" "}
                              {
                                university.city
                              }
                              ,{" "}
                              {
                                university.state
                              }
                            </p>

                            <p className="mt-1 text-xs text-slate-400">
                              Added{" "}
                              {formatDate(
                                university.createdAt
                              )}
                            </p>
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                          <div>
                            <p className="text-xs font-bold text-slate-900">
                              Campus active
                            </p>

                            <p className="text-[11px] text-slate-500">
                              Public selector
                            </p>
                          </div>

                          <Toggle
                            checked={
                              university.active
                            }
                            disabled={
                              busy
                            }
                            onChange={() =>
                              void toggleUniversityActive(
                                university
                              )
                            }
                            label={`Toggle ${university.name} active state`}
                          />
                        </div>
                      </div>

                      <div className="mt-5 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                          <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                            Student verification
                          </p>

                          <p
                            className={`mt-2 text-sm font-bold ${
                              university.studentVerificationEnabled
                                ? "text-emerald-700"
                                : "text-slate-600"
                            }`}
                          >
                            {university.studentVerificationEnabled
                              ? "Enabled"
                              : "Disabled"}
                          </p>
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                          <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                            Manual review
                          </p>

                          <p
                            className={`mt-2 text-sm font-bold ${
                              university.manualReviewEnabled
                                ? "text-amber-700"
                                : "text-slate-600"
                            }`}
                          >
                            {university.manualReviewEnabled
                              ? "Enabled"
                              : "Disabled"}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 rounded-xl border border-slate-200 p-4">
                        <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                          Automated verification
                        </p>

                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <div>
                            <p className="text-xs font-semibold text-slate-500">
                              Primary source
                            </p>

                            <div className="mt-2">
                              <SourceBadge
                                source={
                                  university.primaryVerificationSource
                                }
                              />
                            </div>
                          </div>

                          <div>
                            <p className="text-xs font-semibold text-slate-500">
                              Fallback source
                            </p>

                            <div className="mt-2">
                              <SourceBadge
                                source={
                                  university.fallbackVerificationSource
                                }
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 grid gap-3 sm:grid-cols-3">
                        <div className="rounded-xl border border-slate-200 p-3">
                          <p className="text-xs text-slate-500">
                            Linked users
                          </p>

                          <p className="mt-1 text-lg font-black text-slate-950">
                            {
                              university.userCount
                            }
                          </p>
                        </div>

                        <div className="rounded-xl border border-slate-200 p-3">
                          <p className="text-xs text-slate-500">
                            Matric rules
                          </p>

                          <p className="mt-1 text-sm font-bold text-slate-950">
                            {university.matricValidationEnabled
                              ? "Enabled"
                              : "Disabled"}
                          </p>
                        </div>

                        <div className="rounded-xl border border-slate-200 p-3">
                          <p className="text-xs text-slate-500">
                            Updated
                          </p>

                          <p className="mt-1 text-sm font-bold text-slate-950">
                            {formatDate(
                              university.updatedAt
                            )}
                          </p>
                        </div>
                      </div>

                      {university.studentVerificationEnabled &&
                      university.primaryVerificationSource ===
                        "none" &&
                      university.fallbackVerificationSource ===
                        "none" &&
                      university.manualReviewEnabled ? (
                        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                          <p className="text-xs font-bold uppercase tracking-[0.12em] text-amber-700">
                            Current verification path
                          </p>

                          <p className="mt-1 text-sm font-semibold leading-6 text-amber-900">
                            Manual review only
                          </p>
                        </div>
                      ) : null}

                      {university.primaryVerificationSource !==
                        "none" ||
                      university.fallbackVerificationSource !==
                        "none" ? (
                        <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3">
                          <p className="text-xs font-bold uppercase tracking-[0.12em] text-violet-700">
                            Automated source configured
                          </p>

                          <p className="mt-1 text-sm leading-6 text-violet-900">
                            Verify that the provider is
                            genuinely connected and tested
                            before treating this university
                            as automatically verifiable.
                          </p>
                        </div>
                      ) : null}

                      <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs leading-5 text-slate-400">
                          University ID:{" "}
                          <span className="font-mono">
                            {
                              university.id
                            }
                          </span>
                        </p>

                        <button
                          type="button"
                          onClick={() =>
                            openUniversity(
                              university.id
                            )
                          }
                          className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
                        >
                          Manage university
                        </button>
                      </div>
                    </article>
                  );
                }
              )}
            </div>
          ) : null}
        </div>

        {createOpen ? (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-4 py-6"
            onMouseDown={(
              event
            ) => {
              if (
                event.target ===
                event.currentTarget
              ) {
                closeCreateModal();
              }
            }}
          >
            <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
              <form
                onSubmit={
                  createUniversity
                }
                className="p-6 sm:p-7"
              >
                <div className="flex items-start justify-between gap-5">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-600">
                      University management
                    </p>

                    <h2 className="mt-2 text-2xl font-black text-slate-950">
                      Add university
                    </h2>

                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      Create the managed
                      university record first.
                      Verification sources and
                      matric rules can then be
                      configured from its
                      management page.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={
                      closeCreateModal
                    }
                    disabled={
                      creating
                    }
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-xl font-bold text-slate-500 transition hover:bg-slate-50 disabled:opacity-50"
                    aria-label="Close"
                  >
                    ×
                  </button>
                </div>

                <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4">
                  <p className="text-sm font-bold text-blue-950">
                    Safe default
                  </p>

                  <p className="mt-1 text-sm leading-6 text-blue-800">
                    New universities start with
                    student verification disabled,
                    no automated source, Manual
                    review disabled, and matric
                    validation disabled.
                  </p>
                </div>

                {createError ? (
                  <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold leading-6 text-red-700">
                    {
                      createError
                    }
                  </div>
                ) : null}

                <div className="mt-6 grid gap-5 sm:grid-cols-2">
                  <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
                    Official university name

                    <input
                      required
                      value={
                        createForm.name
                      }
                      onChange={(
                        event
                      ) =>
                        setCreateForm(
                          (
                            current
                          ) => ({
                            ...current,

                            name:
                              event
                                .target
                                .value,
                          })
                        )
                      }
                      placeholder="University of Uyo"
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-950 outline-none transition focus:border-slate-950 focus:bg-white"
                    />
                  </label>

                  <label className="text-sm font-semibold text-slate-700">
                    Short name

                    <input
                      required
                      value={
                        createForm.shortName
                      }
                      onChange={(
                        event
                      ) =>
                        setCreateForm(
                          (
                            current
                          ) => ({
                            ...current,

                            shortName:
                              event
                                .target
                                .value
                                .toUpperCase(),
                          })
                        )
                      }
                      placeholder="UNIUYO"
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 uppercase text-slate-950 outline-none transition focus:border-slate-950 focus:bg-white"
                    />
                  </label>

                  <label className="text-sm font-semibold text-slate-700">
                    Country

                    <input
                      required
                      value={
                        createForm.country
                      }
                      onChange={(
                        event
                      ) =>
                        setCreateForm(
                          (
                            current
                          ) => ({
                            ...current,

                            country:
                              event
                                .target
                                .value,
                          })
                        )
                      }
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-950 outline-none transition focus:border-slate-950 focus:bg-white"
                    />
                  </label>

                  <label className="text-sm font-semibold text-slate-700">
                    State

                    <input
                      required
                      value={
                        createForm.state
                      }
                      onChange={(
                        event
                      ) =>
                        setCreateForm(
                          (
                            current
                          ) => ({
                            ...current,

                            state:
                              event
                                .target
                                .value,
                          })
                        )
                      }
                      placeholder="Akwa Ibom"
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-950 outline-none transition focus:border-slate-950 focus:bg-white"
                    />
                  </label>

                  <label className="text-sm font-semibold text-slate-700">
                    City / area

                    <input
                      required
                      value={
                        createForm.city
                      }
                      onChange={(
                        event
                      ) =>
                        setCreateForm(
                          (
                            current
                          ) => ({
                            ...current,

                            city:
                              event
                                .target
                                .value,
                          })
                        )
                      }
                      placeholder="Uyo"
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-950 outline-none transition focus:border-slate-950 focus:bg-white"
                    />
                  </label>

                  <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
                    Logo URL
                    <span className="ml-1 font-normal text-slate-400">
                      optional
                    </span>

                    <input
                      type="url"
                      value={
                        createForm.logoUrl
                      }
                      onChange={(
                        event
                      ) =>
                        setCreateForm(
                          (
                            current
                          ) => ({
                            ...current,

                            logoUrl:
                              event
                                .target
                                .value,
                          })
                        )
                      }
                      placeholder="https://..."
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-950 outline-none transition focus:border-slate-950 focus:bg-white"
                    />
                  </label>
                </div>

                <div className="mt-5 flex items-center justify-between gap-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div>
                    <p className="text-sm font-bold text-slate-950">
                      Active on CampusMart
                    </p>

                    <p className="mt-1 text-sm leading-6 text-slate-500">
                      Active universities can
                      appear in the public
                      university selector.
                    </p>
                  </div>

                  <Toggle
                    checked={
                      createForm.active
                    }
                    onChange={(
                      checked
                    ) =>
                      setCreateForm(
                        (
                          current
                        ) => ({
                          ...current,

                          active:
                            checked,
                        })
                      )
                    }
                    label="New university active state"
                  />
                </div>

                <div className="mt-6 flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    disabled={
                      creating
                    }
                    onClick={
                      closeCreateModal
                    }
                    className="rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={
                      creating
                    }
                    className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {creating
                      ? "Adding university..."
                      : "Add university"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}
      </div>
    </AdminShell>
  );
}