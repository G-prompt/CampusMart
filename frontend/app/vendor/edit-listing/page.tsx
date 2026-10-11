"use client";

import Link from "next/link";

import {
  ChangeEvent,
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

import {
  formatNaira,
} from "@/lib/products";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:5000";

type Product = {
  id: number;
  slug?: string;
  title: string;
  category: string;
  price: number;
  description: string;
  images: string[];
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
  canSell: boolean;

  nextRequiredAction:
    SellerNextAction;

  message: string;
};

function getSetupAction(
  action:
    SellerNextAction
) {
  switch (action) {
    case "complete_university_details":
      return {
        label:
          "Complete university details",

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

    case "seller_access_pending":
      return {
        label:
          "Review seller setup",

        href:
          "/profile",
      };

    case "seller_access_restricted":
      return {
        label:
          "Review account",

        href:
          "/profile",
      };

    case "seller_access_suspended":
      return {
        label:
          "Review account",

        href:
          "/profile",
      };

    default:
      return {
        label:
          "Complete seller setup",

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
    productId,
    setProductId,
  ] =
    useState<
      number | null
    >(
      null
    );

  const [
    invalidProductId,
    setInvalidProductId,
  ] =
    useState(
      false
    );

  const [
    product,
    setProduct,
  ] =
    useState<
      Product | null
    >(
      null
    );

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
      ""
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
    imageUrl,
    setImageUrl,
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
    message,
    setMessage,
  ] =
    useState(
      ""
    );

  /*
   * =====================================================
   * READ LISTING ID
   * =====================================================
   */

  useEffect(() => {
    const params =
      new URLSearchParams(
        window.location.search
      );

    const rawId =
      params.get(
        "id"
      );

    const parsedId =
      Number(
        rawId
      );

    if (
      !rawId ||
      !Number.isInteger(
        parsedId
      ) ||
      parsedId <= 0
    ) {
      setInvalidProductId(
        true
      );

      setLoading(
        false
      );

      return;
    }

    setProductId(
      parsedId
    );
  }, []);

  /*
   * =====================================================
   * LOAD OWN LISTING + SELLER ELIGIBILITY
   * =====================================================
   *
   * We deliberately use /products/mine instead of the
   * public product endpoint.
   *
   * This means the frontend only accepts a product ID that
   * appears in the authenticated seller's own listings.
   *
   * The backend PATCH route still performs its own
   * ownership check as the authoritative security layer.
   */

  useEffect(() => {
    if (
      !productId ||
      user?.role !==
        "vendor"
    ) {
      if (
        user &&
        user.role !==
          "vendor"
      ) {
        setLoading(
          false
        );
      }

      return;
    }

    const controller =
      new AbortController();

    const loadPage =
      async () => {
        try {
          setLoading(
            true
          );

          setError(
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

          const headers = {
            Authorization:
              `Bearer ${token}`,
          };

          const [
            productsResponse,
            eligibilityResponse,
          ] =
            await Promise.all([
              fetch(
                `${API_URL}/api/products/mine`,
                {
                  headers,

                  signal:
                    controller.signal,

                  cache:
                    "no-store",
                }
              ),

              fetch(
                `${API_URL}/api/vendor/eligibility`,
                {
                  headers,

                  signal:
                    controller.signal,

                  cache:
                    "no-store",
                }
              ),
            ]);

          const [
            productsData,
            eligibilityData,
          ] =
            await Promise.all([
              productsResponse.json(),
              eligibilityResponse.json(),
            ]);

          if (
            !productsResponse.ok ||
            !productsData.success
          ) {
            throw new Error(
              productsData.message ||
                "Unable to load your listings."
            );
          }

          if (
            !eligibilityResponse.ok ||
            !eligibilityData.success
          ) {
            throw new Error(
              eligibilityData.message ||
                "Unable to confirm seller access."
            );
          }

          const products:
            Product[] =
              Array.isArray(
                productsData.products
              )
                ? productsData.products
                : [];

          const selectedProduct =
            products.find(
              (
                item
              ) =>
                Number(
                  item.id
                ) ===
                productId
            );

          if (
            !selectedProduct
          ) {
            setProduct(
              null
            );

            setEligibility(
              eligibilityData
                .eligibility
            );

            setError(
              "This listing could not be found in your seller account."
            );

            return;
          }

          setProduct(
            selectedProduct
          );

          setEligibility(
            eligibilityData
              .eligibility
          );

          setTitle(
            selectedProduct.title ??
              ""
          );

          setCategory(
            selectedProduct.category ??
              ""
          );

          setPrice(
            String(
              selectedProduct.price ??
                ""
            )
          );

          setDescription(
            selectedProduct.description ??
              ""
          );
        } catch (
          loadError
        ) {
          if (
            loadError instanceof
              DOMException &&
            loadError.name ===
              "AbortError"
          ) {
            return;
          }

          console.error(
            "Edit listing load error:",
            loadError
          );

          setError(
            loadError instanceof
              Error
              ? loadError.message
              : "Unable to load listing."
          );
        } finally {
          if (
            !controller.signal
              .aborted
          ) {
            setLoading(
              false
            );
          }
        }
      };

    void loadPage();

    return () => {
      controller.abort();
    };
  }, [
    productId,
    user,
  ]);

  /*
   * =====================================================
   * LOCAL IMAGE PREVIEWS
   * =====================================================
   */

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
        ) => {
          URL.revokeObjectURL(
            preview
          );
        }
      );
    };
  }, [
    imagePreviews,
  ]);

  /*
   * =====================================================
   * IMAGE SELECTION
   * =====================================================
   */

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
        5
      ) {
        setError(
          "You can upload a maximum of 5 images."
        );

        event.target.value =
          "";

        return;
      }

      const invalidFile =
        files.find(
          (
            file
          ) =>
            !file.type.startsWith(
              "image/"
            )
        );

      if (
        invalidFile
      ) {
        setError(
          "Please select image files only."
        );

        event.target.value =
          "";

        return;
      }

      setImageFiles(
        files
      );
    };

  /*
   * =====================================================
   * SAVE LISTING
   * =====================================================
   */

  const saveListing =
    async (
      event:
        FormEvent<HTMLFormElement>
    ) => {
      event.preventDefault();

      if (
        saving ||
        !productId ||
        !product
      ) {
        return;
      }

      setError(
        ""
      );

      setMessage(
        ""
      );

      if (
        !eligibility?.canSell
      ) {
        setError(
          eligibility?.message ||
            "Your seller account is not currently eligible to edit listings."
        );

        return;
      }

      const cleanTitle =
        title.trim();

      const cleanCategory =
        category.trim();

      const cleanDescription =
        description.trim();

      const numericPrice =
        Number(
          price
        );

      if (
        !cleanTitle
      ) {
        setError(
          "Enter a listing title."
        );

        return;
      }

      if (
        !cleanCategory
      ) {
        setError(
          "Enter a category."
        );

        return;
      }

      if (
        !Number.isFinite(
          numericPrice
        ) ||
        numericPrice <= 0
      ) {
        setError(
          "Enter a valid price greater than zero."
        );

        return;
      }

      if (
        !cleanDescription
      ) {
        setError(
          "Enter a listing description."
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
        setSaving(
          true
        );

        const formData =
          new FormData();

        formData.append(
          "title",
          cleanTitle
        );

        formData.append(
          "category",
          cleanCategory
        );

        formData.append(
          "price",
          String(
            numericPrice
          )
        );

        formData.append(
          "description",
          cleanDescription
        );

        imageFiles.forEach(
          (
            file
          ) => {
            formData.append(
              "images",
              file
            );
          }
        );

        const cleanImageUrl =
          imageUrl.trim();

        if (
          cleanImageUrl
        ) {
          formData.append(
            "imageUrl",
            cleanImageUrl
          );
        }

        const response =
          await fetch(
            `${API_URL}/api/products/${productId}`,
            {
              method:
                "PATCH",

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

        /*
         * Seller eligibility may have changed since page
         * load, so use the backend's current state when it
         * provides one.
         */

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
              "Unable to update listing."
          );
        }

        setMessage(
          "Listing updated successfully."
        );

        window.dispatchEvent(
          new CustomEvent(
            "campusmart-toast",
            {
              detail: {
                message:
                  "Listing updated successfully",
              },
            }
          )
        );

        /*
         * Return to the seller's listing manager after a
         * successful edit.
         */

        router.push(
          "/vendor/listings"
        );
      } catch (
        saveError
      ) {
        console.error(
          "Edit listing error:",
          saveError
        );

        setError(
          saveError instanceof
            Error
            ? saveError.message
            : "Unable to update listing."
        );
      } finally {
        setSaving(
          false
        );
      }
    };

  /*
   * =====================================================
   * NON-VENDOR
   * =====================================================
   */

  if (
    user?.role !==
    "vendor"
  ) {
    return (
      <PageShell
        title="Edit listing"
        description="Update your marketplace listing."
      >
        <div className="site-card max-w-md p-8 text-center">
          <h2 className="text-2xl font-bold text-slate-950">
            Seller account
            required
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-600">
            Sign in with your
            seller account to
            edit CampusMart
            listings.
          </p>

          <button
            type="button"
            onClick={() =>
              openAuth(
                "login",
                "vendor"
              )
            }
            className="mt-6 rounded-[10px] bg-accent-400 px-5 py-3 text-sm font-bold text-black"
          >
            Sign in as seller
          </button>
        </div>
      </PageShell>
    );
  }

  /*
   * =====================================================
   * INVALID ID
   * =====================================================
   */

  if (
    invalidProductId
  ) {
    return (
      <PageShell
        title="Edit listing"
        description="Update your marketplace listing."
      >
        <div className="site-card max-w-xl p-8 text-center">
          <h2 className="text-2xl font-bold text-slate-950">
            Invalid listing
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-600">
            This edit link does
            not contain a valid
            CampusMart listing
            ID.
          </p>

          <Link
            href="/vendor/listings"
            className="mt-6 inline-flex rounded-[10px] bg-accent-400 px-5 py-3 text-sm font-bold text-black"
          >
            Back to my listings
          </Link>
        </div>
      </PageShell>
    );
  }

  /*
   * =====================================================
   * LOADING
   * =====================================================
   */

  if (
    loading
  ) {
    return (
      <PageShell
        title="Edit listing"
        description="Update your marketplace listing."
      >
        <div className="grid gap-6 lg:grid-cols-[1fr_0.7fr]">
          <div className="site-card h-[560px] animate-pulse bg-slate-100" />

          <div className="site-card h-[360px] animate-pulse bg-slate-100" />
        </div>
      </PageShell>
    );
  }

  /*
   * =====================================================
   * LISTING NOT FOUND / NOT OWNED
   * =====================================================
   */

  if (
    !product
  ) {
    return (
      <PageShell
        title="Edit listing"
        description="Update your marketplace listing."
      >
        <div className="site-card max-w-xl p-8 text-center">
          <h2 className="text-2xl font-bold text-slate-950">
            Listing unavailable
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-600">
            {error ||
              "This listing could not be found in your seller account."}
          </p>

          <Link
            href="/vendor/listings"
            className="mt-6 inline-flex rounded-[10px] bg-accent-400 px-5 py-3 text-sm font-bold text-black"
          >
            Back to my listings
          </Link>
        </div>
      </PageShell>
    );
  }

  const canSell =
    eligibility
      ?.canSell ??
    false;

  const setupAction =
    getSetupAction(
      eligibility
        ?.nextRequiredAction ??
        "not_a_seller"
    );

  /*
   * =====================================================
   * SELLER NOT CURRENTLY ELIGIBLE
   * =====================================================
   */

  if (
    !canSell
  ) {
    return (
      <PageShell
        title="Edit listing"
        description="Update your marketplace listing."
      >
        <div className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
          <section className="site-card overflow-hidden">
            {product.images
              ?.length ? (
              <img
                src={
                  product
                    .images[0]
                }
                alt={
                  product.title
                }
                className="h-72 w-full object-cover"
              />
            ) : (
              <div className="flex h-72 items-center justify-center bg-slate-950 px-6 text-center font-bold text-white">
                CampusMart
                listing
              </div>
            )}

            <div className="p-6">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                {
                  product.category
                }
              </p>

              <h2 className="mt-2 text-2xl font-bold text-slate-950">
                {
                  product.title
                }
              </h2>

              <p className="mt-3 text-xl font-bold text-slate-950">
                {formatNaira(
                  product.price
                )}
              </p>

              <p className="mt-4 text-sm leading-7 text-slate-600">
                {
                  product.description
                }
              </p>
            </div>
          </section>

          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-700">
              Editing unavailable
            </p>

            <h2 className="mt-2 text-2xl font-bold text-amber-950">
              Complete your seller
              requirements
            </h2>

            <p className="mt-3 text-sm leading-7 text-amber-800">
              {eligibility
                ?.message ||
                "Your seller account is not currently eligible to edit listings."}
            </p>

            <p className="mt-3 text-xs leading-5 text-amber-700">
              Your existing listing
              remains visible in your
              seller account, but
              editing requires active
              seller access.
            </p>

            <div className="mt-6 flex flex-col gap-3">
              <Link
                href={
                  setupAction.href
                }
                className="rounded-[10px] bg-accent-400 px-5 py-3 text-center text-sm font-bold text-black"
              >
                {
                  setupAction.label
                }
              </Link>

              <Link
                href="/vendor/listings"
                className="rounded-[10px] border border-amber-200 bg-white px-5 py-3 text-center text-sm font-bold text-amber-900"
              >
                Back to my listings
              </Link>
            </div>
          </section>
        </div>
      </PageShell>
    );
  }

  /*
   * =====================================================
   * EDIT FORM
   * =====================================================
   */

  return (
    <PageShell
      title="Edit listing"
      description="Update your listing details and media."
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/vendor/listings"
          className="text-sm font-bold text-slate-600 transition hover:text-black"
        >
          ← Back to my listings
        </Link>

        <Link
          href={`/marketplace/products/${product.id}`}
          className="rounded-[10px] border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:border-black hover:text-black"
        >
          View listing
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <form
          onSubmit={
            saveListing
          }
          className="site-card p-6 sm:p-8"
        >
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
              Seller access active
            </p>

            <h2 className="mt-2 text-2xl font-bold text-slate-950">
              Listing details
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              Update the information
              buyers see in the
              marketplace.
            </p>
          </div>

          {error ? (
            <div
              className="mt-6 rounded-[10px] border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"
              role="alert"
            >
              {
                error
              }
            </div>
          ) : null}

          {message ? (
            <div
              className="mt-6 rounded-[10px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700"
              role="status"
            >
              {
                message
              }
            </div>
          ) : null}

          <div className="mt-7 space-y-6">
            <div>
              <label
                htmlFor="title"
                className="text-sm font-bold text-slate-950"
              >
                Product title
              </label>

              <input
                id="title"
                type="text"
                value={
                  title
                }
                onChange={(
                  event
                ) =>
                  setTitle(
                    event.target
                      .value
                  )
                }
                className="mt-2 w-full rounded-[10px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-black"
                placeholder="Product title"
                required
              />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="category"
                  className="text-sm font-bold text-slate-950"
                >
                  Category
                </label>

                <input
                  id="category"
                  type="text"
                  value={
                    category
                  }
                  onChange={(
                    event
                  ) =>
                    setCategory(
                      event.target
                        .value
                    )
                  }
                  className="mt-2 w-full rounded-[10px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-black"
                  placeholder="e.g. Electronics"
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="price"
                  className="text-sm font-bold text-slate-950"
                >
                  Price (₦)
                </label>

                <input
                  id="price"
                  type="number"
                  min="1"
                  step="1"
                  value={
                    price
                  }
                  onChange={(
                    event
                  ) =>
                    setPrice(
                      event.target
                        .value
                    )
                  }
                  className="mt-2 w-full rounded-[10px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-black"
                  placeholder="0"
                  required
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="description"
                className="text-sm font-bold text-slate-950"
              >
                Description
              </label>

              <textarea
                id="description"
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
                    event.target
                      .value
                  )
                }
                className="mt-2 w-full resize-y rounded-[10px] border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-950 outline-none transition focus:border-black"
                placeholder="Describe the product..."
                required
              />
            </div>

            <div className="border-t border-slate-200 pt-6">
              <div>
                <p className="text-sm font-bold text-slate-950">
                  Product images
                </p>

                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Leave both fields
                  below empty to keep
                  the current images.
                  If you upload any new
                  images or provide a
                  new image URL, the
                  current image gallery
                  will be replaced.
                </p>
              </div>

              <div className="mt-5">
                <label
                  htmlFor="images"
                  className="text-sm font-bold text-slate-950"
                >
                  Upload replacement
                  images
                </label>

                <input
                  id="images"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={
                    handleImages
                  }
                  className="mt-2 block w-full rounded-[10px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 file:mr-4 file:rounded-md file:border-0 file:bg-slate-950 file:px-4 file:py-2 file:text-xs file:font-bold file:text-white"
                />

                <p className="mt-2 text-xs text-slate-500">
                  Maximum 5 images.
                </p>
              </div>

              <div className="mt-5">
                <label
                  htmlFor="imageUrl"
                  className="text-sm font-bold text-slate-950"
                >
                  Image URL{" "}
                  <span className="font-normal text-slate-400">
                    optional
                  </span>
                </label>

                <input
                  id="imageUrl"
                  type="url"
                  value={
                    imageUrl
                  }
                  onChange={(
                    event
                  ) =>
                    setImageUrl(
                      event.target
                        .value
                    )
                  }
                  className="mt-2 w-full rounded-[10px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition focus:border-black"
                  placeholder="https://..."
                />
              </div>

              {imageFiles.length >
              0 ? (
                <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm font-bold text-amber-950">
                    Replacement
                    gallery selected
                  </p>

                  <p className="mt-1 text-xs leading-5 text-amber-800">
                    Saving this listing
                    will replace the
                    current gallery with
                    the new images below
                    {imageUrl.trim()
                      ? " and the image URL you provided."
                      : "."}
                  </p>
                </div>
              ) : imageUrl.trim() ? (
                <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm font-bold text-amber-950">
                    Replacement image
                    URL selected
                  </p>

                  <p className="mt-1 text-xs leading-5 text-amber-800">
                    Saving will replace
                    the current gallery
                    with the new image
                    URL.
                  </p>
                </div>
              ) : null}

              {imagePreviews.length >
              0 ? (
                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {imagePreviews.map(
                    (
                      preview,
                      index
                    ) => (
                      <div
                        key={
                          preview
                        }
                        className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50"
                      >
                        <img
                          src={
                            preview
                          }
                          alt={`Replacement preview ${index + 1}`}
                          className="aspect-square w-full object-cover"
                        />
                      </div>
                    )
                  )}
                </div>
              ) : null}
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-200 pt-6 sm:flex-row">
              <button
                type="submit"
                disabled={
                  saving
                }
                className="rounded-[10px] bg-accent-400 px-6 py-3 text-sm font-bold text-black transition hover:bg-accent-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving
                  ? "Saving changes..."
                  : "Save changes"}
              </button>

              <Link
                href="/vendor/listings"
                className="rounded-[10px] border border-slate-200 bg-white px-6 py-3 text-center text-sm font-bold text-slate-700 transition hover:border-black hover:text-black"
              >
                Cancel
              </Link>
            </div>
          </div>
        </form>

        <aside className="space-y-6">
          <section className="site-card overflow-hidden">
            <div className="p-6">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                Current listing
              </p>

              <h2 className="mt-2 text-xl font-bold text-slate-950">
                {
                  product.title
                }
              </h2>

              <p className="mt-2 text-lg font-bold text-slate-950">
                {formatNaira(
                  product.price
                )}
              </p>
            </div>

            {product.images
              ?.length ? (
              <div className="grid grid-cols-2 gap-px bg-slate-200">
                {product.images.map(
                  (
                    image,
                    index
                  ) => (
                    <div
                      key={`${image}-${index}`}
                      className={
                        product.images
                          .length ===
                          1
                          ? "col-span-2"
                          : ""
                      }
                    >
                      <img
                        src={
                          image
                        }
                        alt={`${product.title} ${index + 1}`}
                        className="aspect-square w-full bg-white object-cover"
                      />
                    </div>
                  )
                )}
              </div>
            ) : (
              <div className="flex h-56 items-center justify-center bg-slate-950 px-6 text-center text-sm font-bold text-white">
                No current product
                images
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-sm font-bold text-slate-950">
              Image replacement
              behaviour
            </p>

            <p className="mt-2 text-xs leading-6 text-slate-600">
              CampusMart currently
              keeps your existing
              images when you edit only
              the text details.
            </p>

            <p className="mt-2 text-xs leading-6 text-slate-600">
              Supplying any new image
              replaces the entire
              current gallery. Up to 5
              replacement images can be
              saved.
            </p>
          </section>
        </aside>
      </div>
    </PageShell>
  );
}