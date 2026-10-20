"use client";
import { useCampusMartConfirm } from "@/components/common/CampusMartConfirm";


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
  useParams,
  useRouter,
} from "next/navigation";

import AdminShell from "@/components/admin/AdminShell";

import UniversityRosterPanel from "@/components/admin/UniversityRosterPanel";
import MatricPatternEditor from "@/components/admin/MatricPatternEditor";
import { NIGERIA_LOCATIONS, NIGERIAN_STATES } from "@/lib/nigeriaLocations";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:5000";

const ADMIN_TOKEN_KEY =
  "campusmart-admin-token";

type VerificationMethod =
  | "none"
  | "manual"
  | "database"
  | "api";

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

  /*
   * Legacy field.
   *
   * Retained temporarily while the rest of CampusMart
   * migrates fully to source-aware verification.
   */
  verificationMethod:
    VerificationMethod;

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
  sellerAccounts?: number;
  activeListings?: number;
  buyerOrders?: number;
  completedHandoffs?: number;

  createdAt: string;

  updatedAt: string;
};

type UniversityForm = {
  name: string;

  shortName: string;

  country: string;

  state: string;

  city: string;

  logoUrl: string;

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

  matricPattern: string;

  matricFormatHint: string;
};

const SOURCE_OPTIONS: {
  value:
    VerificationSource;

  label:
    string;

  description:
    string;

  available:
    boolean;
}[] = [
  {
    value:
      "none",

    label:
      "None",

    description:
      "No automated verification source.",

    available:
      true,
  },

  {
    value:
      "university_api",

    label:
      "University API",

    description:
      "Live verification through an approved university API.",

    available:
      false,
  },

  {
    value:
      "roster_import",

    label:
      "Roster import / CSV",

    description:
      "Verification against a managed university roster.",

    /*
     * Enabled only when server confirms at least one certified source.
     */
    available:
      false,
  },

  {
    value:
      "university_database",

    label:
      "University database",

    description:
      "Read-only verification through an approved university data source.",

    available:
      false,
  },
];

function universityToForm(
  university:
    AdminUniversity
): UniversityForm {
  return {
    name:
      university.name,

    shortName:
      university.shortName,

    country:
      university.country,

    state:
      university.state,

    city:
      university.city,

    logoUrl:
      university.logoUrl ||
      "",

    active:
      university.active,

    studentVerificationEnabled:
      university.studentVerificationEnabled,

    primaryVerificationSource:
      university.primaryVerificationSource ||
      "none",

    fallbackVerificationSource:
      university.fallbackVerificationSource ||
      "none",

    manualReviewEnabled:
      university.manualReviewEnabled ??
      false,

    matricValidationEnabled:
      university.matricValidationEnabled,

    matricPattern:
      university.matricPattern ||
      "",

    matricFormatHint:
      university.matricFormatHint ||
      "",
  };
}

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

