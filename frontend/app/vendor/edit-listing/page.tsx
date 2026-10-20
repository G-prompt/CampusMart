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
  formatNaira,
} from "@/lib/products";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:5000";

type Product = {
  id: number;
  title: string;
  category: string;
  price: number;
  description: string;
  images: string[];
  sizes?: string[];
  colors?: string[];
};

type SellerEligibility = {
  canSell: boolean;
  message: string;
};

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

  useEffect(() => {
    const rawId =
      new URLSearchParams(
        window.location.search
      ).get(
        "id"
      );

    const id =
      Number(
        rawId
      );

    if (
      !Number.isInteger(
        id
      ) ||
      id <=
        0
    ) {
      setLoading(
        false
      );

      setError(
        "This edit link does not contain a valid listing ID."
      );

      return;
    }

    setProductId(
      id
    );
  }, []);

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

    const load =
      async () => {
        try {
          setLoading(
            true
          );

          const token =
            localStorage.getItem(
              "campusmart-token"
            );

          if (
            !token
          ) {
            throw new Error(
              "Your session has expired."
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
                "Unable to check seller access."
            );
          }

          const selected =
            (
              productsData.products as
                Product[]
            ).find(
              (
                item
              ) =>
                item.id ===
                productId
            );

          if (
            !selected
          ) {
            throw new Error(
              "This listing could not be found in your seller account."
            );
          }

          setProduct(
            selected
          );

          setEligibility(
            eligibilityData.eligibility
          );

          setTitle(
            selected.title
          );

          setCategory(
            selected.category
          );

          setPrice(
            String(
              selected.price
            )
          );

          setDescription(
            selected.description
          );

          setSizes(
            selected.sizes ??
              []
          );

          setColors(
            selected.colors ??
              []
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

    void load();

    return () =>
      controller.abort();
  }, [
    productId,
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
      const files =
        Array.from(
          event.target.files ??
            []
        );

      if (
        files.length >
        6
      ) {
        setError(
          "Choose a maximum of 6 replacement images."
        );

        event.target.value =
          "";

        return;
      }

      setImageFiles(
        files
      );

      setError(
        ""
      );
    };

  const saveListing =
    async (
      event:
        FormEvent<HTMLFormElement>
    ) => {
      event.preventDefault();

      if (
        !product ||
        !productId ||
        saving
      ) {
        return;
      }

      if (
        !eligibility?.canSell
      ) {
        setError(
          eligibility?.message ||
            "Your seller account is not currently eligible to edit listings."
        );

        return;
      }

      const numericPrice =
        Number(
          price
        );

      if (
        !title.trim() ||
        !category.trim() ||
        !description.trim() ||
        !Number.isFinite(
          numericPrice
        ) ||
        numericPrice <=
          0
      ) {
        setError(
          "Complete all required listing details."
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
          "Your session has expired."
        );

        return;
      }

      try {
        setSaving(
          true
        );

        setError(
          ""
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

        window.dispatchEvent(
          new CustomEvent(
            "campusmart-toast",
            {
              detail: {
                message:
                  "Listing updated",
              },
            }
          )
        );

        router.push(
          "/vendor/listings"
        );
      } catch (
        saveError
      ) {
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

  if (
    user?.role !==
    "vendor"
  ) {
    return (
      <PageShell
        title="Edit listing"
        description="Update your CampusMart listing."
      >
        <section className="site-card max-w-lg p-7 text-center">
          <h2 className="text-2xl font-black">
            Seller access required
          </h2>

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
    loading
  ) {
    return (
      <PageShell
        title="Edit listing"
        description="Update your CampusMart listing."
      >
        <div className="site-card h-96 max-w-4xl animate-pulse bg-slate-100" />
      </PageShell>
    );
  }

  if (
    !product
  ) {
    return (
      <PageShell
        title="Edit listing"
        description="Update your CampusMart listing."
      >
        <section className="site-card max-w-xl p-7 text-center">
          <h2 className="text-2xl font-black">
            Listing unavailable
          </h2>

          <p className="mt-3 text-sm text-slate-600">
            {
              error
            }
          </p>

          <Link
            href="/vendor/listings"
            className="mt-6 inline-flex rounded-xl bg-accent-400 px-5 py-3 text-sm font-black"
          >
            My listings
          </Link>
        </section>
      </PageShell>
    );
  }

  if (
    !eligibility?.canSell
  ) {
    return (
      <PageShell
        title="Edit listing"
        description="Update your CampusMart listing."
      >
        <section className="max-w-2xl rounded-2xl border border-amber-200 bg-amber-50 p-7">
          <h2 className="text-2xl font-black text-amber-950">
            Editing is currently unavailable
          </h2>

          <p className="mt-3 text-sm leading-6 text-amber-800">
            {eligibility?.message ||
              "Complete your seller requirements before editing listings."}
          </p>

          <Link
            href="/profile"
            className="mt-6 inline-flex rounded-xl bg-accent-400 px-5 py-3 text-sm font-black"
          >
            Review seller setup
          </Link>
        </section>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Edit listing"
      description="Update your product details, options and images."
    >
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/vendor/listings"
          className="text-sm font-bold text-slate-500"
        >
          ← My listings
        </Link>

        <Link
          href={`/marketplace/products/${product.id}`}
          className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold"
        >
          View listing
        </Link>
      </div>

      <form
        onSubmit={
          saveListing
        }
        className="site-card max-w-4xl space-y-6 p-5 sm:p-7"
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="text-sm font-bold">
            Product name

            <input
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
              className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none"
            />
          </label>

          <label className="text-sm font-bold">
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
              className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
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

        <label className="block text-sm font-bold">
          Price

          <input
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
            className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
          />
        </label>

        <label className="block text-sm font-bold">
          Description

          <textarea
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
            className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
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

        <section className="rounded-2xl border border-slate-200 p-5">
          <h2 className="font-black">
            Product images
          </h2>

          <p className="mt-1 text-xs leading-5 text-slate-500">
            Leave this section unchanged to keep the current gallery. Selecting replacement images replaces the gallery.
          </p>

          {product.images.length >
          0 ? (
            <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
              {product.images.map(
                (
                  image,
                  index
                ) => (
                  <div
                    key={`${image}-${index}`}
                    className="relative overflow-hidden rounded-xl border border-slate-200"
                  >
                    <img
                      src={
                        image
                      }
                      alt=""
                      className="aspect-square w-full object-cover"
                    />

                    <span className="absolute bottom-1 left-1 rounded-full bg-black/70 px-2 py-1 text-[8px] font-black text-white">
                      {index ===
                      0
                        ? "Main"
                        : `Preview ${index}`}
                    </span>
                  </div>
                )
              )}
            </div>
          ) : null}

          <label className="mt-5 block text-sm font-bold">
            Replacement images

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
            Up to 6 replacement images. The first becomes the main image.
          </p>

          <label className="mt-4 block text-sm font-bold">
            Replacement image URL{" "}

            <span className="font-normal text-slate-400">
              optional
            </span>

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
              className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
              placeholder="https://..."
            />
          </label>

          {imagePreviews.length >
          0 ? (
            <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
              {imagePreviews.map(
                (
                  image,
                  index
                ) => (
                  <div
                    key={
                      image
                    }
                    className="relative overflow-hidden rounded-xl border border-amber-200"
                  >
                    <img
                      src={
                        image
                      }
                      alt=""
                      className="aspect-square w-full object-cover"
                    />

                    <span className="absolute bottom-1 left-1 rounded-full bg-black/70 px-2 py-1 text-[8px] font-black text-white">
                      {index ===
                      0
                        ? "New main"
                        : `Preview ${index}`}
                    </span>
                  </div>
                )
              )}
            </div>
          ) : null}
        </section>

        <div className="rounded-xl bg-slate-50 p-4">
          <p className="text-sm font-black">
            Current price:{" "}
            {formatNaira(
              product.price
            )}
          </p>
        </div>

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {
              error
            }
          </div>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="submit"
            disabled={
              saving
            }
            className="rounded-xl bg-accent-400 px-6 py-3 text-sm font-black disabled:opacity-50"
          >
            {saving
              ? "Saving..."
              : "Save changes"}
          </button>

          <Link
            href="/vendor/listings"
            className="rounded-xl border border-slate-200 px-6 py-3 text-center text-sm font-bold"
          >
            Cancel
          </Link>
        </div>
      </form>
    </PageShell>
  );
}