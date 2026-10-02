"use client";

import {
  useEffect,
  useState,
} from "react";

import type {
  FormEvent,
} from "react";

import {
  useRouter,
} from "next/navigation";

import Image from "next/image";

import {
  useAuth,
} from "./AuthContext";

import VerificationAppealFlow, {
  type VerificationAppeal,
  type VerificationAppealStatus,
} from "./VerificationAppealFlow";

const API_URL =
  process.env
    .NEXT_PUBLIC_API_URL ||
  "http://localhost:5000";

const PREFS_KEY =
  "campusmart-account-preferences";

type StudentVerificationStatus =
  | "not_started"
  | "pending"
  | "verified"
  | "failed";

type VendorAccessStatus =
  | "active"
  | "pending_review"
  | "restricted"
  | "suspended";

type VendorVerificationStatus =
  | "not_started"
  | "pending"
  | "verified"
  | "rejected";

type BackendVendorProfile = {
  id: string;

  businessName: string;

  businessDescription: string;

  pickupLocation: string;

  verified: boolean;

  accessStatus:
    VendorAccessStatus;

  vendorVerificationStatus:
    VendorVerificationStatus;

  verificationSubmittedAt?:
    | string
    | null;

  vendorVerifiedAt?:
    | string
    | null;
};

type BackendUser = {
  id: string;

  name: string;

  email: string;

  role:
    | "client"
    | "vendor";

  campus?:
    | string
    | null;

  phone?:
    | string
    | null;

  bio?:
    | string
    | null;

  universityId?:
    | string
    | null;

  university?:
    | {
        id: string;
        name: string;
        shortName: string;
        state: string;
        city: string;

        studentVerificationEnabled:
          boolean;

        verificationMethod:
          | "none"
          | "manual"
          | "database"
          | "api";
      }
    | null;

  matricNumber?:
    | string
    | null;

  studentVerificationStatus?:
    StudentVerificationStatus;

  studentVerificationSource?:
    | string
    | null;

  studentVerifiedAt?:
    | string
    | null;

  fallbackUniversityName?:
    | string
    | null;

  fallbackState?:
    | string
    | null;

  fallbackCity?:
    | string
    | null;

  vendorProfile?:
    | BackendVendorProfile
    | null;

  createdAt?:
    | string
    | null;
};

function statusClass(
  status:
    | StudentVerificationStatus
    | VendorAccessStatus
    | VendorVerificationStatus
    | VerificationAppealStatus
    | null
    | undefined
) {
  switch (status) {
    case "verified":
    case "active":
    case "approved":
      return "border-emerald-200 bg-emerald-50 text-emerald-800";

    case "pending":
    case "pending_review":
    case "under_review":
      return "border-amber-200 bg-amber-50 text-amber-800";

    case "more_information_required":
      return "border-orange-200 bg-orange-50 text-orange-800";

    case "failed":
    case "rejected":
    case "restricted":
    case "suspended":
      return "border-red-200 bg-red-50 text-red-700";

    case "draft":
      return "border-slate-200 bg-slate-100 text-slate-700";

    default:
      return "border-slate-200 bg-slate-100 text-slate-700";
  }
}

function statusLabel(
  status:
    | StudentVerificationStatus
    | VendorAccessStatus
    | VendorVerificationStatus
    | VerificationAppealStatus
    | null
    | undefined
) {
  switch (status) {
    case "not_started":
      return "Not started";

    case "draft":
      return "Draft";

    case "pending":
      return "Pending";

    case "verified":
      return "Verified";

    case "failed":
      return "Failed";

    case "active":
      return "Active";

    case "pending_review":
      return "Pending review";

    case "restricted":
      return "Restricted";

    case "suspended":
      return "Suspended";

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
      return "Not available";
  }
}

