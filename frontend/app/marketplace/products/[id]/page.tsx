"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import Image from "next/image";
import Link from "next/link";

import {
  useRouter,
} from "next/navigation";

import AutoScrollProducts from "@/components/common/AutoScrollProducts";

import {
  useCart,
} from "@/components/common/CartContext";

import {
  useAuth,
} from "@/components/common/AuthContext";

import {
  formatNaira,
  type Product,
} from "@/lib/products";

import {
  getColourSwatch,
  getSizeGuide,
} from "@/lib/productOptions";

import type {
  ProductReview,
  ReviewEligibility,
} from "@/lib/reviews";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:5000";

const MESSAGE_MAX_LENGTH =
  2000;

type ProductWithVendor =
  Product & {
    vendorId?: string;
  };

type SellerStorefront = {
  sellerId: string;

  businessName: string;

  university:
    | {
        name: string;

        shortName:
          | string
          | null;

        state:
          | string
          | null;

        city:
          | string
          | null;
      }
    | null;

  badges: {
    studentVerified:
      boolean;

    vendorVerified:
      boolean;
  };
};

type ExistingConversation = {
  id: string;

  contextType:
    | "general"
    | "listing"
    | "order";

  product:
    | {
        id:
          number;
      }
    | null;

  otherParty: {
    id:
      string;
  };
};

function formatEligibilityTime(
  value:
    string | null
) {
  if (
    !value
  ) {
    return "";
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
    return "";
  }

  return date.toLocaleString(
    undefined,
    {
      dateStyle:
        "medium",

      timeStyle:
        "short",
    }
  );
}

