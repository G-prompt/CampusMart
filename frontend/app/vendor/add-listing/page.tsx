"use client";

import Link from "next/link";

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

import PageShell from "@/components/common/PageShell";

import {
  useAuth,
} from "@/components/common/AuthContext";

import {
  categories,
} from "@/lib/products";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:5000";

type SellerRequirement = {
  key:
    | "vendor_account"
    | "university_details"
    | "matric_number"
    | "student_verification"
    | "seller_profile"
    | "seller_access";

  label:
    string;

  complete:
    boolean;

  required:
    boolean;
};

type SellerNextAction =
  | "not_a_seller"
  | "complete_university_details"
  | "add_matric_number"
  | "verify_student_identity"
  | "complete_seller_profile"
  | "seller_access_pending"
  | "seller_access_restricted"
  | "seller_access_suspended"
  | "ready_to_sell";

type SellerEligibility = {
  userId:
    string;

  isVendor:
    boolean;

  canSell:
    boolean;

  nextRequiredAction:
    SellerNextAction;

  message:
    string;

  studentVerified:
    boolean;

  sellerProfile: {
    exists:
      boolean;

    complete:
      boolean;

    accessStatus:
      | "active"
      | "pending_review"
      | "restricted"
      | "suspended"
      | null;
  };

  requirements:
    SellerRequirement[];
};

function getSetupAction(
  action:
    SellerNextAction
) {
  switch (action) {
    case "complete_university_details":
      return {
        title:
          "Add your university details",

        description:
          "CampusMart needs your university information before you can start selling.",

        buttonLabel:
          "Add university details",

        href:
          "/profile",
      };

    case "add_matric_number":
      return {
        title:
          "Add your matric number",

        description:
          "Add your student number so CampusMart can verify your university identity.",

        buttonLabel:
          "Add matric number",

        href:
          "/profile",
      };

    case "verify_student_identity":
      return {
        title:
          "Verify your student identity",

        description:
          "Student verification is required before you can publish listings on CampusMart.",

        buttonLabel:
          "Complete verification",

        href:
          "/profile",
      };

    case "complete_seller_profile":
      return {
        title:
          "Complete your seller profile",

        description:
          "Finish adding your shop information and pickup details before publishing products.",

        buttonLabel:
          "Complete seller profile",

        href:
          "/profile",
      };

    case "seller_access_pending":
      return {
        title:
          "Seller access is not active yet",

        description:
          "Your seller account is still being prepared for marketplace access.",

        buttonLabel:
          "Review account",

        href:
          "/profile",
      };

    case "seller_access_restricted":
      return {
        title:
          "Seller access restricted",

        description:
          "Your seller access is currently restricted. You cannot publish or modify listings.",

        buttonLabel:
          "Review account",

        href:
          "/profile",
      };

    case "seller_access_suspended":
      return {
        title:
          "Seller access suspended",

        description:
          "Your seller account is currently suspended and cannot publish listings.",

        buttonLabel:
          "Review account",

        href:
          "/profile",
      };

    default:
      return {
        title:
          "Complete seller setup",

        description:
          "Finish the required seller setup before publishing products.",

        buttonLabel:
          "Complete setup",

        href:
          "/profile",
      };
  }
}

