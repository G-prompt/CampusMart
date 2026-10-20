"use client";

import Link from "next/link";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import PageShell from "@/components/common/PageShell";

import {
  useAuth,
} from "@/components/common/AuthContext";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:5000";

const benefits = [
  "Sell from the CampusMart account you already use to buy",
  "Build trust through your student identity and university profile",
  "Manage listings, buyer messages and campus handoffs in one place",
];

export default function Page() {
  const router =
    useRouter();

  const {
    user,
    openAuth,
    refreshSession,
  } =
    useAuth();

  const [
    setupOpen,
    setSetupOpen,
  ] =
    useState(false);

  const [
    phone,
    setPhone,
  ] =
    useState("");

  const [
    matricNumber,
    setMatricNumber,
  ] =
    useState("");

  const [
    businessName,
    setBusinessName,
  ] =
    useState("");

  const [
    businessDescription,
    setBusinessDescription,
  ] =
    useState("");

  const [
    pickupLocation,
    setPickupLocation,
  ] =
    useState("");

  const [
    submitting,
    setSubmitting,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    matricFormatHint,
    setMatricFormatHint,
  ] =
    useState<
      string | null
    >(null);

  /*
   * =====================================================
   * PREFILL FROM THE EXISTING ACCOUNT
   * =====================================================
   *
   * A buyer does NOT create another CampusMart account.
   *
   * Existing details are reused and only missing
   * seller-specific information needs to be completed.
   */

  useEffect(() => {
    if (!user) {
      return;
    }

    setPhone(
      user.phone ??
        ""
    );

    setMatricNumber(
      user.matricNumber ??
        ""
    );

    setBusinessName(
      user.businessName ??
        ""
    );

    setBusinessDescription(
      user.businessDescription ??
        ""
    );

    setPickupLocation(
      user.pickupLocation ??
        ""
    );
  }, [
    user?.id,
  ]);

  /*
   * =====================================================
   * ACCOUNT STATE
   * =====================================================
   */

  const hasListedUniversity =
    Boolean(
      user?.universityId &&
      user?.university
    );

  const hasFallbackUniversity =
    Boolean(
      user?.fallbackUniversityName?.trim() &&
      user?.fallbackState?.trim() &&
      user?.fallbackCity?.trim()
    );

  const hasUniversityDetails =
    hasListedUniversity ||
    hasFallbackUniversity;

  const matricRequired =
    hasListedUniversity;

  const universityName =
    user?.university?.name ||
    user?.fallbackUniversityName ||
    "";

  const universityLocation =
    user?.university
      ? [
          user.university.city,
          user.university.state,
        ]
          .filter(Boolean)
          .join(", ")
      : [
          user?.fallbackCity,
          user?.fallbackState,
        ]
          .filter(Boolean)
          .join(", ");

  const studentVerified =
    user?.studentVerificationStatus ===
    "verified";

  /*
   * =====================================================
   * SETUP CHECKLIST
   * =====================================================
   */

  const setupItems =
    useMemo(
      () => [
        {
          label:
            "University details",

          complete:
            hasUniversityDetails,
        },

        {
          label:
            "Student / matric number",

          complete:
            !matricRequired ||
            Boolean(
              matricNumber.trim()
            ),

          optional:
            !matricRequired,
        },

        {
          label:
            "Phone number",

          complete:
            Boolean(
              phone.trim()
            ),
        },

        {
          label:
            "Shop name",

          complete:
            Boolean(
              businessName.trim()
            ),
        },

        {
          label:
            "Shop description",

          complete:
            Boolean(
              businessDescription.trim()
            ),
        },

        {
          label:
            "Pickup location",

          complete:
            Boolean(
              pickupLocation.trim()
            ),
        },
      ],
      [
        hasUniversityDetails,
        matricRequired,
        matricNumber,
        phone,
        businessName,
        businessDescription,
        pickupLocation,
      ]
    );

  const requiredItems =
    setupItems.filter(
      (
        item
      ) =>
        !item.optional
    );

  const completedItems =
    requiredItems.filter(
      (
        item
      ) =>
        item.complete
    ).length;

  const progress =
    requiredItems.length >
    0
      ? Math.round(
          (
            completedItems /
            requiredItems.length
          ) *
            100
        )
      : 0;

  /*
   * =====================================================
   * BECOME A SELLER
   * =====================================================
   */

  const becomeSeller =
    async (
      event:
        FormEvent<HTMLFormElement>
    ) => {
      event.preventDefault();

      if (
        !user ||
        user.role !==
          "client" ||
        submitting
      ) {
        return;
      }

      setError(
        ""
      );

      setMatricFormatHint(
        null
      );

      if (
        !hasUniversityDetails
      ) {
        setError(
          "Complete your university details before setting up your seller account."
        );

        return;
      }

      if (
        matricRequired &&
        !matricNumber.trim()
      ) {
        setError(
          user.university
            ?.shortName
            ? `Enter your ${user.university.shortName} matric number.`
            : "Enter your matric number."
        );

        return;
      }

      if (
        !phone.trim()
      ) {
        setError(
          "Add a phone number for your seller account."
        );

        return;
      }

      if (
        !businessName.trim()
      ) {
        setError(
          "Enter your shop or business name."
        );

        return;
      }

      if (
        !businessDescription.trim()
      ) {
        setError(
          "Tell buyers what you sell."
        );

        return;
      }

      if (
        !pickupLocation.trim()
      ) {
        setError(
          "Add your usual campus pickup location."
        );

        return;
      }

      const token =
        localStorage.getItem(
          "campusmart-token"
        );

      if (!token) {
        setError(
          "Your session is unavailable. Please sign in again."
        );

        return;
      }

      try {
        setSubmitting(
          true
        );

        const response =
          await fetch(
            `${API_URL}/api/vendor/become-seller`,
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
                  phone:
                    phone.trim(),

                  matricNumber:
                    matricNumber.trim(),

                  businessName:
                    businessName.trim(),

                  businessDescription:
                    businessDescription.trim(),

                  pickupLocation:
                    pickupLocation.trim(),
                }),
            }
          );

        const data =
          await response.json();

        if (
          !response.ok ||
          !data.success
        ) {
          if (
            data.matricFormatHint
          ) {
            setMatricFormatHint(
              data.matricFormatHint
            );
          }

          throw new Error(
            data.message ||
              "Unable to set up your seller account."
          );
        }

        /*
         * The backend is the authority for the account
         * role.
         *
         * Never manually change "client" -> "vendor" in
         * localStorage.
         */

        const refreshResult =
          await refreshSession();

        if (
          !refreshResult.success
        ) {
          throw new Error(
            refreshResult.message ||
              "Your seller account was created, but CampusMart could not refresh your session."
          );
        }

        window.dispatchEvent(
          new CustomEvent(
            "campusmart-toast",
            {
              detail: {
                message:
                  "Seller account enabled",
              },
            }
          )
        );

        router.push(
          "/vendor/dashboard"
        );
      } catch (
        setupError
      ) {
        console.error(
          "Become seller error:",
          setupError
        );

        setError(
          setupError instanceof
            Error
            ? setupError.message
            : "Unable to set up your seller account."
        );
      } finally {
        setSubmitting(
          false
        );
      }
    };

  /*
   * =====================================================
   * SIGNED OUT
   * =====================================================
   */

  if (!user) {
    return (
      <PageShell
        title="Sell on CampusMart"
        description="Use one CampusMart account for buying and selling across your university marketplace."
      >
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="site-card p-6 sm:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
              Campus selling
            </p>

            <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-950">
              Turn what you have into
              something another student
              needs
            </h2>

            <div className="mt-6 space-y-3">
              {benefits.map(
                (
                  benefit
                ) => (
                  <div
                    key={
                      benefit
                    }
                    className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-400 text-xs font-black text-black">
                      ✓
                    </span>

                    <p className="text-sm font-semibold leading-6 text-slate-700">
                      {
                        benefit
                      }
                    </p>
                  </div>
                )
              )}
            </div>
          </section>

          <section className="site-card p-6 sm:p-8">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
              Your account
            </p>

            <h2 className="mt-3 text-2xl font-bold text-slate-950">
              Already on CampusMart?
            </h2>

            <p className="mt-3 text-sm leading-7 text-slate-600">
              Sign in first. If you
              already buy on CampusMart,
              you will keep that same
              account and simply add
              seller access to it.
            </p>

            <button
              type="button"
              onClick={() =>
                openAuth(
                  "login",
                  "client"
                )
              }
              className="mt-6 w-full rounded-[10px] bg-slate-950 px-5 py-3 font-bold text-white transition hover:bg-slate-800"
            >
              Sign in
            </button>

            <button
              type="button"
              onClick={() =>
                openAuth(
                  "register",
                  "vendor"
                )
              }
              className="mt-3 w-full rounded-[10px] bg-accent-400 px-5 py-3 font-bold text-black transition hover:bg-accent-500"
            >
              Create my first account
            </button>
          </section>
        </div>
      </PageShell>
    );
  }

  /*
   * =====================================================
   * EXISTING SELLER
   * =====================================================
   */

  if (
    user.role ===
    "vendor"
  ) {
    const active =
      user.vendorAccessStatus ===
      "active";

    return (
      <PageShell
        title="Sell on CampusMart"
        description="Manage your seller account and continue growing your campus shop."
      >
        <section className="site-card max-w-3xl p-6 sm:p-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 font-black text-emerald-700">
            ✓
          </div>

          <p className="mt-5 text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">
            Seller account
          </p>

          <h2 className="mt-2 text-2xl font-bold text-slate-950">
            You&apos;re already a seller
          </h2>

          <p className="mt-3 max-w-xl text-sm leading-7 text-slate-600">
            {active
              ? "Your seller access is active. You can manage your shop or publish another listing."
              : "Your seller account already exists. Open your dashboard to review any remaining setup or verification requirements."}
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/vendor/dashboard"
              className="rounded-[10px] bg-slate-950 px-5 py-3 text-center text-sm font-bold text-white transition hover:bg-slate-800"
            >
              Open seller dashboard
            </Link>

            {active ? (
              <Link
                href="/vendor/add-listing"
                className="rounded-[10px] bg-accent-400 px-5 py-3 text-center text-sm font-bold text-black transition hover:bg-accent-500"
              >
                Add listing
              </Link>
            ) : (
              <Link
                href="/profile"
                className="rounded-[10px] border border-slate-200 bg-white px-5 py-3 text-center text-sm font-bold text-slate-700 transition hover:border-slate-400 hover:text-black"
              >
                Review account
              </Link>
            )}
          </div>
        </section>
      </PageShell>
    );
  }

  /*
   * =====================================================
   * EXISTING BUYER
   * =====================================================
   */

  return (
    <PageShell
      title="Become a seller"
      description="Keep your existing CampusMart account and add the details needed to start selling."
    >
      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        {/*
         * ===============================================
         * ACCOUNT + PROGRESS
         * ===============================================
         */}

        <section className="site-card h-fit p-6 sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
            Your CampusMart account
          </p>

          <h2 className="mt-3 text-2xl font-bold text-slate-950">
            No second account needed
          </h2>

          <p className="mt-3 text-sm leading-7 text-slate-600">
            Your purchases, saved
            listings, messages and
            account history stay on
            this account. We&apos;re only
            adding seller capability.
          </p>

          <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-bold text-slate-950">
              {
                user.name
              }
            </p>

            <p className="mt-1 text-xs text-slate-500">
              {
                user.email
              }
            </p>

            {universityName ? (
              <div className="mt-4 border-t border-slate-200 pt-4">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                  University
                </p>

                <p className="mt-1 text-sm font-bold text-slate-800">
                  {
                    universityName
                  }
                </p>

                {universityLocation ? (
                  <p className="mt-1 text-xs text-slate-500">
                    {
                      universityLocation
                    }
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="mt-6">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm font-bold text-slate-950">
                Seller setup
              </p>

              <p className="text-xs font-bold text-slate-500">
                {
                  completedItems
                }
                /
                {
                  requiredItems.length
                }{" "}
                ready
              </p>
            </div>

            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-accent-400 transition-all"
                style={{
                  width:
                    `${progress}%`,
                }}
              />
            </div>

            <div className="mt-5 space-y-2">
              {setupItems.map(
                (
                  item
                ) => (
                  <div
                    key={
                      item.label
                    }
                    className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-black ${
                          item.complete
                            ? "bg-emerald-100 text-emerald-700"
                            : item.optional
                              ? "bg-slate-100 text-slate-500"
                              : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {item.complete
                          ? "✓"
                          : item.optional
                            ? "–"
                            : "!"}
                      </span>

                      <span className="text-sm font-semibold text-slate-700">
                        {
                          item.label
                        }
                      </span>
                    </div>

                    <span className="text-xs font-semibold text-slate-400">
                      {item.complete
                        ? "Ready"
                        : item.optional
                          ? "Optional"
                          : "Needed"}
                    </span>
                  </div>
                )
              )}
            </div>
          </div>

          <div className="mt-6 rounded-xl bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
              Student verification
            </p>

            <p className="mt-2 text-sm font-bold text-slate-950">
              {studentVerified
                ? "Already verified ✓"
                : "Still required before selling"}
            </p>

            <p className="mt-1 text-xs leading-5 text-slate-500">
              Becoming a seller does
              not fake or bypass student
              verification. If you are
              not verified yet, your
              seller account will remain
              pending until verification
              is completed.
            </p>
          </div>
        </section>

        {/*
         * ===============================================
         * SELLER ONBOARDING
         * ===============================================
         */}

        <section className="site-card p-6 sm:p-8">
          {!setupOpen ? (
            <>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                Start selling
              </p>

              <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-950">
                Add seller access to
                your account
              </h2>

              <p className="mt-3 text-sm leading-7 text-slate-600">
                CampusMart will reuse
                the account information
                you already provided and
                ask only for the extra
                details needed for your
                shop.
              </p>

              {!hasUniversityDetails ? (
                <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm font-bold text-amber-950">
                    University details
                    needed first
                  </p>

                  <p className="mt-1 text-xs leading-5 text-amber-800">
                    Add your university
                    information before
                    starting seller
                    setup.
                  </p>

                  <Link
                    href="/profile"
                    className="mt-4 inline-flex rounded-[10px] bg-accent-400 px-4 py-2.5 text-sm font-bold text-black"
                  >
                    Complete account
                  </Link>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    setSetupOpen(
                      true
                    )
                  }
                  className="mt-6 w-full rounded-[10px] bg-accent-400 px-5 py-3.5 text-base font-bold text-black transition hover:bg-accent-500"
                >
                  Become a seller
                </button>
              )}

              <div className="mt-8 space-y-3 border-t border-slate-200 pt-6">
                {benefits.map(
                  (
                    benefit
                  ) => (
                    <div
                      key={
                        benefit
                      }
                      className="flex items-start gap-3"
                    >
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-950 text-[10px] font-black text-white">
                        ✓
                      </span>

                      <p className="text-sm leading-6 text-slate-600">
                        {
                          benefit
                        }
                      </p>
                    </div>
                  )
                )}
              </div>
            </>
          ) : (
            <form
              onSubmit={
                becomeSeller
              }
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                    Seller setup
                  </p>

                  <h2 className="mt-2 text-2xl font-bold text-slate-950">
                    Finish your shop
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Complete the missing
                    information below.
                  </p>
                </div>

                <button
                  type="button"
                  disabled={
                    submitting
                  }
                  onClick={() => {
                    setSetupOpen(
                      false
                    );

                    setError(
                      ""
                    );
                  }}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xl font-bold text-slate-400 transition hover:bg-slate-100 hover:text-black"
                  aria-label="Close seller setup"
                >
                  ×
                </button>
              </div>

              <div className="mt-6 space-y-5">
                {/*
                 * PHONE
                 */}

                <label className="block text-sm font-semibold text-slate-700">
                  Phone number

                  {user.phone ? (
                    <span className="ml-2 text-xs font-normal text-emerald-600">
                      Already on account
                    </span>
                  ) : null}

                  <input
                    type="tel"
                    required
                    value={
                      phone
                    }
                    onChange={(
                      event
                    ) =>
                      setPhone(
                        event.target.value
                      )
                    }
                    className="mt-2 w-full rounded-[10px] border border-slate-200 bg-slate-50 px-4 py-3 text-slate-950 outline-none transition focus:border-black focus:bg-white"
                    placeholder="+234..."
                  />
                </label>

                {/*
                 * MATRIC
                 */}

                {hasListedUniversity ? (
                  <label className="block text-sm font-semibold text-slate-700">
                    {
                      user.university
                        ?.shortName
                    }{" "}
                    matric number

                    {user.matricNumber ? (
                      <span className="ml-2 text-xs font-normal text-emerald-600">
                        Already on account
                      </span>
                    ) : (
                      <span className="ml-2 text-xs font-normal text-amber-600">
                        Required for selling
                      </span>
                    )}

                    <input
                      type="text"
                      required
                      readOnly={
                        Boolean(
                          user.matricNumber
                        )
                      }
                      value={
                        matricNumber
                      }
                      onChange={(
                        event
                      ) => {
                        setMatricNumber(
                          event.target.value
                        );

                        setError(
                          ""
                        );
                      }}
                      className={`mt-2 w-full rounded-[10px] border border-slate-200 px-4 py-3 uppercase text-slate-950 outline-none transition ${
                        user.matricNumber
                          ? "cursor-not-allowed bg-slate-100 text-slate-500"
                          : "bg-slate-50 focus:border-black focus:bg-white"
                      }`}
                      placeholder="Enter your matric number"
                    />

                    {matricFormatHint ? (
                      <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
                        <p className="text-xs font-bold text-amber-900">
                          Expected format
                        </p>

                        <p className="mt-1 font-mono text-sm font-bold text-amber-950">
                          {
                            matricFormatHint
                          }
                        </p>
                      </div>
                    ) : null}
                  </label>
                ) : null}

                <div className="border-t border-slate-200 pt-5">
                  <p className="text-sm font-bold text-slate-950">
                    Your shop
                  </p>

                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    These details help
                    buyers understand
                    what you sell.
                  </p>
                </div>

                <label className="block text-sm font-semibold text-slate-700">
                  Shop or business name

                  <input
                    type="text"
                    required
                    value={
                      businessName
                    }
                    onChange={(
                      event
                    ) =>
                      setBusinessName(
                        event.target.value
                      )
                    }
                    className="mt-2 w-full rounded-[10px] border border-slate-200 bg-slate-50 px-4 py-3 text-slate-950 outline-none transition focus:border-black focus:bg-white"
                    placeholder="Tunde's Tech Store"
                  />
                </label>

                <label className="block text-sm font-semibold text-slate-700">
                  What do you sell?

                  <textarea
                    required
                    rows={
                      4
                    }
                    value={
                      businessDescription
                    }
                    onChange={(
                      event
                    ) =>
                      setBusinessDescription(
                        event.target.value
                      )
                    }
                    className="mt-2 w-full resize-y rounded-[10px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-950 outline-none transition focus:border-black focus:bg-white"
                    placeholder="Phones, accessories, books, food, services..."
                  />
                </label>

                <label className="block text-sm font-semibold text-slate-700">
                  Usual campus pickup
                  point

                  <input
                    type="text"
                    required
                    value={
                      pickupLocation
                    }
                    onChange={(
                      event
                    ) =>
                      setPickupLocation(
                        event.target.value
                      )
                    }
                    className="mt-2 w-full rounded-[10px] border border-slate-200 bg-slate-50 px-4 py-3 text-slate-950 outline-none transition focus:border-black focus:bg-white"
                    placeholder="Hostel B, Main Campus"
                  />
                </label>
              </div>

              {!studentVerified ? (
                <div className="mt-6 rounded-xl border border-blue-200 bg-blue-50 p-4">
                  <p className="text-sm font-bold text-blue-950">
                    Verification comes
                    next
                  </p>

                  <p className="mt-1 text-xs leading-5 text-blue-800">
                    Your seller profile
                    can be created now,
                    but publishing
                    listings stays
                    unavailable until
                    your student identity
                    is verified.
                  </p>
                </div>
              ) : (
                <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-sm font-bold text-emerald-950">
                    Student identity
                    already verified
                  </p>

                  <p className="mt-1 text-xs leading-5 text-emerald-800">
                    CampusMart will
                    reuse your existing
                    verification when
                    activating your
                    seller account.
                  </p>
                </div>
              )}

              {error ? (
                <div
                  role="alert"
                  className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold leading-6 text-red-700"
                >
                  {
                    error
                  }
                </div>
              ) : null}

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <button
                  type="submit"
                  disabled={
                    submitting
                  }
                  className="flex-1 rounded-[10px] bg-accent-400 px-5 py-3.5 text-sm font-bold text-black transition hover:bg-accent-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting
                    ? "Setting up seller account..."
                    : "Enable seller account"}
                </button>

                <button
                  type="button"
                  disabled={
                    submitting
                  }
                  onClick={() => {
                    setSetupOpen(
                      false
                    );

                    setError(
                      ""
                    );
                  }}
                  className="rounded-[10px] border border-slate-200 bg-white px-5 py-3.5 text-sm font-bold text-slate-700 transition hover:border-slate-400 hover:text-black disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </section>
      </div>
    </PageShell>
  );
}