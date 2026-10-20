"use client";

import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";

import {
  useRouter,
} from "next/navigation";

import PageShell from "@/components/common/PageShell";
import ProductOptionsEditor from "@/components/common/ProductOptionsEditor";

import {
  useAuth,
} from "@/components/common/AuthContext";

import {
  categories,
} from "@/lib/products";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:5000";

const MAX_IMAGES = 6;

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

type SellerRequirement = {
  key: string;
  label: string;
  complete: boolean;
  required: boolean;
};

type SellerEligibility = {
  canSell: boolean;

  nextRequiredAction:
    SellerNextAction;

  message: string;

  requirements:
    SellerRequirement[];
};

function getSetupAction(
  action:
    SellerNextAction
) {
  switch (
    action
  ) {
    case "complete_university_details":
      return {
        label:
          "Add university details",
        href:
          "/profile",
      };

    case "add_matric_number":
      return {
        label:
          "Add matric number",
        href:
          "/profile",
      };

    case "verify_student_identity":
      return {
        label:
          "Complete verification",
        href:
          "/profile",
      };

    case "complete_seller_profile":
      return {
        label:
          "Complete seller profile",
        href:
          "/profile",
      };

    default:
      return {
        label:
          "Review seller setup",
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
    imageFiles,
    setImageFiles,
  ] =
    useState<File[]>(
      []
    );

  const [
    imageUrl,
    setImageUrl,
  ] =
    useState(
      ""
    );

  const [
    sizes,
    setSizes,
  ] =
    useState<string[]>(
      []
    );

  const [
    colors,
    setColors,
  ] =
    useState<string[]>(
      []
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

    const load =
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

          if (
            !token
          ) {
            throw new Error(
              "Your session could not be verified."
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
          requestError
        ) {
          if (
            requestError instanceof
              DOMException &&
            requestError.name ===
              "AbortError"
          ) {
            return;
          }

          setEligibilityError(
            requestError instanceof
              Error
              ? requestError.message
              : "Unable to check seller access."
          );
        } finally {
          if (
            !controller.signal
              .aborted
          ) {
            setCheckingEligibility(
              false
            );
          }
        }
      };

    void load();

    return () =>
      controller.abort();
  }, [
    user,
  ]);

  const imagePreviews =
    useMemo(
      () =>
        imageFiles.map(
          (
            file
          ) =>
            URL.createObjectURL(
              file
            )
        ),
      [
        imageFiles,
      ]
    );

  useEffect(() => {
    return () => {
      imagePreviews.forEach(
        (
          preview
        ) =>
          URL.revokeObjectURL(
            preview
          )
      );
    };
  }, [
    imagePreviews,
  ]);

  const handleImages =
    (
      event:
        ChangeEvent<HTMLInputElement>
    ) => {
      setError(
        ""
      );

      const files =
        Array.from(
          event.target.files ??
            []
        );

      if (
        files.length >
        MAX_IMAGES
      ) {
        setError(
          "Choose a maximum of 6 images: 1 main image and up to 5 preview images."
        );

        event.target.value =
          "";

        return;
      }

      const invalid =
        files.find(
          (
            file
          ) =>
            ![
              "image/jpeg",
              "image/png",
              "image/webp",
              "image/avif",
            ].includes(
              file.type
            ) ||
            file.size >
              5 *
                1024 *
                1024
        );

      if (
        invalid
      ) {
        setError(
          "Images must be JPG, PNG, WebP or AVIF and no larger than 5 MB each."
        );

        event.target.value =
          "";

        return;
      }

      setImageFiles(
        files
      );

      if (
        files.length
      ) {
        setImageUrl(
          ""
        );
      }
    };

  const submit =
    async (
      event:
        FormEvent<HTMLFormElement>
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
          "Seller access is required."
        );

        return;
      }

      if (
        !eligibility?.canSell
      ) {
        setError(
          eligibility?.message ||
            "Complete your seller setup before publishing."
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
          "Add a title, description and valid price."
        );

        return;
      }

      if (
        imageFiles.length ===
          0 &&
        !imageUrl.trim()
      ) {
        setError(
          "Every listing needs a main product image."
        );

        return;
      }

      const token =
        localStorage.getItem(
          "campusmart-token"
        );

      if (
        !token
      ) {
        setError(
          "Your session has expired. Sign in again."
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

        formData.append(
          "sizes",
          JSON.stringify(
            sizes
          )
        );

        formData.append(
          "colors",
          JSON.stringify(
            colors
          )
        );

        imageFiles.forEach(
          (
            file
          ) =>
            formData.append(
              "images",
              file
            )
        );

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
          data.eligibility
        ) {
          setEligibility(
            data.eligibility
          );
        }

        if (
          !response.ok ||
          !data.success
        ) {
          throw new Error(
            data.message ||
              "Unable to publish listing."
          );
        }

        window.dispatchEvent(
          new CustomEvent(
            "campusmart-toast",
            {
              detail: {
                message:
                  "Listing published",
              },
            }
          )
        );

        router.push(
          `/marketplace/products/${data.product.id}`
        );
      } catch (
        publishError
      ) {
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

  if (
    user?.role !==
    "vendor"
  ) {
    return (
      <PageShell
        title="Add listing"
        description="Publish something for students to discover."
      >
        <section className="site-card max-w-xl p-7 text-center">
          <h2 className="text-2xl font-black">
            Seller access required
          </h2>

          <p className="mt-3 text-sm leading-6 text-slate-600">
            Sign in with your seller-enabled CampusMart account before publishing a listing.
          </p>

          <button
            type="button"
            onClick={() =>
              openAuth(
                "login",
                "vendor"
              )
            }
            className="mt-6 rounded-xl bg-accent-400 px-5 py-3 text-sm font-black"
          >
            Sign in
          </button>
        </section>
      </PageShell>
    );
  }

  if (
    checkingEligibility
  ) {
    return (
      <PageShell
        title="Add listing"
        description="Publish something for students to discover."
      >
        <div className="site-card max-w-3xl animate-pulse p-8">
          <div className="h-7 w-56 rounded bg-slate-200" />
          <div className="mt-4 h-4 w-full max-w-lg rounded bg-slate-100" />
        </div>
      </PageShell>
    );
  }

  if (
    eligibilityError
  ) {
    return (
      <PageShell
        title="Add listing"
        description="Publish something for students to discover."
      >
        <section className="site-card max-w-xl p-7">
          <h2 className="text-xl font-black">
            Seller access unavailable
          </h2>

          <p className="mt-3 text-sm text-red-600">
            {
              eligibilityError
            }
          </p>
        </section>
      </PageShell>
    );
  }

  if (
    eligibility &&
    !eligibility.canSell
  ) {
    const action =
      getSetupAction(
        eligibility.nextRequiredAction
      );

    return (
      <PageShell
        title="Add listing"
        description="Publish something for students to discover."
      >
        <section className="site-card max-w-2xl p-7">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">
            Seller setup
          </p>

          <h2 className="mt-2 text-2xl font-black">
            Finish your seller requirements
          </h2>

          <p className="mt-3 text-sm leading-6 text-slate-600">
            {
              eligibility.message
            }
          </p>

          <div className="mt-5 space-y-2">
            {eligibility.requirements?.map(
              (
                requirement
              ) => (
                <div
                  key={
                    requirement.key
                  }
                  className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm"
                >
                  <span className="font-semibold">
                    {
                      requirement.label
                    }
                  </span>

                  <span
                    className={
                      requirement.complete
                        ? "font-bold text-emerald-600"
                        : requirement.required
                          ? "font-bold text-amber-700"
                          : "text-slate-400"
                    }
                  >
                    {requirement.complete
                      ? "✓ Complete"
                      : requirement.required
                        ? "Required"
                        : "Optional"}
                  </span>
                </div>
              )
            )}
          </div>

          <Link
            href={
              action.href
            }
            className="mt-6 inline-flex rounded-xl bg-accent-400 px-5 py-3 text-sm font-black"
          >
            {
              action.label
            }
          </Link>
        </section>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Add listing"
      description="Create a clear, useful listing without making buyers dig for the important details."
    >
      <form
        onSubmit={
          submit
        }
        className="site-card max-w-4xl space-y-6 p-5 sm:p-7"
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="text-sm font-bold text-slate-700">
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
              className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-black"
              placeholder="e.g. Red sweater vest"
            />
          </label>

          <label className="text-sm font-bold text-slate-700">
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
              className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
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

        <label className="block text-sm font-bold text-slate-700">
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
            className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-black"
            placeholder="9000"
          />
        </label>

        <label className="block text-sm font-bold text-slate-700">
          Description

          <textarea
            required
            rows={
              5
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
            className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-black"
            placeholder="Condition, what comes with it, important details, etc."
          />
        </label>

        <ProductOptionsEditor
          sizes={
            sizes
          }
          colors={
            colors
          }
          onSizesChange={
            setSizes
          }
          onColorsChange={
            setColors
          }
        />

        <section className="rounded-2xl border border-slate-200 p-4 sm:p-5">
          <h2 className="font-black text-slate-950">
            Product photos
          </h2>

          <p className="mt-1 text-xs leading-5 text-slate-500">
            The first image is your main listing image. Add up to five more preview images.
          </p>

          <label className="mt-4 block text-sm font-bold text-slate-700">
            Upload images

            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,image/avif"
              onChange={
                handleImages
              }
              className="mt-2 block w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm"
            />
          </label>

          <p className="mt-2 text-xs text-slate-500">
            1–6 images. Maximum 5 MB each.
          </p>

          {imageFiles.length ===
            0 ? (
            <>
              <div className="my-4 flex items-center gap-3">
                <div className="h-px flex-1 bg-slate-200" />
                <span className="text-xs font-bold uppercase text-slate-400">
                  or
                </span>
                <div className="h-px flex-1 bg-slate-200" />
              </div>

              <label className="block text-sm font-bold text-slate-700">
                Main image URL

                <input
                  type="url"
                  value={
                    imageUrl
                  }
                  onChange={(
                    event
                  ) =>
                    setImageUrl(
                      event.target.value
                    )
                  }
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
                  placeholder="https://..."
                />
              </label>
            </>
          ) : null}

          {imagePreviews.length >
          0 ? (
            <div className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-6">
              {imagePreviews.map(
                (
                  preview,
                  index
                ) => (
                  <div
                    key={
                      preview
                    }
                    className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-100"
                  >
                    <img
                      src={
                        preview
                      }
                      alt={`Preview ${index + 1}`}
                      className="aspect-square w-full object-cover"
                    />

                    <span className="absolute bottom-1 left-1 rounded-full bg-black/75 px-2 py-1 text-[9px] font-black text-white backdrop-blur">
                      {index ===
                      0
                        ? "Main"
                        : `Preview ${index}`}
                    </span>
                  </div>
                )
              )}
            </div>
          ) : imageUrl.trim() ? (
            <div className="relative mt-5 w-36 overflow-hidden rounded-xl border border-slate-200">
              <img
                src={
                  imageUrl
                }
                alt="Main preview"
                className="aspect-square w-full object-cover"
              />

              <span className="absolute bottom-1 left-1 rounded-full bg-black/75 px-2 py-1 text-[9px] font-black text-white">
                Main
              </span>
            </div>
          ) : null}
        </section>

        {error ? (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"
          >
            {
              error
            }
          </div>
        ) : null}

        <button
          type="submit"
          disabled={
            publishing
          }
          className="w-full rounded-xl bg-accent-400 px-6 py-3.5 text-sm font-black transition hover:bg-accent-500 disabled:opacity-50 sm:w-auto"
        >
          {publishing
            ? "Publishing..."
            : "Publish listing"}
        </button>
      </form>
    </PageShell>
  );
}