export default function ProductPage({
  params,
}: {
  params: {
    id:
      string;
  };
}) {
  const router =
    useRouter();

  const {
    addToCart,
  } =
    useCart();

  const {
    user,
    openAuth,
  } =
    useAuth();

  const [
    product,
    setProduct,
  ] =
    useState<
      ProductWithVendor | null
    >(
      null
    );

  const [
    allProducts,
    setAllProducts,
  ] =
    useState<
      Product[]
    >([]);

  const [
    storefront,
    setStorefront,
  ] =
    useState<
      SellerStorefront | null
    >(
      null
    );

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
    activeImage,
    setActiveImage,
  ] =
    useState(
      0
    );

  const [
    selectedSize,
    setSelectedSize,
  ] =
    useState(
      ""
    );

  const [
    selectedColor,
    setSelectedColor,
  ] =
    useState(
      ""
    );

  const [
    sizeGuideOpen,
    setSizeGuideOpen,
  ] =
    useState(
      false
    );

  const [
    variantError,
    setVariantError,
  ] =
    useState(
      ""
    );

  const [
    added,
    setAdded,
  ] =
    useState(
      false
    );

  const [
    reviews,
    setReviews,
  ] =
    useState<
      ProductReview[]
    >([]);

  const [
    reviewAverage,
    setReviewAverage,
  ] =
    useState(
      0
    );

  const [
    reviewCount,
    setReviewCount,
  ] =
    useState(
      0
    );

  const [
    reviewEligibility,
    setReviewEligibility,
  ] =
    useState<
      ReviewEligibility | null
    >(
      null
    );

  const [
    reviewRating,
    setReviewRating,
  ] =
    useState(
      5
    );

  const [
    reviewComment,
    setReviewComment,
  ] =
    useState(
      ""
    );

  const [
    reviewError,
    setReviewError,
  ] =
    useState(
      ""
    );

  const [
    postingReview,
    setPostingReview,
  ] =
    useState(
      false
    );

  const [
    showAllReviews,
    setShowAllReviews,
  ] =
    useState(
      false
    );

  const [
    messageComposerOpen,
    setMessageComposerOpen,
  ] =
    useState(
      false
    );

  const [
    messageDraft,
    setMessageDraft,
  ] =
    useState(
      ""
    );

  const [
    messageError,
    setMessageError,
  ] =
    useState(
      ""
    );

  const [
    openingMessages,
    setOpeningMessages,
  ] =
    useState(
      false
    );

  const [
    sendingMessage,
    setSendingMessage,
  ] =
    useState(
      false
    );

  /*
   * =====================================================
   * PRODUCT
   * =====================================================
   */

  useEffect(() => {
    let active =
      true;

    const load =
      async () => {
        try {
          setLoading(
            true
          );

          setError(
            ""
          );

          setStorefront(
            null
          );

          const [
            productResponse,
            productsResponse,
            reviewsResponse,
          ] =
            await Promise.all([
              fetch(
                `${API_URL}/api/products/${params.id}`,
                {
                  cache:
                    "no-store",
                }
              ),

              fetch(
                `${API_URL}/api/products`,
                {
                  cache:
                    "no-store",
                }
              ),

              fetch(
                `${API_URL}/api/products/${params.id}/reviews`,
                {
                  cache:
                    "no-store",
                }
              ),
            ]);

          const [
            productData,
            productsData,
            reviewsData,
          ] =
            await Promise.all([
              productResponse.json(),

              productsResponse.json(),

              reviewsResponse.json(),
            ]);

          if (
            !productResponse.ok ||
            !productData.success
          ) {
            throw new Error(
              productData.message ||
                "Product not found."
            );
          }

          if (
            !active
          ) {
            return;
          }

          const loadedProduct =
            productData.product as
              ProductWithVendor;

          setProduct(
            loadedProduct
          );

          setActiveImage(
            0
          );

          setSizeGuideOpen(
            false
          );

          const loadedSizes =
            loadedProduct.sizes ??
            [];

          const loadedColors =
            loadedProduct.colors ??
            [];

          setSelectedSize(
            loadedSizes.length ===
              1
              ? loadedSizes[0]
              : ""
          );

          setSelectedColor(
            loadedColors.length ===
              1
              ? loadedColors[0]
              : ""
          );

          if (
            productsResponse.ok &&
            productsData.success
          ) {
            setAllProducts(
              Array.isArray(
                productsData.products
              )
                ? productsData.products
                : []
            );
          }

          if (
            reviewsResponse.ok &&
            reviewsData.success
          ) {
            setReviews(
              Array.isArray(
                reviewsData.reviews
              )
                ? reviewsData.reviews
                : []
            );

            setReviewAverage(
              Number(
                reviewsData.averageRating ??
                  loadedProduct.rating ??
                  0
              )
            );

            setReviewCount(
              Number(
                reviewsData.reviewCount ??
                  0
              )
            );
          } else {
            setReviewAverage(
              loadedProduct.rating ??
                0
            );
          }

          if (
            loadedProduct.vendorId
          ) {
            try {
              const response =
                await fetch(
                  `${API_URL}/api/vendor/storefront/${encodeURIComponent(
                    loadedProduct.vendorId
                  )}`,
                  {
                    cache:
                      "no-store",
                  }
                );

              const data =
                await response.json();

              if (
                active &&
                response.ok &&
                data.success
              ) {
                setStorefront(
                  data.storefront
                );
              }
            } catch (
              storefrontError
            ) {
              console.error(
                "Storefront lookup error:",
                storefrontError
              );

              if (
                active
              ) {
                setStorefront(
                  null
                );
              }
            }
          }
        } catch (
          loadError
        ) {
          console.error(
            "Product page load error:",
            loadError
          );

          if (
            active
          ) {
            setError(
              loadError instanceof
                Error
                ? loadError.message
                : "Unable to load listing."
            );
          }
        } finally {
          if (
            active
          ) {
            setLoading(
              false
            );
          }
        }
      };

    void load();

    return () => {
      active =
        false;
    };
  }, [
    params.id,
  ]);

  /*
   * =====================================================
   * REVIEW ELIGIBILITY
   * =====================================================
   */

  useEffect(() => {
    if (
      !user ||
      !product
    ) {
      setReviewEligibility(
        null
      );

      return;
    }

    const controller =
      new AbortController();

    const load =
      async () => {
        const token =
          localStorage.getItem(
            "campusmart-token"
          );

        if (
          !token
        ) {
          return;
        }

        try {
          const response =
            await fetch(
              `${API_URL}/api/products/${product.id}/reviews/eligibility`,
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
            response.ok &&
            data.success
          ) {
            setReviewEligibility(
              data.eligibility
            );
          }
        } catch (
          eligibilityError
        ) {
          if (
            eligibilityError instanceof
              DOMException &&
            eligibilityError.name ===
              "AbortError"
          ) {
            return;
          }

          console.error(
            "Review eligibility error:",
            eligibilityError
          );
        }
      };

    void load();

    return () => {
      controller.abort();
    };
  }, [
    user,
    product,
  ]);

  /*
   * =====================================================
   * DERIVED DATA
   * =====================================================
   */

  const images =
    product?.images ??
    [];

  const sizes =
    product?.sizes ??
    [];

  const colors =
    product?.colors ??
    [];

  const currentImage =
    images[
      activeImage
    ];

  const ownListing =
    Boolean(
      user &&
      product?.vendorId &&
      user.id ===
        product.vendorId
    );

  const sellerName =
    storefront?.businessName ||
    product?.seller ||
    "CampusMart seller";

  const sellerHref =
    product?.vendorId
      ? `/seller/${product.vendorId}`
      : null;

  const ratingToDisplay =
    reviewCount >
    0
      ? reviewAverage
      : product?.rating ??
        0;

  const sizeGuides =
    sizes
      .map(
        (
          size
        ) => ({
          size,

          guide:
            getSizeGuide(
              size
            ),
        })
      )
      .filter(
        (
          item
        ): item is {
          size: string;
          guide: string;
        } =>
          Boolean(
            item.guide
          )
      );

  const relatedProducts =
    useMemo(
      () => {
        if (
          !product
        ) {
          return [];
        }

        return allProducts
          .filter(
            (
              item
            ) =>
              item.id !==
                product.id &&
              item.category ===
                product.category
          )
          .slice(
            0,
            7
          );
      },
      [
        allProducts,
        product,
      ]
    );

  const visibleReviews =
    showAllReviews
      ? reviews
      : reviews.slice(
          0,
          3
        );

  /*
   * =====================================================
   * IMAGE GALLERY
   * =====================================================
   */

  const previousImage =
    () => {
      if (
        images.length <=
        1
      ) {
        return;
      }

      setActiveImage(
        (
          current
        ) =>
          current ===
          0
            ? images.length -
              1
            : current -
              1
      );
    };

  const nextImage =
    () => {
      if (
        images.length <=
        1
      ) {
        return;
      }

      setActiveImage(
        (
          current
        ) =>
          (
            current +
            1
          ) %
          images.length
      );
    };

  /*
   * =====================================================
   * ADD TO CART
   * =====================================================
   */

  const handleAddToCart =
    () => {
      if (
        !product ||
        ownListing
      ) {
        return;
      }

      if (
        sizes.length >
          0 &&
        !selectedSize
      ) {
        setVariantError(
          "Choose a size first."
        );

        return;
      }

      if (
        colors.length >
          0 &&
        !selectedColor
      ) {
        setVariantError(
          "Choose a colour first."
        );

        return;
      }

      setVariantError(
        ""
      );

      addToCart(
        product,
        1,
        {
          selectedSize:
            selectedSize ||
            undefined,

          selectedColor:
            selectedColor ||
            undefined,
        }
      );

      setAdded(
        true
      );

      window.setTimeout(
        () =>
          setAdded(
            false
          ),
        1500
      );
    };

  /*
   * =====================================================
   * MESSAGING
   * =====================================================
   */

  const handleMessageSeller =
    async () => {
      if (
        !user
      ) {
        openAuth(
          "login",
          "client"
        );

        return;
      }

      if (
        !product?.vendorId ||
        ownListing
      ) {
        return;
      }

      const token =
        localStorage.getItem(
          "campusmart-token"
        );

      if (
        !token
      ) {
        setMessageError(
          "Sign in again to message this seller."
        );

        return;
      }

      try {
        setOpeningMessages(
          true
        );

        setMessageError(
          ""
        );

        const response =
          await fetch(
            `${API_URL}/api/messages/conversations`,
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
          !response.ok ||
          !data.success
        ) {
          throw new Error(
            data.message ||
              "Unable to open messaging."
          );
        }

        const conversations:
          ExistingConversation[] =
          Array.isArray(
            data.conversations
          )
            ? data.conversations
            : [];

        const existing =
          conversations.find(
            (
              conversation
            ) =>
              conversation.contextType ===
                "listing" &&
              conversation.product?.id ===
                product.id &&
              conversation.otherParty?.id ===
                product.vendorId
          );

        if (
          existing
        ) {
          router.push(
            `/messages/${existing.id}`
          );

          return;
        }

        setMessageComposerOpen(
          true
        );
      } catch (
        messagingError
      ) {
        setMessageError(
          messagingError instanceof
            Error
            ? messagingError.message
            : "Unable to open messaging."
        );
      } finally {
        setOpeningMessages(
          false
        );
      }
    };

  const startSellerConversation =
    async (
      event:
        FormEvent<HTMLFormElement>
    ) => {
      event.preventDefault();

      if (
        !product?.vendorId ||
        !user
      ) {
        return;
      }

      const body =
        messageDraft.trim();

      if (
        !body
      ) {
        setMessageError(
          "Write a message first."
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
        setMessageError(
          "Sign in again to continue."
        );

        return;
      }

      try {
        setSendingMessage(
          true
        );

        setMessageError(
          ""
        );

        const response =
          await fetch(
            `${API_URL}/api/messages/conversations`,
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
                  contextType:
                    "listing",

                  productId:
                    product.id,

                  body,
                }),
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
              "Unable to send message."
          );
        }

        if (
          data.moderation?.action ===
          "redacted"
        ) {
          window.dispatchEvent(
            new CustomEvent(
              "campusmart-toast",
              {
                detail: {
                  message:
                    "Message sent. Contact details were hidden.",
                },
              }
            )
          );
        }

        const conversationId =
          data.conversation?.id;

        if (
          !conversationId
        ) {
          throw new Error(
            "Message sent, but the conversation could not be opened."
          );
        }

        router.push(
          `/messages/${conversationId}`
        );
      } catch (
        sendError
      ) {
        setMessageError(
          sendError instanceof
            Error
            ? sendError.message
            : "Unable to send message."
        );
      } finally {
        setSendingMessage(
          false
        );
      }
    };

  /*
   * =====================================================
   * REVIEWS
   * =====================================================
   */

  const postReview =
    async (
      event:
        FormEvent<HTMLFormElement>
    ) => {
      event.preventDefault();

      if (
        !product ||
        !reviewEligibility?.canReview
      ) {
        return;
      }

      const comment =
        reviewComment.trim();

      if (
        !comment
      ) {
        setReviewError(
          "Write a short review first."
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
        setReviewError(
          "Sign in again to post your review."
        );

        return;
      }

      try {
        setPostingReview(
          true
        );

        setReviewError(
          ""
        );

        const response =
          await fetch(
            `${API_URL}/api/products/${product.id}/reviews`,
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
                  rating:
                    reviewRating,

                  comment,
                }),
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
              "Unable to post review."
          );
        }

        setReviews(
          (
            current
          ) => [
            data.review,
            ...current,
          ]
        );

        setReviewAverage(
          Number(
            data.averageRating ??
              reviewAverage
          )
        );

        setReviewCount(
          Number(
            data.reviewCount ??
              reviewCount +
                1
          )
        );

        setReviewComment(
          ""
        );

        setReviewRating(
          5
        );

        setReviewEligibility({
          canReview:
            false,

          reason:
            "already_reviewed",

          eligibleAt:
            null,
        });

        window.dispatchEvent(
          new CustomEvent(
            "campusmart-toast",
            {
              detail: {
                message:
                  "Review posted",
              },
            }
          )
        );
      } catch (
        postError
      ) {
        setReviewError(
          postError instanceof
            Error
            ? postError.message
            : "Unable to post review."
        );
      } finally {
        setPostingReview(
          false
        );
      }
    };

  /*
   * =====================================================
   * PAGE STATES
   * =====================================================
   */

  if (
    loading
  ) {
    return (
      <main className="main-container py-8">
        <div className="h-[430px] animate-pulse rounded-2xl bg-slate-100" />
      </main>
    );
  }

  if (
    error ||
    !product
  ) {
    return (
      <main className="main-container py-16 text-center">
        <h1 className="text-2xl font-black">
          Product unavailable
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          This listing may have been removed or is no longer available.
        </p>

        <Link
          href="/marketplace"
          className="mt-6 inline-flex rounded-xl bg-accent-400 px-5 py-3 text-sm font-black"
        >
          Back to marketplace
        </Link>
      </main>
    );
  }

  return (
    <main className="main-container pb-28 pt-4 sm:pt-6 lg:pb-32">
      <nav className="mb-3">
        <Link
          href="/marketplace"
          className="inline-flex items-center gap-1.5 text-xs font-black text-slate-500 transition hover:text-black"
        >
          ← Marketplace
        </Link>
      </nav>

      <section className="grid gap-4 lg:grid-cols-[0.92fr_1.08fr] lg:gap-7">
        {/*
         * =================================================
         * GALLERY
         * =================================================
         */}

        <div className="min-w-0">
          <div className="relative aspect-[4/3] max-h-[470px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
            {currentImage ? (
              <Image
                src={
                  currentImage
                }
                alt={
                  product.title
                }
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 45vw"
                className="object-contain"
              />
            ) : (
              <div className="flex h-full items-center justify-center bg-slate-900 text-sm font-black text-white">
                CampusMart
              </div>
            )}

            {images.length >
            1 ? (
              <>
                <button
                  type="button"
                  onClick={
                    previousImage
                  }
                  className="absolute left-2.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/70 bg-white/80 text-xl font-black shadow-md backdrop-blur"
                  aria-label="Previous image"
                >
                  ‹
                </button>

                <button
                  type="button"
                  onClick={
                    nextImage
                  }
                  className="absolute right-2.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/70 bg-white/80 text-xl font-black shadow-md backdrop-blur"
                  aria-label="Next image"
                >
                  ›
                </button>

                <span className="absolute bottom-2.5 left-1/2 -translate-x-1/2 rounded-full bg-black/65 px-2.5 py-1 text-[9px] font-black text-white backdrop-blur">
                  {activeImage +
                    1}
                  {" / "}
                  {
                    images.length
                  }
                </span>
              </>
            ) : null}
          </div>

          {images.length >
          1 ? (
            <div className="mt-2 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {images.map(
                (
                  image,
                  index
                ) => (
                  <button
                    key={`${image}-${index}`}
                    type="button"
                    onClick={() =>
                      setActiveImage(
                        index
                      )
                    }
                    className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 bg-slate-100 ${
                      activeImage ===
                      index
                        ? "border-[#4A1724]"
                        : "border-transparent"
                    }`}
                  >
                    <Image
                      src={
                        image
                      }
                      alt=""
                      fill
                      sizes="56px"
                      className="object-cover"
                    />
                  </button>
                )
              )}
            </div>
          ) : null}
        </div>

        {/*
         * =================================================
         * BUYING PANEL
         * =================================================
         */}

        <div className="min-w-0">
          <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#8A6670]">
            {
              product.category
            }
          </p>

          <div className="mt-1 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
            <h1 className="min-w-0 text-2xl font-black leading-tight tracking-tight text-slate-950 sm:text-3xl">
              {
                product.title
              }
            </h1>

            <p className="whitespace-nowrap text-xl font-black tracking-tight text-slate-950 sm:text-2xl">
              {formatNaira(
                product.price
              )}
            </p>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500">
            <span className="font-black text-slate-900">
              ★{" "}
              {Number(
                ratingToDisplay ||
                  0
              ).toFixed(
                1
              )}
            </span>

            {reviewCount >
            0 ? (
              <>
                <span>
                  ·
                </span>

                <span>
                  {reviewCount}{" "}
                  {reviewCount ===
                  1
                    ? "review"
                    : "reviews"}
                </span>
              </>
            ) : null}

            <span>
              ·
            </span>

            <span>
              Sold by{" "}

              {sellerHref ? (
                <Link
                  href={
                    sellerHref
                  }
                  className="font-black text-slate-950 underline decoration-slate-300 underline-offset-3"
                >
                  {
                    sellerName
                  }
                </Link>
              ) : (
                <strong className="text-slate-950">
                  {
                    sellerName
                  }
                </strong>
              )}
            </span>

            {storefront?.badges
              .studentVerified ? (
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-black text-emerald-700 ring-1 ring-emerald-200">
                Verified student
              </span>
            ) : null}

            {storefront?.badges
              .vendorVerified ? (
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[9px] font-black text-blue-700 ring-1 ring-blue-200">
                Verified vendor
              </span>
            ) : null}
          </div>

          {/*
           * =================================================
           * OPTIONS
           * =================================================
           */}

          {sizes.length >
            0 ||
          colors.length >
            0 ? (
            <section className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
              {sizes.length >
              0 ? (
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                      Size
                    </p>

                    {sizeGuides.length >
                    0 ? (
                      <button
                        type="button"
                        onClick={() =>
                          setSizeGuideOpen(
                            (
                              open
                            ) =>
                              !open
                          )
                        }
                        className="text-[10px] font-black text-[#6E3847] underline underline-offset-3"
                      >
                        {sizeGuideOpen
                          ? "Hide guide"
                          : "Size guide"}
                      </button>
                    ) : null}
                  </div>

                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {sizes.map(
                      (
                        size
                      ) => (
                        <button
                          key={
                            size
                          }
                          type="button"
                          onClick={() => {
                            setSelectedSize(
                              size
                            );

                            setVariantError(
                              ""
                            );
                          }}
                          className={`min-w-11 rounded-xl border px-3 py-2 text-xs font-black transition ${
                            selectedSize ===
                            size
                              ? "border-[#4A1724] bg-[#4A1724] text-white"
                              : "border-slate-200 bg-white text-slate-700 hover:border-[#4A1724]"
                          }`}
                        >
                          {
                            size
                          }
                        </button>
                      )
                    )}
                  </div>

                  {sizeGuideOpen &&
                  sizeGuides.length >
                    0 ? (
                    <div className="mt-3 flex flex-wrap gap-1.5 rounded-xl bg-white p-3 ring-1 ring-slate-200">
                      {sizeGuides.map(
                        (
                          item
                        ) => (
                          <span
                            key={
                              item.size
                            }
                            className="rounded-lg bg-slate-50 px-2.5 py-1.5 text-[10px] font-semibold text-slate-600"
                          >
                            <strong className="text-slate-900">
                              {
                                item.size
                              }
                            </strong>
                            {" · "}
                            {
                              item.guide
                            }
                          </span>
                        )
                      )}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {colors.length >
              0 ? (
                <div
                  className={
                    sizes.length >
                    0
                      ? "mt-4 border-t border-slate-200 pt-3.5"
                      : ""
                  }
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                      Colour
                    </p>

                    {colors.length >
                    1 ? (
                      <span className="text-[9px] font-bold text-slate-400">
                        Select one
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {colors.map(
                      (
                        colour
                      ) => {
                        const swatch =
                          getColourSwatch(
                            colour
                          );

                        const selected =
                          selectedColor ===
                          colour;

                        return (
                          <button
                            key={
                              colour
                            }
                            type="button"
                            onClick={() => {
                              setSelectedColor(
                                colour
                              );

                              setVariantError(
                                ""
                              );
                            }}
                            className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[11px] font-black transition ${
                              selected
                                ? "border-[#4A1724] bg-white text-[#4A1724] ring-1 ring-[#4A1724]"
                                : "border-slate-200 bg-white text-slate-700"
                            }`}
                          >
                            {swatch ? (
                              <span
                                className="h-3.5 w-3.5 rounded-full border border-black/15"
                                style={{
                                  backgroundColor:
                                    swatch,
                                }}
                              />
                            ) : (
                              <span className="h-3.5 w-3.5 rounded-full bg-gradient-to-br from-slate-200 to-slate-400 ring-1 ring-black/10" />
                            )}

                            {
                              colour
                            }
                          </button>
                        );
                      }
                    )}
                  </div>
                </div>
              ) : null}
            </section>
          ) : null}

          {variantError ? (
            <p
              role="alert"
              className="mt-2.5 text-xs font-bold text-red-600"
            >
              {
                variantError
              }
            </p>
          ) : null}

          {/*
           * =================================================
           * PRIMARY ACTION
           * =================================================
           */}

          <div className="mt-4">
            <button
              type="button"
              disabled={
                ownListing
              }
              onClick={
                handleAddToCart
              }
              className="flex min-h-12 w-full items-center justify-center rounded-xl bg-accent-400 px-5 text-sm font-black text-black transition hover:bg-accent-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
            >
              {ownListing
                ? "This is your listing"
                : added
                  ? "Added to cart ✓"
                  : "Add to cart"}
            </button>

            {!ownListing ? (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Link
                  href="/cart"
                  className="flex min-h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-700 transition hover:border-slate-400"
                >
                  View cart
                </Link>

                {product.vendorId ? (
                  <button
                    type="button"
                    onClick={() =>
                      void handleMessageSeller()
                    }
                    disabled={
                      openingMessages
                    }
                    className="min-h-10 rounded-xl border border-[#4A1724] bg-white px-4 text-xs font-black text-[#4A1724] transition disabled:opacity-50"
                  >
                    {openingMessages
                      ? "Opening..."
                      : "Message seller"}
                  </button>
                ) : (
                  <span />
                )}
              </div>
            ) : null}
          </div>

          {!ownListing && (
            <Link href={`/report?targetType=product&targetId=${product.id}`} className="mt-3 inline-block text-xs font-semibold text-slate-500 underline underline-offset-2 hover:text-red-700">
              Report this listing
            </Link>
          )}

          {/*
           * =================================================
           * COLLAPSED DETAILS
           * =================================================
           */}

          <details className="mt-3 rounded-xl border border-slate-200 bg-white">
            <summary className="cursor-pointer list-none px-4 py-3 text-xs font-black text-slate-700">
              Product details{" "}
              <span className="ml-1 text-slate-400">
                +
              </span>
            </summary>

            <div className="border-t border-slate-100 px-4 py-3">
              <p className="text-sm leading-6 text-slate-600">
                {
                  product.description
                }
              </p>
            </div>
          </details>

          {/*
           * =================================================
           * MESSAGE COMPOSER
           * =================================================
           */}

          {messageComposerOpen &&
          !ownListing ? (
            <form
              onSubmit={
                startSellerConversation
              }
              className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-black">
                  Message{" "}
                  {
                    sellerName
                  }
                </p>

                <button
                  type="button"
                  onClick={() => {
                    setMessageComposerOpen(
                      false
                    );

                    setMessageError(
                      ""
                    );
                  }}
                  className="text-lg font-black text-slate-400"
                >
                  ×
                </button>
              </div>

              <textarea
                rows={
                  3
                }
                maxLength={
                  MESSAGE_MAX_LENGTH
                }
                value={
                  messageDraft
                }
                onChange={(
                  event
                ) => {
                  setMessageDraft(
                    event.target.value
                  );

                  if (
                    messageError
                  ) {
                    setMessageError(
                      ""
                    );
                  }
                }}
                placeholder="Hi, is this still available?"
                className="mt-3 w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-[#4A1724]"
              />

              <div className="mt-1 flex justify-between gap-3 text-[9px] text-slate-400">
                <span>
                  {
                    messageDraft.length
                  }
                  /
                  {
                    MESSAGE_MAX_LENGTH
                  }
                </span>

                <span>
                  Contact details may be hidden
                </span>
              </div>

              {messageError ? (
                <p className="mt-2 text-xs font-bold text-red-600">
                  {
                    messageError
                  }
                </p>
              ) : null}

              <button
                type="submit"
                disabled={
                  sendingMessage ||
                  !messageDraft.trim()
                }
                className="mt-3 rounded-lg bg-slate-950 px-4 py-2.5 text-xs font-black text-white disabled:opacity-50"
              >
                {sendingMessage
                  ? "Sending..."
                  : "Send message"}
              </button>
            </form>
          ) : null}

          {messageError &&
          !messageComposerOpen ? (
            <p className="mt-3 text-xs font-bold text-red-600">
              {
                messageError
              }
            </p>
          ) : null}
        </div>
      </section>

      {/*
       * =====================================================
       * RELATED
       * =====================================================
       */}

      {relatedProducts.length >
      0 ? (
        <section className="mt-8 border-t border-slate-200 pt-5">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#8A6670]">
                Keep exploring
              </p>

              <h2 className="mt-1 text-lg font-black text-slate-950">
                You may also like
              </h2>
            </div>

            <Link
              href="/marketplace"
              className="text-[11px] font-black text-slate-500 transition hover:text-black"
            >
              Shop all →
            </Link>
          </div>

          <div className="mt-3">
            <AutoScrollProducts
              products={
                relatedProducts
              }
              size="small"
            />
          </div>
        </section>
      ) : null}

      {/*
       * =====================================================
       * REVIEWS
       * =====================================================
       */}

      <section className="mt-8 border-t border-slate-200 pt-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-[#8A6670]">
              Verified purchases
            </p>

            <h2 className="mt-1 text-lg font-black text-slate-950">
              Reviews
            </h2>
          </div>

          <p className="text-[11px] font-bold text-slate-500">
            {reviewCount}{" "}
            {reviewCount ===
            1
              ? "review"
              : "reviews"}
          </p>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[0.7fr_1.3fr]">
          <div>
            {!user ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-black">
                  Bought this product?
                </p>

                <p className="mt-1.5 text-xs leading-5 text-slate-500">
                  Sign in to check whether your completed purchase can be reviewed.
                </p>

                <button
                  type="button"
                  onClick={() =>
                    openAuth(
                      "login"
                    )
                  }
                  className="mt-3 rounded-lg bg-accent-400 px-4 py-2.5 text-xs font-black"
                >
                  Sign in
                </button>
              </div>
            ) : reviewEligibility
                ?.canReview ? (
              <form
                onSubmit={
                  postReview
                }
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
              >
                <h3 className="text-sm font-black">
                  Leave a review
                </h3>

                <select
                  value={
                    reviewRating
                  }
                  onChange={(
                    event
                  ) =>
                    setReviewRating(
                      Number(
                        event.target.value
                      )
                    )
                  }
                  className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold"
                >
                  <option value="5">
                    5 — Excellent
                  </option>

                  <option value="4">
                    4 — Good
                  </option>

                  <option value="3">
                    3 — Average
                  </option>

                  <option value="2">
                    2 — Below average
                  </option>

                  <option value="1">
                    1 — Poor
                  </option>
                </select>

                <textarea
                  rows={
                    3
                  }
                  maxLength={
                    1000
                  }
                  value={
                    reviewComment
                  }
                  onChange={(
                    event
                  ) =>
                    setReviewComment(
                      event.target.value
                    )
                  }
                  placeholder="How was the item?"
                  className="mt-2.5 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm"
                />

                {reviewError ? (
                  <p className="mt-2 text-xs font-bold text-red-600">
                    {
                      reviewError
                    }
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={
                    postingReview
                  }
                  className="mt-2.5 rounded-lg bg-accent-400 px-4 py-2.5 text-xs font-black disabled:opacity-50"
                >
                  {postingReview
                    ? "Posting..."
                    : "Post review"}
                </button>
              </form>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-black">
                  {reviewEligibility?.reason ===
                  "already_reviewed"
                    ? "Review submitted"
                    : reviewEligibility?.reason ===
                        "wait_period"
                      ? "Review unlocks soon"
                      : "Completed purchase required"}
                </p>

                <p className="mt-1.5 text-xs leading-5 text-slate-500">
                  {reviewEligibility?.reason ===
                  "already_reviewed"
                    ? "You have already reviewed this product."
                    : reviewEligibility?.reason ===
                        "wait_period"
                      ? `Reviews unlock 6 hours after fulfilment is completed.${
                          reviewEligibility.eligibleAt
                            ? ` You can review from ${formatEligibilityTime(
                                reviewEligibility.eligibleAt
                              )}.`
                            : ""
                        }`
                      : "Only a buyer who completed an order for this product can leave a review."}
                </p>
              </div>
            )}
          </div>

          <div className="space-y-2.5">
            {visibleReviews.length >
            0 ? (
              visibleReviews.map(
                (
                  review
                ) => (
                  <article
                    key={
                      review.id
                    }
                    className="rounded-2xl border border-slate-200 bg-white p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-black">
                        {
                          review.author.name
                        }
                      </p>

                      <span className="text-xs font-black text-[#7A4B00]">
                        {"★".repeat(
                          review.rating
                        )}
                        {"☆".repeat(
                          5 -
                            review.rating
                        )}
                      </span>
                    </div>

                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {
                        review.comment
                      }
                    </p>
                  </article>
                )
              )
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 p-5 text-sm text-slate-500">
                No verified-purchase reviews yet.
              </div>
            )}

            {reviews.length >
            3 ? (
              <button
                type="button"
                onClick={() =>
                  setShowAllReviews(
                    (
                      current
                    ) =>
                      !current
                  )
                }
                className="text-xs font-black text-[#4A1724] underline underline-offset-3"
              >
                {showAllReviews
                  ? "Show fewer reviews"
                  : `Show all ${reviews.length} reviews`}
              </button>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}