function sourceBadgeClass(
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

function formatDateTime(
  value?:
    | string
    | null
) {
  if (!value) {
    return "Not available";
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
    return "Not available";
  }

  return date.toLocaleString(
    "en-GB",
    {
      day:
        "numeric",

      month:
        "short",

      year:
        "numeric",

      hour:
        "2-digit",

      minute:
        "2-digit",
    }
  );
}

function Toggle({
  checked,
  onChange,
  disabled = false,
  label,
}: {
  checked: boolean;

  onChange:
    (
      checked:
        boolean
    ) => void;

  disabled?:
    boolean;

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

export default function AdminUniversityPage() {
  const campusMartConfirm = useCampusMartConfirm();

  const params =
    useParams<{
      universityId:
        string;
    }>();

  const router =
    useRouter();

  const universityId =
    Array.isArray(
      params.universityId
    )
      ? params
          .universityId[0]
      : params.universityId;

  const [
    university,
    setUniversity,
  ] =
    useState<
      AdminUniversity | null
    >(null);

  const [
    form,
    setForm,
  ] =
    useState<
      UniversityForm | null
    >(null);

  const [
    initialForm,
    setInitialForm,
  ] =
    useState<
      UniversityForm | null
    >(null);

  const [
    loading,
    setLoading,
  ] =
    useState(
      true
    );

  const [
    saving,
    setSaving,
  ] =
    useState(
      false
    );

  const [
    error,
    setError,
  ] =
    useState(
      ""
    );

  const [
    successMessage,
    setSuccessMessage,
  ] =
    useState(
      ""
    );

  // Manage one university function at a time, without losing unsaved form state.
  const [activeTab, setActiveTab] =
    useState<"overview" | "details" | "verification" | "roster" | "matric">("overview");

  // An active, certified source may have institution, faculty, or department scope.
  // All scopes are subject to server-side matric/name/status checks.
  const [rosterCertified, setRosterCertified] = useState(false);

  const refreshRosterCertification = useCallback(async () => {
    if (!universityId) return;
    try {
      const token = sessionStorage.getItem(ADMIN_TOKEN_KEY);
      if (!token) { setRosterCertified(false); return; }
      const response = await fetch(
        `${API_URL}/api/admin/universities/${universityId}/rosters/active`,
        { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
      );
      if (!response.ok) { setRosterCertified(false); return; }
      const data = await response.json();
      setRosterCertified(Boolean(
        data?.success &&
        Array.isArray(data?.activeRosters) &&
        data.activeRosters.some((source: {status:string;trustedForAutomatedVerification:boolean}) =>
          source.status === "active" && source.trustedForAutomatedVerification === true)
      ));
    } catch {
      // Fail closed if we cannot confirm trust on the server.
      setRosterCertified(false);
    }
  }, [universityId]);

  const loadUniversity =
    useCallback(
      async () => {
        if (
          !universityId
        ) {
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
          const response =
            await fetch(
              `${API_URL}/api/admin/universities/${universityId}`,
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
                "You do not have permission to manage universities."
            );
          }

          if (
            !response.ok ||
            !data?.success ||
            !data.university
          ) {
            throw new Error(
              data?.message ||
                "Unable to load this university."
            );
          }

          const loadedUniversity =
            data.university as
              AdminUniversity;

          const loadedForm =
            universityToForm(
              loadedUniversity
            );

          setUniversity(
            loadedUniversity
          );

          setForm(
            loadedForm
          );

          setInitialForm(
            loadedForm
          );
        } catch (
          requestError
        ) {
          console.error(
            "Load Admin university failed:",
            requestError
          );

          setError(
            requestError instanceof
              Error
              ? requestError.message
              : "Unable to load this university."
          );
        } finally {
          setLoading(
            false
          );
        }
      },
      [
        universityId,
        router,
      ]
    );

  useEffect(() => {
    void loadUniversity();
    void refreshRosterCertification();
  }, [loadUniversity, refreshRosterCertification]);

  const hasChanges =
    useMemo(
      () => {
        if (
          !form ||
          !initialForm
        ) {
          return false;
        }

        return (
          JSON.stringify(
            form
          ) !==
          JSON.stringify(
            initialForm
          )
        );
      },
      [
        form,
        initialForm,
      ]
    );

  const automatedSourceSelected =
    Boolean(
      form &&
        (
          form.primaryVerificationSource !==
            "none" ||
          form.fallbackVerificationSource !==
            "none"
        )
    );

  const hasVerificationPath =
    Boolean(
      form &&
        (
          form.manualReviewEnabled ||
          form.primaryVerificationSource !==
            "none" ||
          form.fallbackVerificationSource !==
            "none"
        )
    );

  const resetChanges =
    () => {
      if (
        !initialForm
      ) {
        return;
      }

      setForm({
        ...initialForm,
      });

      setError(
        ""
      );

      setSuccessMessage(
        ""
      );
    };

  const saveUniversity =
    async (
      event:
        FormEvent
    ) => {
      event.preventDefault();

      if (
        !form ||
        !university
      ) {
        return;
      }

      setError(
        ""
      );

      setSuccessMessage(
        ""
      );

      const name =
        form.name.trim();

      const shortName =
        form.shortName
          .trim()
          .toUpperCase();

      const country =
        form.country.trim();

      const state =
        form.state.trim();

      const city =
        form.city.trim();

      const logoUrl =
        form.logoUrl.trim();

      const matricPattern =
        form.matricPattern.trim();

      const matricFormatHint =
        form.matricFormatHint.trim();

      if (
        !name ||
        !shortName ||
        !country ||
        !state ||
        !city
      ) {
        setError(
          "University name, short name, country, state, and city are required."
        );

        return;
      }

      if (
        form.studentVerificationEnabled &&
        !hasVerificationPath
      ) {
        setError(
          "Enable Manual review or configure an available automated source before enabling student verification."
        );

        return;
      }

      if (
        form.fallbackVerificationSource !==
          "none" &&
        form.primaryVerificationSource ===
          "none"
      ) {
        setError(
          "Choose a primary verification source before a fallback source."
        );

        return;
      }

      if (
        form.primaryVerificationSource !==
          "none" &&
        form.primaryVerificationSource ===
          form.fallbackVerificationSource
      ) {
        setError(
          "Primary and fallback verification sources must be different."
        );

        return;
      }

      // University API and database integrations remain unavailable.
      // Roster verification needs at least one certified, active source.
      // Per-record matching and conflicting-source decisions stay backend-authoritative.
      if (
        form.studentVerificationEnabled &&
        automatedSourceSelected &&
        !(
          rosterCertified &&
          [form.primaryVerificationSource, form.fallbackVerificationSource]
            .every(source => source === "none" || source === "roster_import")
        )
      ) {
        setError(
          "Automatic verification requires an approved source. To use CSV/Roster, first certify an authorised current-student register in the Roster tab. University API and database sources are not connected."
        );
        return;
      }

      if (
        form.matricValidationEnabled &&
        !matricPattern
      ) {
        setError(
          "Enter the university-specific matric validation pattern before enabling matric validation."
        );

        return;
      }

      const confirmations:
        string[] =
          [];

      if (
        university.active &&
        !form.active
      ) {
        confirmations.push(
          "This university will stop appearing in the public university selector. Existing student accounts and historical data will remain."
        );
      }

      if (
        university
          .studentVerificationEnabled &&
        !form.studentVerificationEnabled
      ) {
        confirmations.push(
          "Student verification will be disabled for this university. Its verification-source configuration and Manual review setting will be cleared."
        );
      }

      if (
        university
          .matricValidationEnabled &&
        !form.matricValidationEnabled
      ) {
        confirmations.push(
          "Matric validation will be disabled. The stored private matric pattern and public format hint will be cleared."
        );
      }

      if (
        confirmations.length >
        0
      ) {
        const confirmed =
          await campusMartConfirm({ title: "Confirm action", description: `${confirmations.join(
              "\n\n"
            )}\n\nSave these changes?`, danger: false });

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

      setSaving(
        true
      );

      try {
        const response =
          await fetch(
            `${API_URL}/api/admin/universities/${university.id}`,
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
                  name,

                  shortName,

                  country,

                  state,

                  city,

                  logoUrl:
                    logoUrl ||
                    null,

                  // Availability changes require a reason and a Super Admin.
                  studentVerificationEnabled:
                    form.studentVerificationEnabled,

                  primaryVerificationSource:
                    form.studentVerificationEnabled
                      ? form.primaryVerificationSource
                      : "none",

                  fallbackVerificationSource:
                    form.studentVerificationEnabled
                      ? form.fallbackVerificationSource
                      : "none",

                  manualReviewEnabled:
                    form.studentVerificationEnabled
                      ? form.manualReviewEnabled
                      : false,

                  matricValidationEnabled:
                    form.matricValidationEnabled,

                  matricPattern:
                    form.matricValidationEnabled
                      ? matricPattern
                      : null,

                  matricFormatHint:
                    form.matricValidationEnabled
                      ? matricFormatHint ||
                        null
                      : null,
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
          setError(
            data?.message ||
              "You do not have permission to update universities."
          );

          return;
        }

        if (
          !response.ok ||
          !data?.success ||
          !data.university
        ) {
          throw new Error(
            data?.message ||
              "Unable to update this university."
          );
        }

        const updatedUniversity =
          data.university as
            AdminUniversity;

        const updatedForm =
          universityToForm(
            updatedUniversity
          );

        setUniversity(
          updatedUniversity
        );

        setForm(
          updatedForm
        );

        setInitialForm(
          updatedForm
        );

        setSuccessMessage(
          "University settings saved successfully."
        );
      } catch (
        requestError
      ) {
        console.error(
          "Update Admin university failed:",
          requestError
        );

        setError(
          requestError instanceof
            Error
            ? requestError.message
            : "Unable to update this university."
        );
      } finally {
        setSaving(
          false
        );
      }
    };

  return (
    <AdminShell title="University management">
      <div className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={() =>
            router.push(
              "/admin/universities"
            )
          }
          className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-slate-600 transition hover:text-slate-950"
        >
          <span aria-hidden="true">
            ←
          </span>

          Back to universities
        </button>

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-slate-950" />

            <p className="mt-4 text-sm font-semibold text-slate-500">
              Loading university
              settings...
            </p>
          </div>
        ) : null}

        {!loading &&
        error &&
        !university ? (
          <div className="rounded-2xl border border-red-200 bg-white p-8 shadow-sm">
            <p className="text-lg font-bold text-slate-950">
              University could not
              be loaded
            </p>

            <p className="mt-2 text-sm leading-6 text-red-700">
              {error}
            </p>

            <button
              type="button"
              onClick={() =>
                void loadUniversity()
              }
              className="mt-5 rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white"
            >
              Try again
            </button>
          </div>
        ) : null}

        {!loading &&
        university &&
        form ? (
          <>
            <div className="mb-4 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                {form.logoUrl ? (
                  <img
                    src={
                      form.logoUrl
                    }
                    alt=""
                    className="h-11 w-11 shrink-0 rounded-xl border border-slate-200 bg-white object-contain p-1"
                  />
                ) : (
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-sm font-black text-white">
                    {form.shortName.slice(
                      0,
                      3
                    ) ||
                      "UNI"}
                  </div>
                )}

                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-600">
                    Managed university
                  </p>

                  <h1 className="mt-1 text-lg font-black text-slate-950 sm:text-xl">
                    {
                      university.name
                    }
                  </h1>

                  <p className="mt-1 text-sm text-slate-500">
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
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <span
                  className={`rounded-full border px-3 py-1.5 text-xs font-bold ${
                    form.active
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-slate-200 bg-slate-100 text-slate-600"
                  }`}
                >
                  {form.active
                    ? "Active"
                    : "Inactive"}
                </span>

                <span
                  className={`rounded-full border px-3 py-1.5 text-xs font-bold ${
                    form.studentVerificationEnabled
                      ? "border-blue-200 bg-blue-50 text-blue-700"
                      : "border-slate-200 bg-slate-100 text-slate-600"
                  }`}
                >
                  Verification{" "}
                  {form.studentVerificationEnabled
                    ? "on"
                    : "off"}
                </span>

                <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600">
                  {
                    university.userCount
                  }{" "}
                  linked user
                  {university.userCount ===
                  1
                    ? ""
                    : "s"}
                </span>
              </div>
            </div>

            <nav
              aria-label="University management sections"
              className="sticky top-0 z-20 mb-4 flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm"
            >
              {(
                [
                  ["overview", "Overview"],
                  ["details", "Details"],
                  ["verification", "Verification"],
                  ["roster", "Roster"],
                  ["matric", "Matric rules"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-current={activeTab === value ? "page" : undefined}
                  onClick={() => setActiveTab(value)}
                  className={`shrink-0 rounded-lg px-3 py-2 text-xs font-bold transition-colors sm:text-sm ${
                    activeTab === value
                      ? "bg-slate-950 text-white"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {label}
                </button>
              ))}
            </nav>

            {error ? (
              <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold leading-6 text-red-700">
                {error}
              </div>
            ) : null}

            {successMessage ? (
              <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold leading-6 text-emerald-700">
                {
                  successMessage
                }
              </div>
            ) : null}

            <form
              onSubmit={
                saveUniversity
              }
            >
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
                <div className="space-y-4">
                  {activeTab === "overview" && (
                    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">At a glance</p>
                      <h2 className="mt-1 text-lg font-black">{university.name}</h2>
                      <p className="mt-1 text-sm text-slate-500">Choose a tab to update university details, verification, rosters, or matric rules.</p>
                      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Orders placed</p><p className="mt-1 text-sm font-bold">{university.buyerOrders ?? 0}</p></div>
                        <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Active listings</p><p className="mt-1 text-sm font-bold">{university.activeListings ?? 0}</p></div>
                        <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Verified handoffs</p><p className="mt-1 text-sm font-bold">{university.completedHandoffs ?? 0}</p></div>
                        <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Seller accounts</p><p className="mt-1 text-sm font-bold">{university.sellerAccounts ?? 0}</p></div>
                        <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Registration</p><p className="mt-1 text-sm font-bold">{form.active ? "Active" : "Inactive"}</p></div>
                        <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Verification</p><p className="mt-1 text-sm font-bold">{form.studentVerificationEnabled ? "Enabled" : "Disabled"}</p></div>
                        <div className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">Linked users</p><p className="mt-1 text-sm font-bold">{university.userCount}</p></div>
                      </div>
                      <div className="mt-4 flex flex-wrap items-center gap-4 rounded-lg border border-slate-100 p-3">
                        <svg viewBox="0 0 100 100" className="size-24 shrink-0" role="img" aria-label={`${university.sellerAccounts || 0} sellers and ${Math.max(0,university.userCount-(university.sellerAccounts||0))} buyers registered`}>
                          <circle cx="50" cy="50" r="35" fill="none" stroke="#e2e8f0" strokeWidth="14" />
                          <circle cx="50" cy="50" r="35" fill="none" stroke="#f59e0b" strokeWidth="14" strokeDasharray={`${university.userCount ? 220 * ((university.sellerAccounts || 0)/university.userCount) : 0} 220`} transform="rotate(-90 50 50)" />
                          <text x="50" y="53" textAnchor="middle" fontSize="15" fontWeight="bold">{university.userCount}</text>
                        </svg>
                        <div className="text-xs text-slate-600"><p className="font-bold text-slate-950">Account mix</p>
                          <p className="mt-2">● Sellers: {university.sellerAccounts || 0}</p>
                          <p>○ Buyer-role accounts: {Math.max(0,university.userCount-(university.sellerAccounts||0))}</p>
                          <p className="mt-1 text-[11px]">Registered accounts, not daily active users.</p>
                        </div>
                      </div>
                    </section>
                  )}
                  {activeTab === "details" && (
                  <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                          Institution
                        </p>

                        <h2 className="mt-2 text-xl font-bold text-slate-950">
                          University
                          details
                        </h2>

                        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                          CampusMart
                          controls these
                          records so
                          students cannot
                          create arbitrary
                          university
                          identities.
                        </p>
                      </div>

                      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <div>
                          <p className="text-sm font-bold text-slate-900">
                            Registration
                            access
                          </p>

                          <p className="mt-0.5 text-xs text-slate-500">
                            Show in the
                            public
                            university
                            selector
                          </p>
                        </div>

                        <span className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-slate-700">
                          {form.active ? "Active" : "Inactive"}
                        </span>
                      </div>
                    </div>

                    <div className="mt-6 grid gap-5 md:grid-cols-2">
                      <label className="block text-sm font-semibold text-slate-700 md:col-span-2">
                        Official
                        university name

                        <input
                          value={
                            form.name
                          }
                          onChange={(
                            event
                          ) =>
                            setForm(
                              (
                                current
                              ) =>
                                current
                                  ? {
                                      ...current,

                                      name:
                                        event
                                          .target
                                          .value,
                                    }
                                  : current
                            )
                          }
                          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-950"
                        />
                      </label>

                      <label className="block text-sm font-semibold text-slate-700">
                        Short name

                        <input
                          value={
                            form.shortName
                          }
                          onChange={(
                            event
                          ) =>
                            setForm(
                              (
                                current
                              ) =>
                                current
                                  ? {
                                      ...current,

                                      shortName:
                                        event
                                          .target
                                          .value
                                          .toUpperCase(),
                                    }
                                  : current
                            )
                          }
                          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm uppercase text-slate-950 outline-none transition focus:border-slate-950"
                        />
                      </label>

                      <label className="block text-sm font-semibold text-slate-700">
                        Country

                        <input
                          value={
                            form.country
                          }
                          onChange={(
                            event
                          ) =>
                            setForm(
                              (
                                current
                              ) =>
                                current
                                  ? {
                                      ...current,

                                      country:
                                        event
                                          .target
                                          .value,
                                    }
                                  : current
                            )
                          }
                          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-950"
                        />
                      </label>

                      <label className="block text-sm font-semibold text-slate-700">State / FCT
                        {form.country.trim().toLowerCase() === "nigeria" ?
                          <select value={form.state} onChange={event=>setForm(current=>current?{...current,state:event.target.value,city:""}:current)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm">
                            <option value="">Select state / FCT</option>
                            {NIGERIAN_STATES.map(state=><option key={state} value={state}>{state}</option>)}
                          </select>
                          : <input value={form.state} onChange={event=>setForm(current=>current?{...current,state:event.target.value}:current)} className="mt-2 w-full rounded-xl border px-4 py-3 text-sm" />}
                      </label>
                      <label className="block text-sm font-semibold text-slate-700">City / area
                        <input list="university-city-list" value={form.city} onChange={event=>setForm(current=>current?{...current,city:event.target.value}:current)} className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm" placeholder="Choose or enter city" />
                        <datalist id="university-city-list">{(NIGERIA_LOCATIONS[form.state]||[]).map(city=><option key={city} value={city}/>)}</datalist>
                      </label>

                      <label className="block text-sm font-semibold text-slate-700 md:col-span-2">
                        Logo URL

                        <input
                          value={
                            form.logoUrl
                          }
                          onChange={(
                            event
                          ) =>
                            setForm(
                              (
                                current
                              ) =>
                                current
                                  ? {
                                      ...current,

                                      logoUrl:
                                        event
                                          .target
                                          .value,
                                    }
                                  : current
                            )
                          }
                          placeholder="https://..."
                          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-950"
                        />
                      </label>
                    </div>
                  </section>
                  )}

                  {activeTab === "verification" && (
                  <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                          Identity
                          verification
                        </p>

                        <h2 className="mt-2 text-xl font-bold text-slate-950">
                          Student
                          verification
                          architecture
                        </h2>

                        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                          A university can
                          use a primary
                          automated source,
                          a fallback source,
                          and a separate
                          Manual review path
                          for authorised
                          exceptions.
                        </p>
                      </div>

                      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <div>
                          <p className="text-sm font-bold text-slate-900">
                            Student
                            verification
                          </p>

                          <p className="mt-0.5 text-xs text-slate-500">
                            Allow students
                            from this
                            university to
                            verify
                          </p>
                        </div>

                        <Toggle
                          checked={
                            form.studentVerificationEnabled
                          }
                          onChange={(
                            checked
                          ) =>
                            setForm(
                              (
                                current
                              ) => {
                                if (
                                  !current
                                ) {
                                  return current;
                                }

                                if (
                                  !checked
                                ) {
                                  return {
                                    ...current,

                                    studentVerificationEnabled:
                                      false,

                                    primaryVerificationSource:
                                      "none",

                                    fallbackVerificationSource:
                                      "none",

                                    manualReviewEnabled:
                                      false,
                                  };
                                }

                                return {
                                  ...current,

                                  studentVerificationEnabled:
                                    true,
                                };
                              }
                            )
                          }
                          label="Student verification enabled"
                        />
                      </div>
                    </div>

                    {form.studentVerificationEnabled ? (
                      <div className="mt-6 space-y-5">
                        <div className="grid gap-5 lg:grid-cols-2">
                          <label className="block text-sm font-semibold text-slate-700">
                            Primary
                            automated
                            source

                            <select
                              value={
                                form.primaryVerificationSource
                              }
                              onChange={(
                                event
                              ) => {
                                const value =
                                  event
                                    .target
                                    .value as
                                    VerificationSource;

                                setForm(
                                  (
                                    current
                                  ) =>
                                    current
                                      ? {
                                          ...current,

                                          primaryVerificationSource:
                                            value,

                                          fallbackVerificationSource:
                                            value ===
                                            "none"
                                              ? "none"
                                              : current.fallbackVerificationSource,
                                        }
                                      : current
                                );
                              }}
                              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-950"
                            >
                              {SOURCE_OPTIONS.map(
                                (
                                  option
                                ) => (
                                  <option
                                    key={
                                      option.value
                                    }
                                    value={
                                      option.value
                                    }
                                    disabled={
                                      !option.available &&
                                      !(option.value === "roster_import" && rosterCertified) &&
                                      form.primaryVerificationSource !==
                                        option.value
                                    }
                                  >
                                    {
                                      option.label
                                    }

                                    {!option.available
                                      ? option.value === "roster_import"
                                        ? rosterCertified ? " — certified" : " — certification required"
                                        : " — not connected"
                                      : ""}
                                  </option>
                                )
                              )}
                            </select>

                            <span className="mt-2 block text-xs leading-5 text-slate-500">
                              Preferred
                              source for
                              automatic
                              student
                              identity
                              checks.
                            </span>
                          </label>

                          <label className="block text-sm font-semibold text-slate-700">
                            Fallback
                            automated
                            source

                            <select
                              value={
                                form.fallbackVerificationSource
                              }
                              disabled={
                                form.primaryVerificationSource ===
                                "none"
                              }
                              onChange={(
                                event
                              ) =>
                                setForm(
                                  (
                                    current
                                  ) =>
                                    current
                                      ? {
                                          ...current,

                                          fallbackVerificationSource:
                                            event
                                              .target
                                              .value as
                                              VerificationSource,
                                        }
                                      : current
                                )
                              }
                              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-950 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                            >
                              {SOURCE_OPTIONS.map(
                                (
                                  option
                                ) => (
                                  <option
                                    key={
                                      option.value
                                    }
                                    value={
                                      option.value
                                    }
                                    disabled={
                                      (
                                        !option.available &&
                                        !(option.value === "roster_import" && rosterCertified) &&
                                        form.fallbackVerificationSource !==
                                          option.value
                                      ) ||
                                      (
                                        option.value !==
                                          "none" &&
                                        option.value ===
                                          form.primaryVerificationSource
                                      )
                                    }
                                  >
                                    {
                                      option.label
                                    }

                                    {!option.available
                                      ? option.value === "roster_import"
                                        ? rosterCertified ? " — certified" : " — certification required"
                                        : " — not connected"
                                      : ""}
                                  </option>
                                )
                              )}
                            </select>

                            <span className="mt-2 block text-xs leading-5 text-slate-500">
                              Used only
                              when the
                              primary
                              source cannot
                              provide a
                              permitted
                              result.
                            </span>
                          </label>
                        </div>

                        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-sm font-bold text-amber-950">
                                Manual
                                review
                              </p>

                              <p className="mt-1 text-sm leading-6 text-amber-800">
                                Human
                                exception
                                path for
                                approved
                                cases such
                                as
                                unavailable
                                integrations,
                                recent
                                admission or
                                transfer,
                                and
                                authorised
                                support
                                cases.
                              </p>
                            </div>

                            <Toggle
                              checked={
                                form.manualReviewEnabled
                              }
                              onChange={(
                                checked
                              ) =>
                                setForm(
                                  (
                                    current
                                  ) =>
                                    current
                                      ? {
                                          ...current,

                                          manualReviewEnabled:
                                            checked,
                                        }
                                      : current
                                )
                              }
                              label="Manual review enabled"
                            />
                          </div>
                        </div>

                        <div className="rounded-xl border border-violet-200 bg-violet-50 p-4">
                          <p className="text-xs font-bold uppercase tracking-[0.14em] text-violet-700">
                            Automated
                            verification
                            is still
                            locked
                          </p>

                          <p className="mt-2 text-sm leading-6 text-violet-900">
                            Roster upload,
                            validation,
                            private storage,
                            and history are
                            implemented. A
                            Super Admin can
                            approve a trusted
                            institution-wide
                            active roster in
                            the Roster tab.
                            Uncertified or
                            departmental lists
                            cannot verify
                            students automatically.
                          </p>

                          <p className="mt-2 text-xs font-semibold leading-5 text-violet-700">
                            University API
                            and direct
                            database
                            integrations
                            also remain
                            unavailable
                            until real
                            approved
                            connections
                            exist.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                        Student
                        verification is
                        disabled for
                        this
                        university. No
                        verification
                        source or
                        Manual review
                        path is active.
                      </div>
                    )}
                  </section>
                  )}

                  {/*
                   * ===================================================
                   * UNIVERSITY ROSTER MANAGEMENT
                   * ===================================================
                   *
                   * Kept as a separate component so CSV upload,
                   * preview, metadata and history do not make this
                   * already-large university settings component harder
                   * to maintain.
                   */}
                  {activeTab === "roster" && (
                  <UniversityRosterPanel
                    universityId={university.id}
                    onCertificationChanged={() => {
                      void refreshRosterCertification();
                      void loadUniversity();
                    }}
                  />
                  )}

                  {activeTab === "matric" && (
                  <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                          Input quality
                        </p>

                        <h2 className="mt-2 text-xl font-bold text-slate-950">
                          Matric-number
                          format rules
                        </h2>

                        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                          Optional
                          format
                          validation can
                          catch obvious
                          input errors,
                          but it does not
                          verify student
                          identity.
                        </p>
                      </div>

                      <Toggle
                        checked={
                          form.matricValidationEnabled
                        }
                        onChange={(
                          checked
                        ) =>
                          setForm(
                            (
                              current
                            ) =>
                              current
                                ? {
                                    ...current,

                                    matricValidationEnabled:
                                      checked,
                                  }
                                : current
                          )
                        }
                        label="Matric validation enabled"
                      />
                    </div>

                    {form.matricValidationEnabled ? (
                      <div className="mt-6 grid gap-5">
                        <MatricPatternEditor value={form.matricPattern} onChange={value=>setForm(current=>current?{...current,matricPattern:value}:current)} />

                        <label className="block text-sm font-semibold text-slate-700">
                          Public format
                          hint

                          <input
                            value={
                              form.matricFormatHint
                            }
                            onChange={(
                              event
                            ) =>
                              setForm(
                                (
                                  current
                                ) =>
                                  current
                                    ? {
                                        ...current,

                                        matricFormatHint:
                                          event
                                            .target
                                            .value,
                                      }
                                    : current
                              )
                            }
                            placeholder="Student-friendly masked example or explanation"
                            className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-slate-950"
                          />

                          <span className="mt-2 block text-xs leading-5 text-slate-500">
                            This hint may
                            be shown to
                            students. Do
                            not place the
                            private regex
                            here.
                          </span>
                        </label>
                      </div>
                    ) : (
                      <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                        Matric-number
                        format checking
                        is disabled for
                        this
                        university.
                      </div>
                    )}
                  </section>
                  )}
                </div>

                <div className="space-y-4">
                  {activeTab === "roster" && (
                    <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-4 text-sm text-cyan-900">
                      <p className="font-bold">Roster imports save separately</p>
                      <p className="mt-1 text-xs leading-5">Upload and review roster data here. Importing a roster does not activate automatic identity verification.</p>
                    </div>
                  )}
                  {activeTab === "overview" && (
                  <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                      Current state
                    </p>

                    <h3 className="mt-2 text-xl font-bold text-slate-950">
                      Verification
                      summary
                    </h3>

                    <div className="mt-5 space-y-4 text-sm">
                      <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-4">
                        <span className="text-slate-500">
                          Campus access
                        </span>

                        <span className="font-bold text-slate-900">
                          {form.active
                            ? "Active"
                            : "Inactive"}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-4">
                        <span className="text-slate-500">
                          Student
                          verification
                        </span>

                        <span className="font-bold text-slate-900">
                          {form.studentVerificationEnabled
                            ? "Enabled"
                            : "Disabled"}
                        </span>
                      </div>

                      <div className="border-b border-slate-100 pb-4">
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-slate-500">
                            Primary source
                          </span>

                          <span
                            className={`rounded-full border px-2.5 py-1 text-right text-xs font-bold ${sourceBadgeClass(
                              form.primaryVerificationSource
                            )}`}
                          >
                            {sourceLabel(
                              form.primaryVerificationSource
                            )}
                          </span>
                        </div>
                      </div>

                      <div className="border-b border-slate-100 pb-4">
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-slate-500">
                            Fallback
                            source
                          </span>

                          <span
                            className={`rounded-full border px-2.5 py-1 text-right text-xs font-bold ${sourceBadgeClass(
                              form.fallbackVerificationSource
                            )}`}
                          >
                            {sourceLabel(
                              form.fallbackVerificationSource
                            )}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-4">
                        <span className="text-slate-500">
                          Manual review
                        </span>

                        <span className="font-bold text-slate-900">
                          {form.manualReviewEnabled
                            ? "Enabled"
                            : "Disabled"}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-4">
                        <span className="text-slate-500">
                          Matric
                          validation
                        </span>

                        <span className="font-bold text-slate-900">
                          {form.matricValidationEnabled
                            ? "Enabled"
                            : "Disabled"}
                        </span>
                      </div>
                    </div>
                  </section>
                  )}

                  {activeTab === "overview" && (
                    <details className="rounded-xl border border-slate-200 bg-white p-4">
                      <summary className="cursor-pointer text-sm font-bold text-slate-800">Verification policy notes (3)</summary>
                      <div className="mt-3 space-y-3">
                  <section className="rounded-2xl border border-cyan-200 bg-cyan-50 p-6">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-700">
                      Roster status
                    </p>

                    <h3 className="mt-2 text-lg font-bold text-cyan-950">
                      Import layer
                      available
                    </h3>

                    <p className="mt-3 text-sm leading-7 text-cyan-800">
                      University
                      rosters can now
                      be uploaded,
                      validated,
                      activated and
                      archived from
                      this page.
                      Roster-based
                      automatic
                      student
                      verification is
                      still disabled
                      until the
                      matching engine
                      is complete.
                    </p>
                  </section>

                  <section className="rounded-2xl border border-blue-200 bg-blue-50 p-6">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-600">
                      Source
                      authority
                    </p>

                    <h3 className="mt-2 text-lg font-bold text-blue-950">
                      Higher-authority
                      data wins
                    </h3>

                    <p className="mt-3 text-sm leading-7 text-blue-800">
                      When live
                      university
                      sources arrive,
                      a definitive
                      current result
                      must not be
                      overridden by an
                      older roster.
                      Source conflicts
                      must not
                      automatically
                      verify the
                      student.
                    </p>
                  </section>

                  <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-700">
                      Verification
                      integrity
                    </p>

                    <h3 className="mt-2 text-lg font-bold text-amber-950">
                      Format validation
                      is not identity
                      verification
                    </h3>

                    <p className="mt-3 text-sm leading-7 text-amber-800">
                      A matric number
                      matching a regex
                      only means its
                      shape looks
                      valid. Student
                      identity still
                      requires an
                      approved
                      university
                      source or an
                      authorised Manual
                      review.
                    </p>
                  </section>
                      </div>
                    </details>
                  )}

                  {activeTab === "overview" && (
                  <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                      Record
                    </p>

                    <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                          University ID
                        </p>

                        <p className="mt-1 break-all text-sm font-semibold text-slate-800">
                          {
                            university.id
                          }
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                          Slug
                        </p>

                        <p className="mt-1 text-sm font-semibold text-slate-800">
                          {
                            university.slug
                          }
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                          Created
                        </p>

                        <p className="mt-1 text-sm font-semibold text-slate-800">
                          {formatDateTime(
                            university.createdAt
                          )}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                          Updated
                        </p>

                        <p className="mt-1 text-sm font-semibold text-slate-800">
                          {formatDateTime(
                            university.updatedAt
                          )}
                        </p>
                      </div>
                    </div>
                  </section>
                  )}

                  {/*
                   * Not sticky anymore.
                   *
                   * The old sticky card could cover content on
                   * smaller screens. Since this page now also
                   * contains the roster importer, keeping this
                   * normal-flow is cleaner and safer.
                   */}
                  {activeTab !== "roster" && (activeTab !== "overview" || hasChanges) && (
                  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg">
                    <div>
                      <p className="font-bold text-slate-950">
                        University
                        settings
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        {hasChanges
                          ? "You have unsaved university-setting changes."
                          : "All university settings are saved."}
                      </p>

                      <p className="mt-2 text-xs leading-5 text-slate-400">
                        Roster imports
                        are saved
                        separately and
                        do not depend on
                        this button.
                      </p>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                      <button
                        type="button"
                        disabled={
                          !hasChanges ||
                          saving
                        }
                        onClick={
                          resetChanges
                        }
                        className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Reset
                      </button>

                      <button
                        type="submit"
                        disabled={
                          !hasChanges ||
                          saving
                        }
                        className="rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {saving
                          ? "Saving..."
                          : "Save changes"}
                      </button>
                    </div>

                    {automatedSourceSelected ? (
                      <p className="mt-3 text-xs font-semibold leading-5 text-violet-700">
                        Only certified institution-wide roster sources can
                        be used for automatic matching. University API and
                        database integrations are not connected.
                      </p>
                    ) : null}
                  </section>
                  )}
                </div>
              </div>
            </form>
          </>
        ) : null}
      </div>
    </AdminShell>
  );
}