function appealReasonLabel(
  reason:
    VerificationAppeal["reason"]
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

function formatDate(
  value:
    | string
    | null
    | undefined
) {
  if (!value) {
    return null;
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }

  return date.toLocaleDateString(
    "en-GB",
    {
      day: "numeric",
      month: "long",
      year: "numeric",
    }
  );
}

export default function AccountPanel({
  title = "Profile",

  description =
    "Manage your CampusMart account details and preferences.",
}: {
  title?: string;

  description?: string;
}) {
  const {
    user,
    updateProfile,
    changePassword,
    logout,
    openAuth,
  } = useAuth();

  const router =
    useRouter();

  const [
    backendUser,
    setBackendUser,
  ] =
    useState<
      BackendUser | null
    >(null);

  const [
    currentAppeal,
    setCurrentAppeal,
  ] =
    useState<
      VerificationAppeal | null
    >(null);

  const [
    accountLoading,
    setAccountLoading,
  ] =
    useState(true);

  const [
    accountError,
    setAccountError,
  ] =
    useState("");

  const [
    refreshVersion,
    setRefreshVersion,
  ] =
    useState(0);

  const [
    name,
    setName,
  ] =
    useState(
      user?.name ??
        ""
    );

  const [
    phone,
    setPhone,
  ] =
    useState(
      user?.phone ??
        ""
    );

  const [
    bio,
    setBio,
  ] =
    useState(
      user?.bio ??
        ""
    );

  const [
    avatarUrl,
    setAvatarUrl,
  ] =
    useState(
      user?.avatarUrl ??
        ""
    );

  const [
    businessName,
    setBusinessName,
  ] =
    useState(
      user?.businessName ??
        ""
    );

  const [
    businessDescription,
    setBusinessDescription,
  ] =
    useState(
      user?.businessDescription ??
        ""
    );

  const [
    pickupLocation,
    setPickupLocation,
  ] =
    useState(
      user?.pickupLocation ??
        ""
    );

  const [
    emailUpdates,
    setEmailUpdates,
  ] =
    useState(true);

  const [
    orderAlerts,
    setOrderAlerts,
  ] =
    useState(true);

  const [
    saved,
    setSaved,
  ] =
    useState(false);

  const [
    currentPassword,
    setCurrentPassword,
  ] =
    useState("");

  const [
    newPassword,
    setNewPassword,
  ] =
    useState("");

  const [
    confirmPassword,
    setConfirmPassword,
  ] =
    useState("");

  const [
    passwordMessage,
    setPasswordMessage,
  ] =
    useState("");

  useEffect(() => {
    if (!user) {
      setBackendUser(
        null
      );

      setCurrentAppeal(
        null
      );

      setAccountLoading(
        false
      );

      return;
    }

    let cancelled =
      false;

    const loadAccount =
      async () => {
        setAccountLoading(
          true
        );

        setAccountError(
          ""
        );

        const token =
          localStorage.getItem(
            "campusmart-token"
          );

        if (!token) {
          setAccountLoading(
            false
          );

          return;
        }

        try {
          const [
            accountResponse,
            appealResponse,
          ] =
            await Promise.all([
              fetch(
                `${API_URL}/api/auth/me`,
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
                `${API_URL}/api/verification/appeals/current`,
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

          const accountData =
            await accountResponse.json();

          const appealData =
            await appealResponse.json();

          if (
            !accountResponse.ok ||
            !accountData.success
          ) {
            throw new Error(
              accountData.message ||
                "Unable to load account."
            );
          }

          if (cancelled) {
            return;
          }

          setBackendUser(
            accountData.user
          );

          if (
            appealResponse.ok &&
            appealData.success
          ) {
            setCurrentAppeal(
              appealData.appeal ??
                null
            );
          } else {
            setCurrentAppeal(
              null
            );
          }
        } catch (error) {
          console.error(
            "Account load failed:",
            error
          );

          if (!cancelled) {
            setAccountError(
              error instanceof
                Error
                ? error.message
                : "Unable to load the latest account information."
            );
          }
        } finally {
          if (!cancelled) {
            setAccountLoading(
              false
            );
          }
        }
      };

    void loadAccount();

    return () => {
      cancelled =
        true;
    };
  }, [
    user,
    refreshVersion,
  ]);

  useEffect(() => {
    if (!user) {
      return;
    }

    const currentName =
      backendUser?.name ??
      user.name;

    const currentPhone =
      backendUser?.phone ??
      user.phone ??
      "";

    const currentBio =
      backendUser?.bio ??
      user.bio ??
      "";

    const currentBusinessName =
      backendUser
        ?.vendorProfile
        ?.businessName ??
      user.businessName ??
      "";

    const currentBusinessDescription =
      backendUser
        ?.vendorProfile
        ?.businessDescription ??
      user.businessDescription ??
      "";

    const currentPickupLocation =
      backendUser
        ?.vendorProfile
        ?.pickupLocation ??
      user.pickupLocation ??
      "";

    setName(
      currentName
    );

    setPhone(
      currentPhone
    );

    setBio(
      currentBio
    );

    setAvatarUrl(
      user.avatarUrl ??
        ""
    );

    setBusinessName(
      currentBusinessName
    );

    setBusinessDescription(
      currentBusinessDescription
    );

    setPickupLocation(
      currentPickupLocation
    );

    try {
      const stored =
        JSON.parse(
          localStorage.getItem(
            PREFS_KEY
          ) ?? "{}"
        ) as {
          emailUpdates?:
            boolean;

          orderAlerts?:
            boolean;
        };

      setEmailUpdates(
        stored.emailUpdates ??
          true
      );

      setOrderAlerts(
        stored.orderAlerts ??
          true
      );
    } catch {
      setEmailUpdates(
        true
      );

      setOrderAlerts(
        true
      );
    }
  }, [
    user,
    backendUser,
  ]);

  const save = (
    event:
      FormEvent
  ) => {
    event.preventDefault();

    updateProfile({
      name:
        name.trim() ||
        user?.name ||
        "Student",

      phone:
        phone.trim(),

      bio:
        bio.trim(),

      avatarUrl:
        avatarUrl.trim(),

      businessName:
        businessName.trim(),

      businessDescription:
        businessDescription.trim(),

      pickupLocation:
        pickupLocation.trim(),
    });

    localStorage.setItem(
      PREFS_KEY,
      JSON.stringify({
        emailUpdates,
        orderAlerts,
      })
    );

    setSaved(
      true
    );

    window.setTimeout(
      () =>
        setSaved(
          false
        ),
      1800
    );
  };

  const savePassword = (
    event:
      FormEvent
  ) => {
    event.preventDefault();

    if (
      newPassword.length <
      6
    ) {
      setPasswordMessage(
        "Use at least 6 characters for your new password."
      );

      return;
    }

    if (
      newPassword !==
      confirmPassword
    ) {
      setPasswordMessage(
        "New passwords do not match."
      );

      return;
    }

    if (
      !changePassword(
        currentPassword,
        newPassword
      )
    ) {
      setPasswordMessage(
        "Password changes are not currently available from this account page."
      );

      return;
    }

    setCurrentPassword(
      ""
    );

    setNewPassword(
      ""
    );

    setConfirmPassword(
      ""
    );

    setPasswordMessage(
      "Password updated successfully."
    );
  };

  if (!user) {
    return (
      <div className="site-card mx-auto max-w-md p-8 text-center">
        <h2 className="text-2xl font-bold text-slate-950">
          Sign in to manage your account
        </h2>

        <p className="mt-3 text-sm leading-7 text-slate-600">
          Your profile,
          preferences,
          orders, and saved
          listings are
          available after you
          sign in.
        </p>

        <button
          type="button"
          onClick={() =>
            openAuth(
              "login"
            )
          }
          className="mt-6 rounded-[10px] bg-accent-400 px-5 py-3 text-sm font-bold text-black"
        >
          Sign in
        </button>
      </div>
    );
  }

  const role =
    backendUser?.role ??
    user.role;

  const universityName =
    backendUser
      ?.university
      ?.name ??
    backendUser
      ?.fallbackUniversityName ??
    user.university
      ?.name ??
    user.fallbackUniversityName ??
    user.campus ??
    "";

  const location =
    backendUser
      ?.university
      ? `${backendUser.university.city}, ${backendUser.university.state}`
      : backendUser
            ?.fallbackCity &&
          backendUser
            ?.fallbackState
        ? `${backendUser.fallbackCity}, ${backendUser.fallbackState}`
        : user.fallbackCity &&
            user.fallbackState
          ? `${user.fallbackCity}, ${user.fallbackState}`
          : "";

  const matricNumber =
    backendUser
      ?.matricNumber ??
    user.matricNumber ??
    "";

  const studentVerificationStatus =
    backendUser
      ?.studentVerificationStatus ??
    user.studentVerificationStatus ??
    "not_started";

  /*
   * The User verification status tells us
   * the overall identity state.
   *
   * When an appeal exists, its more specific
   * lifecycle status should control what the
   * student sees in the verification badge.
   *
   * Once the User is verified, verified wins.
   */
  const verificationDisplayStatus:
    | StudentVerificationStatus
    | VerificationAppealStatus =
      studentVerificationStatus ===
      "verified"
        ? "verified"
        : currentAppeal
            ?.status ??
          studentVerificationStatus;

  const vendorAccessStatus =
    backendUser
      ?.vendorProfile
      ?.accessStatus ??
    user.vendorAccessStatus ??
    null;

  const vendorVerificationStatus =
    backendUser
      ?.vendorProfile
      ?.vendorVerificationStatus ??
    user.vendorVerificationStatus ??
    null;

  const accountStatus:
    VendorAccessStatus =
      "active";

  const memberSince =
    formatDate(
      backendUser?.createdAt
    )?.split(" ")
      .at(-1) ??
    "2026";

  const appealDate =
    formatDate(
      currentAppeal
        ?.submittedAt
    );

  const studentDetailsMissing =
    !backendUser
      ?.universityId &&
    !backendUser
      ?.fallbackUniversityName &&
    !user.universityId &&
    !user.fallbackUniversityName;

  const studentVerified =
    studentVerificationStatus ===
    "verified";

  const universityListed =
    Boolean(
      backendUser
        ?.universityId ??
      user.universityId
    );

  const appealBeingReviewed =
    currentAppeal !== null &&
    currentAppeal.status !==
      "draft" &&
    currentAppeal.status !==
      "more_information_required";

  return (
    <div className="grid gap-6 lg:grid-cols-[0.75fr_1.25fr]">
      <aside className="site-card p-6">
        <div className="flex items-center gap-4">
          <div className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-black text-2xl font-bold text-accent-400">
            {user.avatarUrl ? (
              <Image
                src={
                  user.avatarUrl
                }
                alt=""
                fill
                sizes="64px"
                className="object-cover"
                unoptimized
              />
            ) : (
              (
                backendUser?.name ??
                user.name
              )
                .slice(
                  0,
                  1
                )
                .toUpperCase()
            )}
          </div>

          <div className="min-w-0">
            <h2 className="truncate text-xl font-bold text-slate-950">
              {backendUser?.name ??
                user.name}
            </h2>

            <p className="truncate text-sm text-slate-500">
              {backendUser?.email ??
                user.email}
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-3 text-sm">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <span className="text-slate-500">
              Account type
            </span>

            <span className="font-bold text-slate-950">
              {role ===
              "vendor"
                ? "Vendor"
                : "Buyer"}
            </span>
          </div>

          <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <span className="text-slate-500">
              Account status
            </span>

            <span
              className={`rounded-full border px-2.5 py-1 text-xs font-bold ${statusClass(
                accountStatus
              )}`}
            >
              {statusLabel(
                accountStatus
              )}
            </span>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-slate-500">
              Member since
            </span>

            <span className="font-bold text-slate-950">
              {memberSince}
            </span>
          </div>
        </div>

        {role ===
          "vendor" &&
        vendorAccessStatus ===
          "pending_review" ? (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-bold text-amber-950">
              Seller access
              pending
            </p>

            <p className="mt-1 text-sm leading-6 text-amber-800">
              You can continue
              using CampusMart as
              a buyer while your
              student identity is
              reviewed. Seller
              features will remain
              unavailable until
              your access is
              approved.
            </p>
          </div>
        ) : null}

        <p className="mt-6 rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">
          Your account type is
          fixed. University and
          verification details
          are protected separately
          from ordinary profile
          preferences.
        </p>

        <button
          type="button"
          onClick={() => {
            logout();

            router.push(
              "/"
            );
          }}
          className="mt-5 w-full rounded-[10px] bg-slate-100 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-200"
        >
          Sign out
        </button>
      </aside>

      <div className="space-y-6">
        <section className="site-card p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                Trust & identity
              </p>

              <h2 className="mt-2 text-2xl font-bold text-slate-950">
                Student verification
              </h2>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                CampusMart uses
                your university
                identity to keep
                campus marketplaces
                safer and more
                trustworthy.
              </p>
            </div>

            <span
              className={`rounded-full border px-3 py-1.5 text-xs font-bold ${statusClass(
                verificationDisplayStatus
              )}`}
            >
              {statusLabel(
                verificationDisplayStatus
              )}
            </span>
          </div>

          {accountLoading ? (
            <div className="mt-6 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
              Loading your latest
              verification
              information...
            </div>
          ) : null}

          {accountError ? (
            <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
              {accountError}
            </div>
          ) : null}

          {!accountLoading ? (
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                  University
                </p>

                <p className="mt-2 font-bold text-slate-950">
                  {universityName ||
                    "Not added yet"}
                </p>

                {location ? (
                  <p className="mt-1 text-sm text-slate-500">
                    {location}
                  </p>
                ) : null}
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">
                  Matric number
                </p>

                <p className="mt-2 font-bold text-slate-950">
                  {matricNumber ||
                    "Not provided"}
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  Student records
                  are handled
                  separately from
                  your public
                  profile.
                </p>
              </div>
            </div>
          ) : null}

          {studentVerified ? (
            <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="font-bold text-emerald-950">
                Student identity
                verified
              </p>

              <p className="mt-1 text-sm leading-6 text-emerald-800">
                CampusMart has
                verified your
                student identity.
              </p>

              {backendUser
                ?.studentVerifiedAt ? (
                <p className="mt-2 text-xs font-semibold text-emerald-700">
                  Verified{" "}
                  {formatDate(
                    backendUser
                      .studentVerifiedAt
                  )}
                </p>
              ) : null}
            </div>
          ) : null}

          {appealBeingReviewed &&
          currentAppeal ? (
            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-amber-950">
                    Verification
                    appeal
                  </p>

                  <p className="mt-1 text-sm font-semibold text-amber-900">
                    {appealReasonLabel(
                      currentAppeal.reason
                    )}
                  </p>
                </div>

                <span
                  className={`rounded-full border px-2.5 py-1 text-xs font-bold ${statusClass(
                    currentAppeal.status
                  )}`}
                >
                  {statusLabel(
                    currentAppeal.status
                  )}
                </span>
              </div>

              <div className="mt-4 space-y-2 text-sm leading-6 text-amber-900">
                <p>
                  <span className="font-semibold">
                    University:
                  </span>{" "}
                  {
                    currentAppeal
                      .submittedUniversityName
                  }
                </p>

                {currentAppeal
                  .submittedMatricNumber ? (
                  <p>
                    <span className="font-semibold">
                      Matric:
                    </span>{" "}
                    {
                      currentAppeal
                        .submittedMatricNumber
                    }
                  </p>
                ) : null}

                {appealDate ? (
                  <p>
                    <span className="font-semibold">
                      Submitted:
                    </span>{" "}
                    {
                      appealDate
                    }
                  </p>
                ) : null}

                <p>
                  <span className="font-semibold">
                    Evidence:
                  </span>{" "}
                  {
                    currentAppeal
                      .evidence
                      .length
                  }{" "}
                  file
                  {currentAppeal
                    .evidence
                    .length ===
                  1
                    ? ""
                    : "s"}
                </p>
              </div>

              {currentAppeal
                .explanation ? (
                <p className="mt-4 rounded-lg bg-white/70 p-3 text-sm leading-6 text-amber-900">
                  {
                    currentAppeal
                      .explanation
                  }
                </p>
              ) : null}

              <p className="mt-4 text-sm leading-6 text-amber-800">
                Reviews may take
                up to 5 working
                days. You do not
                need to submit
                another appeal
                while this one is
                open.
              </p>
            </div>
          ) : null}

          {!accountLoading &&
          !studentVerified ? (
            <div className="mt-5">
              <VerificationAppealFlow
                appeal={
                  currentAppeal
                }
                universityName={
                  universityName
                }
                universityListed={
                  universityListed
                }
                studentDetailsMissing={
                  studentDetailsMissing
                }
                studentVerified={
                  studentVerified
                }
                onAppealChanged={
                  setCurrentAppeal
                }
                onSubmitted={() =>
                  setRefreshVersion(
                    (
                      value
                    ) =>
                      value +
                      1
                  )
                }
              />
            </div>
          ) : null}
        </section>

        {role ===
        "vendor" ? (
          <section className="site-card p-6 sm:p-8">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                Seller trust
              </p>

              <h2 className="mt-2 text-2xl font-bold text-slate-950">
                Seller status
              </h2>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-slate-950">
                      Seller access
                    </p>

                    <p className="mt-1 text-sm leading-6 text-slate-500">
                      Controls whether
                      you can list and
                      sell products.
                    </p>
                  </div>

                  <span
                    className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-bold ${statusClass(
                      vendorAccessStatus
                    )}`}
                  >
                    {statusLabel(
                      vendorAccessStatus
                    )}
                  </span>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-slate-950">
                      Vendor
                      verification
                    </p>

                    <p className="mt-1 text-sm leading-6 text-slate-500">
                      Stronger identity
                      review for the
                      Verified Vendor
                      badge.
                    </p>
                  </div>

                  <span
                    className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-bold ${statusClass(
                      vendorVerificationStatus
                    )}`}
                  >
                    {statusLabel(
                      vendorVerificationStatus
                    )}
                  </span>
                </div>
              </div>
            </div>

            <p className="mt-4 text-xs leading-5 text-slate-500">
              Student verification
              and vendor verification
              are separate. Being a
              verified student does
              not automatically award
              the Verified Vendor
              badge.
            </p>
          </section>
        ) : null}

        <form
          onSubmit={save}
          className="site-card space-y-6 p-6 sm:p-8"
        >
          <div>
            <h2 className="text-2xl font-bold text-slate-950">
              {title}
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              {description}
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <label className="text-sm font-semibold text-slate-700">
              Full name

              <input
                value={name}
                onChange={(
                  event
                ) =>
                  setName(
                    event.target
                      .value
                  )
                }
                className="mt-2 w-full rounded-[10px] border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-black focus:bg-white"
              />
            </label>

            <label className="text-sm font-semibold text-slate-700">
              Email address

              <input
                value={
                  backendUser?.email ??
                  user.email
                }
                readOnly
                className="mt-2 w-full cursor-not-allowed rounded-[10px] border border-slate-200 bg-slate-100 px-4 py-3 text-slate-500"
              />
            </label>

            <label className="text-sm font-semibold text-slate-700">
              Upload profile
              picture

              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(
                  event
                ) => {
                  const file =
                    event.target
                      .files?.[0];

                  if (!file) {
                    return;
                  }

                  const reader =
                    new FileReader();

                  reader.onload =
                    () =>
                      setAvatarUrl(
                        String(
                          reader.result
                        )
                      );

                  reader.readAsDataURL(
                    file
                  );
                }}
                className="mt-2 block w-full rounded-[10px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
              />
            </label>

            <label className="text-sm font-semibold text-slate-700">
              Profile picture
              URL

              <input
                type="url"
                value={
                  avatarUrl.startsWith(
                    "data:"
                  )
                    ? ""
                    : avatarUrl
                }
                onChange={(
                  event
                ) =>
                  setAvatarUrl(
                    event.target
                      .value
                  )
                }
                className="mt-2 w-full rounded-[10px] border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-black focus:bg-white"
                placeholder="https://..."
              />
            </label>

            <label className="text-sm font-semibold text-slate-700">
              University

              <input
                value={
                  universityName
                }
                readOnly
                className="mt-2 w-full cursor-not-allowed rounded-[10px] border border-slate-200 bg-slate-100 px-4 py-3 text-slate-500"
                placeholder="Not added yet"
              />

              <span className="mt-1.5 block text-xs font-normal leading-5 text-slate-500">
                University
                identity is managed
                through student
                verification.
              </span>
            </label>

            <label className="text-sm font-semibold text-slate-700">
              Phone number

              <input
                value={phone}
                onChange={(
                  event
                ) =>
                  setPhone(
                    event.target
                      .value
                  )
                }
                className="mt-2 w-full rounded-[10px] border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-black focus:bg-white"
                placeholder="0800 000 0000"
              />
            </label>
          </div>

          <label className="block text-sm font-semibold text-slate-700">
            About you

            <textarea
              rows={4}
              value={bio}
              onChange={(
                event
              ) =>
                setBio(
                  event.target
                    .value
                )
              }
              className="mt-2 w-full resize-y rounded-[10px] border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-black focus:bg-white"
              placeholder="A short introduction for your profile."
            />
          </label>

          {role ===
          "vendor" ? (
            <div className="space-y-4 border-t border-slate-200 pt-6">
              <div>
                <h3 className="font-bold text-slate-950">
                  Shop details
                </h3>

                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Your existing
                  seller information
                  is loaded from your
                  CampusMart seller
                  profile.
                </p>
              </div>

              <label className="block text-sm font-semibold text-slate-700">
                Shop or business
                name

                <input
                  value={
                    businessName
                  }
                  onChange={(
                    event
                  ) =>
                    setBusinessName(
                      event.target
                        .value
                    )
                  }
                  className="mt-2 w-full rounded-[10px] border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-black focus:bg-white"
                />
              </label>

              <label className="block text-sm font-semibold text-slate-700">
                What do you sell?

                <textarea
                  rows={3}
                  value={
                    businessDescription
                  }
                  onChange={(
                    event
                  ) =>
                    setBusinessDescription(
                      event.target
                        .value
                    )
                  }
                  className="mt-2 w-full resize-y rounded-[10px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-black focus:bg-white"
                />
              </label>

              <label className="block text-sm font-semibold text-slate-700">
                Usual campus pickup
                point

                <input
                  value={
                    pickupLocation
                  }
                  onChange={(
                    event
                  ) =>
                    setPickupLocation(
                      event.target
                        .value
                    )
                  }
                  className="mt-2 w-full rounded-[10px] border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-black focus:bg-white"
                />
              </label>
            </div>
          ) : null}

          <div className="border-t border-slate-200 pt-6">
            <h3 className="font-bold text-slate-950">
              Notifications
            </h3>

            <div className="mt-4 space-y-3">
              <label className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 p-4 text-sm">
                <span>
                  <span className="block font-bold text-slate-950">
                    Email updates
                  </span>

                  <span className="mt-1 block text-slate-500">
                    Product news
                    and account
                    updates
                  </span>
                </span>

                <input
                  type="checkbox"
                  checked={
                    emailUpdates
                  }
                  onChange={(
                    event
                  ) =>
                    setEmailUpdates(
                      event.target
                        .checked
                    )
                  }
                  className="h-5 w-5 accent-black"
                />
              </label>

              <label className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 p-4 text-sm">
                <span>
                  <span className="block font-bold text-slate-950">
                    Order alerts
                  </span>

                  <span className="mt-1 block text-slate-500">
                    Updates about
                    purchases and
                    fulfilment
                  </span>
                </span>

                <input
                  type="checkbox"
                  checked={
                    orderAlerts
                  }
                  onChange={(
                    event
                  ) =>
                    setOrderAlerts(
                      event.target
                        .checked
                    )
                  }
                  className="h-5 w-5 accent-black"
                />
              </label>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              type="submit"
              className="rounded-[10px] bg-accent-400 px-5 py-3 text-sm font-bold text-black"
            >
              {saved
                ? "Saved"
                : "Save changes"}
            </button>

            {saved ? (
              <span className="text-sm font-semibold text-emerald-700">
                Your account is
                up to date.
              </span>
            ) : null}
          </div>
        </form>

        <form
          onSubmit={
            savePassword
          }
          className="site-card space-y-4 p-6"
        >
          <h2 className="text-lg font-bold text-slate-950">
            Change password
          </h2>

          <div className="grid gap-4 sm:grid-cols-3">
            <input
              type="password"
              required
              value={
                currentPassword
              }
              onChange={(
                event
              ) =>
                setCurrentPassword(
                  event.target
                    .value
                )
              }
              className="rounded-[10px] border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-900"
              placeholder="Current password"
            />

            <input
              type="password"
              required
              value={
                newPassword
              }
              onChange={(
                event
              ) =>
                setNewPassword(
                  event.target
                    .value
                )
              }
              className="rounded-[10px] border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-900"
              placeholder="New password"
            />

            <input
              type="password"
              required
              value={
                confirmPassword
              }
              onChange={(
                event
              ) =>
                setConfirmPassword(
                  event.target
                    .value
                )
              }
              className="rounded-[10px] border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-900"
              placeholder="Confirm password"
            />
          </div>

          {passwordMessage ? (
            <p className="text-sm font-semibold text-slate-600">
              {
                passwordMessage
              }
            </p>
          ) : null}

          <button
            type="submit"
            className="w-fit rounded-[10px] border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-900 hover:bg-slate-50"
          >
            Update password
          </button>
        </form>
      </div>
    </div>
  );
}