export default function Page() {
  const router =
    useRouter();

  const {
    user,
    openAuth,
  } =
    useAuth();

  const [
    eligibility,
    setEligibility,
  ] =
    useState<
      SellerEligibility | null
    >(
      null
    );

  const [
    checkingEligibility,
    setCheckingEligibility,
  ] =
    useState(
      true
    );

  const [
    eligibilityError,
    setEligibilityError,
  ] =
    useState(
      ""
    );

  const [
    title,
    setTitle,
  ] =
    useState(
      ""
    );

  const [
    category,
    setCategory,
  ] =
    useState(
      "Technology"
    );

  const [
    price,
    setPrice,
  ] =
    useState(
      ""
    );

  const [
    description,
    setDescription,
  ] =
    useState(
      ""
    );

  const [
    imageFile,
    setImageFile,
  ] =
    useState<
      File | null
    >(
      null
    );

  const [
    imageUrl,
    setImageUrl,
  ] =
    useState(
      ""
    );

  const [
    previewUrl,
    setPreviewUrl,
  ] =
    useState(
      ""
    );

  const [
    error,
    setError,
  ] =
    useState(
      ""
    );

  const [
    publishing,
    setPublishing,
  ] =
    useState(
      false
    );

  /*
   * =====================================================
   * SELLER ELIGIBILITY
   * =====================================================
   */

  useEffect(() => {
    if (
      user?.role !==
      "vendor"
    ) {
      setEligibility(
        null
      );

      setCheckingEligibility(
        false
      );

      return;
    }

    const controller =
      new AbortController();

    const checkEligibility =
      async () => {
        try {
          setCheckingEligibility(
            true
          );

          setEligibilityError(
            ""
          );

          const token =
            localStorage.getItem(
              "campusmart-token"
            );

          if (!token) {
            throw new Error(
              "Your session could not be verified. Please sign in again."
            );
          }

          const response =
            await fetch(
              `${API_URL}/api/vendor/eligibility`,
              {
                headers: {
                  Authorization:
                    `Bearer ${token}`,
                },

                signal:
                  controller.signal,

                cache:
                  "no-store",
              }
            );

          const data =
            await response.json();

          if (
            !response.ok ||
            !data.success
          ) {
            throw new Error(
              data.message ||
                "Unable to check seller access."
            );
          }

          setEligibility(
            data.eligibility
          );
        } catch (
          eligibilityRequestError
        ) {
          if (
            eligibilityRequestError instanceof
              DOMException &&
            eligibilityRequestError.name ===
              "AbortError"
          ) {
            return;
          }

          console.error(
            "Seller eligibility check error:",
            eligibilityRequestError
          );

          setEligibilityError(
            eligibilityRequestError instanceof
              Error
              ? eligibilityRequestError.message
              : "Unable to check seller access."
          );
        } finally {
          setCheckingEligibility(
            false
          );
        }
      };

    void checkEligibility();

    return () => {
      controller.abort();
    };
  }, [
    user,
  ]);

  /*
   * =====================================================
   * IMAGE PREVIEW
   * =====================================================
   */

  useEffect(() => {
    if (!imageFile) {
      setPreviewUrl(
        ""
      );

      return;
    }

    const objectUrl =
      URL.createObjectURL(
        imageFile
      );

    setPreviewUrl(
      objectUrl
    );

    return () => {
      URL.revokeObjectURL(
        objectUrl
      );
    };
  }, [
    imageFile,
  ]);

  /*
   * =====================================================
   * PUBLISH LISTING
   * =====================================================
   */

  const submit =
    async (
      event:
        FormEvent
    ) => {
      event.preventDefault();

      setError(
        ""
      );

      if (
        user?.role !==
        "vendor"
      ) {
        setError(
          "Sign in with a seller account to publish a listing."
        );

        return;
      }

      /*
       * Frontend convenience check.
       *
       * Backend requireSellerEligibility is still the
       * authoritative security control.
       */
      if (
        !eligibility?.canSell
      ) {
        setError(
          eligibility?.message ||
            "Complete your seller setup before publishing listings."
        );

        return;
      }

      const numericPrice =
        Number(
          price
        );

      if (
        !title.trim() ||
        !description.trim() ||
        !Number.isFinite(
          numericPrice
        ) ||
        numericPrice <=
          0
      ) {
        setError(
          "Add a title, description, and valid price before publishing."
        );

        return;
      }

      const token =
        localStorage.getItem(
          "campusmart-token"
        );

      if (!token) {
        setError(
          "Your session could not be verified. Please sign in again."
        );

        return;
      }

      try {
        setPublishing(
          true
        );

        const formData =
          new FormData();

        formData.append(
          "title",
          title.trim()
        );

        formData.append(
          "category",
          category
        );

        formData.append(
          "price",
          String(
            numericPrice
          )
        );

        formData.append(
          "description",
          description.trim()
        );

        if (
          imageFile
        ) {
          formData.append(
            "images",
            imageFile
          );
        }

        if (
          imageUrl.trim()
        ) {
          formData.append(
            "imageUrl",
            imageUrl.trim()
          );
        }

        const response =
          await fetch(
            `${API_URL}/api/products`,
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
          /*
           * If eligibility changed since the page loaded,
           * use the authoritative state returned by the
           * backend where available.
           */
          if (
            data.eligibility
          ) {
            setEligibility(
              data.eligibility
            );
          }

          throw new Error(
            data.message ||
              "Unable to publish listing."
          );
        }

        router.push(
          `/marketplace/products/${data.product.id}`
        );
      } catch (
        publishError
      ) {
        console.error(
          "Publish listing error:",
          publishError
        );

        setError(
          publishError instanceof
            Error
            ? publishError.message
            : "Unable to publish listing."
        );
      } finally {
        setPublishing(
          false
        );
      }
    };

  /*
   * =====================================================
   * NON-SELLER
   * =====================================================
   */

  if (
    user?.role !==
    "vendor"
  ) {
    return (
      <PageShell
        title="Add listing"
        description="Create a detailed product or service listing for campus buyers."
      >
        <div className="site-card max-w-xl p-6 text-center sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
            Seller access
          </p>

          <h2 className="mt-3 text-2xl font-bold text-slate-950">
            Seller account required
          </h2>

          <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-slate-600">
            You need to sign in
            with a seller account
            before you can publish
            products on CampusMart.
          </p>

          <button
            type="button"
            onClick={() =>
              openAuth(
                "login",
                "vendor"
              )
            }
            className="mt-6 rounded-[10px] bg-accent-400 px-5 py-3 text-sm font-bold text-black transition hover:bg-accent-500"
          >
            Sign in as seller
          </button>
        </div>
      </PageShell>
    );
  }

  /*
   * =====================================================
   * CHECKING ACCESS
   * =====================================================
   */

  if (
    checkingEligibility
  ) {
    return (
      <PageShell
        title="Add listing"
        description="Create a detailed product or service listing for campus buyers."
      >
        <div className="site-card max-w-3xl p-6 sm:p-8">
          <div className="animate-pulse space-y-4">
            <div className="h-4 w-32 rounded bg-slate-200" />

            <div className="h-8 w-72 max-w-full rounded bg-slate-200" />

            <div className="h-4 w-full max-w-lg rounded bg-slate-100" />

            <div className="h-4 w-4/5 max-w-md rounded bg-slate-100" />
          </div>

          <p className="mt-6 text-sm font-semibold text-slate-500">
            Checking seller access...
          </p>
        </div>
      </PageShell>
    );
  }

  /*
   * =====================================================
   * ELIGIBILITY ERROR
   * =====================================================
   */

  if (
    eligibilityError
  ) {
    return (
      <PageShell
        title="Add listing"
        description="Create a detailed product or service listing for campus buyers."
      >
        <div className="site-card max-w-2xl p-6 sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-red-600">
            Seller access
          </p>

          <h2 className="mt-3 text-2xl font-bold text-slate-950">
            We couldn&apos;t check
            your seller access
          </h2>

          <p className="mt-3 text-sm leading-7 text-slate-600">
            {
              eligibilityError
            }
          </p>

          <button
            type="button"
            onClick={() =>
              window.location.reload()
            }
            className="mt-6 rounded-[10px] bg-accent-400 px-5 py-3 text-sm font-bold text-black transition hover:bg-accent-500"
          >
            Try again
          </button>
        </div>
      </PageShell>
    );
  }

  /*
   * =====================================================
   * INCOMPLETE / BLOCKED SELLER
   * =====================================================
   */

  if (
    eligibility &&
    !eligibility.canSell
  ) {
    const action =
      getSetupAction(
        eligibility.nextRequiredAction
      );

    const requiredSteps =
      eligibility.requirements.filter(
        (
          requirement
        ) =>
          requirement.required
      );

    const completedSteps =
      requiredSteps.filter(
        (
          requirement
        ) =>
          requirement.complete
      ).length;

    const progress =
      requiredSteps.length >
      0
        ? Math.round(
            (
              completedSteps /
              requiredSteps.length
            ) *
              100
          )
        : 0;

    const dangerState =
      eligibility.nextRequiredAction ===
        "seller_access_restricted" ||
      eligibility.nextRequiredAction ===
        "seller_access_suspended";

    return (
      <PageShell
        title="Add listing"
        description="Create a detailed product or service listing for campus buyers."
      >
        <div className="max-w-3xl space-y-5">
          <section
            className={`rounded-2xl border p-6 sm:p-8 ${
              dangerState
                ? "border-red-200 bg-red-50"
                : "border-amber-200 bg-amber-50"
            }`}
          >
            <p
              className={`text-xs font-bold uppercase tracking-[0.2em] ${
                dangerState
                  ? "text-red-700"
                  : "text-amber-700"
              }`}
            >
              Seller setup required
            </p>

            <h2
              className={`mt-3 text-2xl font-bold tracking-tight sm:text-3xl ${
                dangerState
                  ? "text-red-950"
                  : "text-amber-950"
              }`}
            >
              {
                action.title
              }
            </h2>

            <p
              className={`mt-3 max-w-xl text-sm leading-7 ${
                dangerState
                  ? "text-red-800"
                  : "text-amber-800"
              }`}
            >
              {
                eligibility.message
              }
            </p>

            {!dangerState ? (
              <div className="mt-6">
                <div className="flex items-center justify-between gap-4 text-xs font-semibold text-slate-600">
                  <span>
                    Seller setup
                  </span>

                  <span>
                    {
                      completedSteps
                    }
                    /
                    {
                      requiredSteps.length
                    }{" "}
                    complete
                  </span>
                </div>

                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
                  <div
                    className="h-full rounded-full bg-accent-400 transition-all"
                    style={{
                      width:
                        `${progress}%`,
                    }}
                  />
                </div>
              </div>
            ) : null}

            <Link
              href={
                action.href
              }
              className={`mt-6 inline-flex rounded-[10px] px-5 py-3 text-sm font-bold transition ${
                dangerState
                  ? "border border-red-200 bg-white text-red-800 hover:border-red-400"
                  : "bg-accent-400 text-black hover:bg-accent-500"
              }`}
            >
              {
                action.buttonLabel
              }
            </Link>
          </section>

          <section className="site-card p-6 sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                  Requirements
                </p>

                <h3 className="mt-2 text-xl font-bold text-slate-950">
                  Before you can
                  publish
                </h3>
              </div>

              <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600">
                {
                  completedSteps
                }
                /
                {
                  requiredSteps.length
                }
              </span>
            </div>

            <div className="mt-5 space-y-3">
              {eligibility.requirements.map(
                (
                  requirement
                ) => (
                  <div
                    key={
                      requirement.key
                    }
                    className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black ${
                          requirement.complete
                            ? "bg-emerald-100 text-emerald-700"
                            : !requirement.required
                              ? "bg-slate-200 text-slate-500"
                              : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {requirement.complete
                          ? "✓"
                          : !requirement.required
                            ? "–"
                            : "!"}
                      </span>

                      <p className="truncate text-sm font-semibold text-slate-900">
                        {
                          requirement.label
                        }
                      </p>
                    </div>

                    <span className="shrink-0 text-xs font-semibold text-slate-500">
                      {requirement.complete
                        ? "Complete"
                        : !requirement.required
                          ? "Not required"
                          : "Required"}
                    </span>
                  </div>
                )
              )}
            </div>

            <p className="mt-5 text-xs leading-6 text-slate-500">
              You can continue
              browsing and buying on
              CampusMart while your
              seller setup is
              incomplete.
            </p>
          </section>
        </div>
      </PageShell>
    );
  }

  /*
   * =====================================================
   * ELIGIBLE SELLER — NORMAL LISTING FORM
   * =====================================================
   */

  const displayPreview =
    previewUrl ||
    imageUrl.trim();

  return (
    <PageShell
      title="Add listing"
      description="Create a detailed product or service listing for campus buyers."
    >
      <div className="mb-5 max-w-3xl rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-black text-emerald-700">
            ✓
          </span>

          <div>
            <p className="text-sm font-bold text-emerald-950">
              Seller access active
            </p>

            <p className="mt-0.5 text-xs leading-5 text-emerald-700">
              Your account is eligible
              to publish listings.
            </p>
          </div>
        </div>
      </div>

      <form
        onSubmit={
          submit
        }
        className="site-card max-w-3xl space-y-5 p-6 sm:p-8"
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="text-sm font-semibold text-slate-700">
            Product or service name

            <input
              required
              value={
                title
              }
              onChange={(
                event
              ) =>
                setTitle(
                  event.target.value
                )
              }
              className="mt-2 w-full rounded-[10px] border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-black focus:bg-white"
              placeholder="e.g. Calculus revision pack"
            />
          </label>

          <label className="text-sm font-semibold text-slate-700">
            Category

            <select
              value={
                category
              }
              onChange={(
                event
              ) =>
                setCategory(
                  event.target.value
                )
              }
              className="mt-2 w-full rounded-[10px] border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-black focus:bg-white"
            >
              {categories
                .filter(
                  (
                    item
                  ) =>
                    item !==
                    "All"
                )
                .map(
                  (
                    item
                  ) => (
                    <option
                      key={
                        item
                      }
                      value={
                        item
                      }
                    >
                      {
                        item
                      }
                    </option>
                  )
                )}
            </select>
          </label>
        </div>

        <label className="block text-sm font-semibold text-slate-700">
          Price in naira

          <input
            required
            type="number"
            min="1"
            value={
              price
            }
            onChange={(
              event
            ) =>
              setPrice(
                event.target.value
              )
            }
            className="mt-2 w-full rounded-[10px] border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-black focus:bg-white"
            placeholder="15000"
          />
        </label>

        <label className="block text-sm font-semibold text-slate-700">
          Description

          <textarea
            required
            rows={
              6
            }
            value={
              description
            }
            onChange={(
              event
            ) =>
              setDescription(
                event.target.value
              )
            }
            className="mt-2 w-full resize-y rounded-[10px] border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-black focus:bg-white"
            placeholder="Describe condition, what is included, delivery or pickup details, and anything buyers should know."
          />
        </label>

        <div className="space-y-4">
          <label className="block text-sm font-semibold text-slate-700">
            Upload product picture

            <span className="ml-1 font-normal text-slate-500">
              (optional)
            </span>

            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              onChange={(
                event
              ) => {
                const file =
                  event.target
                    .files?.[0] ??
                  null;

                setImageFile(
                  file
                );

                if (file) {
                  setImageUrl(
                    ""
                  );
                }
              }}
              className="mt-2 block w-full rounded-[10px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
            />

            <span className="mt-1 block text-xs font-normal text-slate-500">
              JPG, PNG, WebP or
              AVIF. Maximum 5 MB.
            </span>
          </label>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200" />

            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              or
            </span>

            <div className="h-px flex-1 bg-slate-200" />
          </div>

          <label className="block text-sm font-semibold text-slate-700">
            Product image URL

            <span className="ml-1 font-normal text-slate-500">
              (optional)
            </span>

            <input
              type="url"
              value={
                imageUrl
              }
              disabled={
                Boolean(
                  imageFile
                )
              }
              onChange={(
                event
              ) =>
                setImageUrl(
                  event.target.value
                )
              }
              className="mt-2 w-full rounded-[10px] border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none disabled:cursor-not-allowed disabled:opacity-50 focus:border-black focus:bg-white"
              placeholder="https://..."
            />
          </label>

          {displayPreview ? (
            <div className="overflow-hidden rounded-[10px] border border-slate-200 bg-slate-100">
              <img
                src={
                  displayPreview
                }
                alt="Product preview"
                className="h-56 w-full object-cover"
              />
            </div>
          ) : null}
        </div>

        {error ? (
          <p
            className="text-sm font-semibold text-red-600"
            role="alert"
          >
            {
              error
            }
          </p>
        ) : null}

        <button
          type="submit"
          disabled={
            publishing
          }
          className="inline-flex w-full items-center justify-center rounded-[10px] bg-accent-400 px-5 py-3.5 text-sm font-bold text-black transition hover:bg-accent-500 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          {publishing
            ? "Publishing..."
            : "Publish listing"}
        </button>
      </form>
    </PageShell>
  );
}