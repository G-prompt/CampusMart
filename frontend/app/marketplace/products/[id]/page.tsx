"use client";

import {
    FormEvent,
    useEffect,
    useState,
} from "react";

import Link from "next/link";
import Image from "next/image";

import {
    useRouter,
} from "next/navigation";

import {
    useCart,
} from "@/components/common/CartContext";

import {
    ChevronRightIcon,
} from "@/components/common/icons";

import ProductCard from "@/components/common/ProductCard";

import {
    useAuth,
} from "@/components/common/AuthContext";

import {
    formatNaira,
    type Product,
} from "@/lib/products";

import {
    addReview,
    getAverageRating,
    getReviews,
    type ProductReview,
} from "@/lib/reviews";

const MESSAGE_MAX_LENGTH =
    2000;

type ProductWithVendor =
    Product & {
        vendorId?: string;
    };

type SellerStorefront = {
    sellerId: string;

    ownerName: string;

    businessName: string;

    description: string;

    university:
        | {
              id:
                  | string
                  | null;

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

              managed: boolean;
          }
        | null;

    badges: {
        studentVerified:
            boolean;

        vendorVerified:
            boolean;
    };

    memberSince: string;

    listingCount: number;
};

type ExistingConversation = {
    id: string;

    contextType:
        | "general"
        | "listing"
        | "order";

    product:
        | {
              id: number;
          }
        | null;

    otherParty: {
        id: string;
    };
};

export default function ProductPage({
    params,
}: {
    params: {
        id: string;
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
        useState<ProductWithVendor | null>(
            null
        );

    const [
        allProducts,
        setAllProducts,
    ] =
        useState<Product[]>(
            []
        );

    const [
        recentProducts,
        setRecentProducts,
    ] =
        useState<Product[]>(
            []
        );

    const [
        sellerStorefront,
        setSellerStorefront,
    ] =
        useState<SellerStorefront | null>(
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
        useState<ProductReview[]>(
            []
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

    /*
     * =====================================================
     * MESSAGING
     * =====================================================
     */

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

    const apiUrl =
        process.env.NEXT_PUBLIC_API_URL ||
        "http://localhost:5000";

    /*
     * =====================================================
     * LOAD PRODUCT + PUBLIC MARKETPLACE PRODUCTS
     * =====================================================
     */

    useEffect(() => {
        let active =
            true;

        const loadProduct =
            async () => {
                try {
                    setLoading(
                        true
                    );

                    setError(
                        ""
                    );

                    setSellerStorefront(
                        null
                    );

                    const productResponse =
                        await fetch(
                            `${apiUrl}/api/products/${params.id}`,
                            {
                                cache:
                                    "no-store",
                            }
                        );

                    const productData =
                        await productResponse.json();

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

                    /*
                     * Load the seller storefront independently.
                     *
                     * A storefront failure must not break the
                     * product page.
                     */

                    if (
                        loadedProduct.vendorId
                    ) {
                        try {
                            const storefrontResponse =
                                await fetch(
                                    `${apiUrl}/api/vendor/storefront/${encodeURIComponent(
                                        loadedProduct.vendorId
                                    )}`,
                                    {
                                        cache:
                                            "no-store",
                                    }
                                );

                            const storefrontData =
                                await storefrontResponse.json();

                            if (
                                storefrontResponse.ok &&
                                storefrontData.success &&
                                storefrontData.storefront &&
                                active
                            ) {
                                setSellerStorefront(
                                    storefrontData.storefront
                                );
                            }
                        } catch (
                            storefrontError
                        ) {
                            console.error(
                                "Seller storefront lookup error:",
                                storefrontError
                            );
                        }
                    }

                    const productsResponse =
                        await fetch(
                            `${apiUrl}/api/products`,
                            {
                                cache:
                                    "no-store",
                            }
                        );

                    const productsData =
                        await productsResponse.json();

                    if (
                        productsResponse.ok &&
                        productsData.success &&
                        active
                    ) {
                        setAllProducts(
                            Array.isArray(
                                productsData.products
                            )
                                ? productsData.products
                                : []
                        );
                    }
                } catch (
                    err
                ) {
                    console.error(
                        "Product page error:",
                        err
                    );

                    if (
                        active
                    ) {
                        setError(
                            "Unable to load this listing."
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

        void loadProduct();

        return () => {
            active =
                false;
        };
    }, [
        apiUrl,
        params.id,
    ]);

    /*
     * =====================================================
     * RECENTLY VIEWED
     * =====================================================
     */

    useEffect(() => {
        if (
            !product
        ) {
            return;
        }

        const recent =
            JSON.parse(
                localStorage.getItem(
                    "campusmart-recent-products"
                ) ??
                    "[]"
            ) as number[];

        const nextRecent =
            [
                product.id,

                ...recent.filter(
                    (
                        id
                    ) =>
                        id !==
                        product.id
                ),
            ].slice(
                0,
                6
            );

        localStorage.setItem(
            "campusmart-recent-products",
            JSON.stringify(
                nextRecent
            )
        );

        const resolved =
            nextRecent
                .map(
                    (
                        id
                    ) =>
                        allProducts.find(
                            (
                                item
                            ) =>
                                item.id ===
                                id
                        )
                )
                .filter(
                    (
                        item
                    ): item is Product =>
                        Boolean(
                            item
                        )
                );

        setRecentProducts(
            resolved
        );
    }, [
        product,
        allProducts,
    ]);

    /*
     * =====================================================
     * REVIEWS
     * =====================================================
     */

    useEffect(() => {
        if (
            !product
        ) {
            return;
        }

        const loadReviews =
            () => {
                setReviews(
                    getReviews(
                        product.id
                    )
                );
            };

        loadReviews();

        window.addEventListener(
            "campusmart-reviews-change",
            loadReviews
        );

        return () => {
            window.removeEventListener(
                "campusmart-reviews-change",
                loadReviews
            );
        };
    }, [
        product,
    ]);

    /*
     * =====================================================
     * OPEN / START LISTING CONVERSATION
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
                !product?.vendorId
            ) {
                setMessageError(
                    "Messaging is not available for this seller."
                );

                return;
            }

            if (
                user.id ===
                product.vendorId
            ) {
                setMessageError(
                    "You cannot message your own listing."
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
                    "Your session is unavailable. Sign in again to message the seller."
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

                /*
                 * Look for an existing canonical listing
                 * conversation first.
                 *
                 * If one exists, open it without creating
                 * another thread or sending an unwanted
                 * message.
                 */

                const response =
                    await fetch(
                        `${apiUrl}/api/messages/conversations`,
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

                const existingConversation =
                    conversations.find(
                        (
                            conversation
                        ) =>
                            conversation.contextType ===
                                "listing" &&
                            conversation.product
                                ?.id ===
                                product.id &&
                            conversation.otherParty
                                ?.id ===
                                product.vendorId
                    );

                if (
                    existingConversation
                ) {
                    router.push(
                        `/messages/${existingConversation.id}`
                    );

                    return;
                }

                /*
                 * No conversation exists yet.
                 *
                 * Show the composer. We deliberately do
                 * not create empty message threads.
                 */

                setMessageComposerOpen(
                    true
                );
            } catch (
                messagingError
            ) {
                console.error(
                    "Open seller messaging error:",
                    messagingError
                );

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

    /*
     * =====================================================
     * SEND FIRST LISTING MESSAGE
     * =====================================================
     */

    const startSellerConversation =
        async (
            event:
                FormEvent<HTMLFormElement>
        ) => {
            event.preventDefault();

            if (
                !user ||
                !product?.vendorId ||
                sendingMessage
            ) {
                return;
            }

            if (
                user.id ===
                product.vendorId
            ) {
                setMessageError(
                    "You cannot message your own listing."
                );

                return;
            }

            const body =
                messageDraft.trim();

            if (
                !body
            ) {
                setMessageError(
                    "Write a message to the seller first."
                );

                return;
            }

            if (
                body.length >
                MESSAGE_MAX_LENGTH
            ) {
                setMessageError(
                    `Messages can be up to ${MESSAGE_MAX_LENGTH} characters.`
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
                    "Your session is unavailable. Sign in again to message the seller."
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
                        `${apiUrl}/api/messages/conversations`,
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
                    if (
                        data.code ===
                        "MESSAGING_TEMPORARILY_RESTRICTED"
                    ) {
                        throw new Error(
                            data.message ||
                                "Messaging is temporarily restricted. You can still read your existing conversations."
                        );
                    }

                    if (
                        data.code ===
                            "OFF_PLATFORM_ATTEMPT_BLOCKED" ||
                        data.moderation
                            ?.action ===
                            "blocked"
                    ) {
                        throw new Error(
                            data.message ||
                                "That message was not sent because it appears to move the conversation off CampusMart."
                        );
                    }

                    throw new Error(
                        data.message ||
                            "Unable to send your message."
                    );
                }

                const conversationId =
                    data.conversation
                        ?.id;

                if (
                    !conversationId
                ) {
                    throw new Error(
                        "The conversation was created, but CampusMart could not open it."
                    );
                }

                if (
                    data.moderation
                        ?.action ===
                    "redacted"
                ) {
                    window.dispatchEvent(
                        new CustomEvent(
                            "campusmart-toast",
                            {
                                detail: {
                                    message:
                                        "Message sent. Contact details were hidden to keep the conversation on CampusMart.",
                                },
                            }
                        )
                    );
                } else {
                    window.dispatchEvent(
                        new CustomEvent(
                            "campusmart-toast",
                            {
                                detail: {
                                    message:
                                        "Message sent",
                                },
                            }
                        )
                    );
                }

                setMessageDraft(
                    ""
                );

                setMessageComposerOpen(
                    false
                );

                router.push(
                    `/messages/${conversationId}`
                );
            } catch (
                messagingError
            ) {
                console.error(
                    "Start seller conversation error:",
                    messagingError
                );

                setMessageError(
                    messagingError instanceof
                        Error
                        ? messagingError.message
                        : "Unable to send your message."
                );
            } finally {
                setSendingMessage(
                    false
                );
            }
        };

    /*
     * =====================================================
     * LOADING
     * =====================================================
     */

    if (
        loading
    ) {
        return (
            <main className="main-container py-16 text-center">
                <p className="text-sm text-slate-600">
                    Loading listing...
                </p>
            </main>
        );
    }

    /*
     * =====================================================
     * PRODUCT UNAVAILABLE
     * =====================================================
     */

    if (
        error ||
        !product
    ) {
        return (
            <main className="main-container py-16 text-center">
                <h1 className="text-2xl font-bold text-black">
                    Product not found
                </h1>

                <p className="mt-3 text-sm text-slate-600">
                    This listing may
                    have been archived
                    or is currently
                    unavailable.
                </p>

                <Link
                    href="/marketplace"
                    className="mt-6 inline-flex items-center justify-center rounded-[10px] bg-black px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
                >
                    Back to marketplace
                </Link>
            </main>
        );
    }

    /*
     * =====================================================
     * PAGE DATA
     * =====================================================
     */

    const handleAddToCart =
        () => {
            addToCart(
                product
            );

            setAdded(
                true
            );

            window.setTimeout(
                () =>
                    setAdded(
                        false
                    ),
                1800
            );
        };

    const currentImage =
        product.images[
            activeImage
        ];

    const relatedProducts =
        allProducts
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
                4
            );

    const sellerName =
        sellerStorefront
            ?.businessName ||
        product.seller;

    const sellerUniversity =
        sellerStorefront
            ?.university;

    const sellerUniversityLabel =
        sellerUniversity
            ? sellerUniversity.shortName ||
              sellerUniversity.name
            : "";

    const sellerLocation =
        sellerUniversity
            ? [
                  sellerUniversity.city,
                  sellerUniversity.state,
              ]
                  .filter(
                      Boolean
                  )
                  .join(
                      ", "
                  )
            : "";

    const sellerHref =
        product.vendorId
            ? `/seller/${product.vendorId}`
            : null;

    const averageRating =
        getAverageRating(
            product.id,
            product.rating
        );

    const ownListing =
        Boolean(
            user &&
                product.vendorId &&
                user.id ===
                    product.vendorId
        );

    return (
        <main className="main-container py-10 sm:py-12 lg:py-14">
            {/*
             * =================================================
             * BREADCRUMB
             * =================================================
             */}

            <nav
                className="flex items-center gap-1 text-sm font-semibold text-slate-500"
                aria-label="Breadcrumb"
            >
                <Link
                    href="/marketplace"
                    className="transition hover:text-black"
                >
                    Marketplace
                </Link>

                <ChevronRightIcon className="h-3.5 w-3.5" />

                <span className="text-black">
                    {
                        product.category
                    }
                </span>
            </nav>

            {/*
             * =================================================
             * PRODUCT
             * =================================================
             */}

            <div className="mt-6 grid gap-10 lg:grid-cols-2">
                {/*
                 * IMAGE GALLERY
                 */}

                <div>
                    <div className="relative aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                        {currentImage ? (
                            <Image
                                src={
                                    currentImage
                                }
                                alt={
                                    product.title
                                }
                                fill
                                sizes="(max-width: 1024px) 100vw, 50vw"
                                className="object-cover"
                                priority
                            />
                        ) : (
                            <div className="flex h-full items-center justify-center bg-slate-900 px-6 text-center text-sm font-semibold text-white">
                                CampusMart
                                listing image
                            </div>
                        )}
                    </div>

                    {product.images
                        .length >
                    1 ? (
                        <div className="mt-3 flex gap-3 overflow-x-auto">
                            {product.images.map(
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
                                        className={`relative h-20 w-20 shrink-0 overflow-hidden rounded-[10px] border-2 transition ${
                                            index ===
                                            activeImage
                                                ? "border-accent-400"
                                                : "border-transparent"
                                        }`}
                                        aria-label={`Show image ${
                                            index +
                                            1
                                        }`}
                                    >
                                        <Image
                                            src={
                                                image
                                            }
                                            alt=""
                                            fill
                                            sizes="80px"
                                            className="object-cover"
                                        />
                                    </button>
                                )
                            )}
                        </div>
                    ) : null}
                </div>

                {/*
                 * PRODUCT INFORMATION
                 */}

                <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                        {
                            product.category
                        }
                    </p>

                    <h1 className="mt-2 text-3xl font-bold tracking-tight text-black">
                        {
                            product.title
                        }
                    </h1>

                    <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                        <span className="inline-flex items-center gap-1 font-semibold text-black">
                            <svg
                                viewBox="0 0 24 24"
                                fill="currentColor"
                                className="h-4 w-4 text-accent-500"
                                aria-hidden="true"
                            >
                                <path d="M12 2.5l2.9 6.16 6.6.72-4.9 4.6 1.28 6.52L12 17.3l-5.88 3.2 1.28-6.52-4.9-4.6 6.6-.72L12 2.5Z" />
                            </svg>

                            {averageRating.toFixed(
                                1
                            )}
                        </span>

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
                                    className="font-bold text-black underline decoration-slate-300 underline-offset-4 transition hover:decoration-black"
                                >
                                    {
                                        sellerName
                                    }
                                </Link>
                            ) : (
                                <span className="font-bold text-black">
                                    {
                                        sellerName
                                    }
                                </span>
                            )}
                        </span>
                    </div>

                    {/*
                     * SELLER + EXCHANGE CARDS
                     */}

                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                        {sellerHref ? (
                            <Link
                                href={
                                    sellerHref
                                }
                                className="group rounded-xl border border-slate-200 bg-slate-50 p-4 transition hover:border-slate-400 hover:bg-white"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                                            Seller
                                        </p>

                                        <p className="mt-2 font-bold text-slate-950">
                                            {
                                                sellerName
                                            }
                                        </p>
                                    </div>

                                    <span className="text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-black">
                                        →
                                    </span>
                                </div>

                                {sellerStorefront ? (
                                    <>
                                        <div className="mt-3 flex flex-wrap gap-1.5">
                                            {sellerStorefront
                                                .badges
                                                .studentVerified ? (
                                                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                                                    Verified
                                                    student
                                                </span>
                                            ) : null}

                                            {sellerStorefront
                                                .badges
                                                .vendorVerified ? (
                                                <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700">
                                                    Verified
                                                    vendor
                                                </span>
                                            ) : null}
                                        </div>

                                        {sellerUniversityLabel ? (
                                            <p className="mt-3 text-sm text-slate-600">
                                                {
                                                    sellerUniversityLabel
                                                }
                                                {sellerLocation
                                                    ? ` · ${sellerLocation}`
                                                    : ""}
                                            </p>
                                        ) : null}

                                        <p className="mt-2 text-xs font-semibold text-slate-500">
                                            {
                                                sellerStorefront.listingCount
                                            }{" "}
                                            active{" "}
                                            {sellerStorefront.listingCount ===
                                            1
                                                ? "listing"
                                                : "listings"}
                                        </p>
                                    </>
                                ) : (
                                    <p className="mt-2 text-sm text-slate-600">
                                        View seller
                                        storefront
                                        and other
                                        listings.
                                    </p>
                                )}
                            </Link>
                        ) : (
                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                                <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                                    Seller
                                </p>

                                <p className="mt-2 font-bold text-slate-950">
                                    {
                                        sellerName
                                    }
                                </p>
                            </div>
                        )}

                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                                Exchange
                            </p>

                            <p className="mt-2 font-bold text-slate-950">
                                Campus
                                pickup
                            </p>

                            <p className="mt-1 text-sm leading-6 text-slate-600">
                                Arrange
                                pickup
                                details
                                through
                                your
                                CampusMart
                                order.
                            </p>
                        </div>
                    </div>

                    <p className="mt-6 text-3xl font-bold text-black">
                        {formatNaira(
                            product.price
                        )}
                    </p>

                    <p className="mt-6 text-[15px] leading-7 text-slate-600">
                        {
                            product.description
                        }
                    </p>

                    {/*
                     * =================================================
                     * PURCHASE ACTIONS
                     * =================================================
                     */}

                    <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                        <button
                            type="button"
                            onClick={
                                handleAddToCart
                            }
                            className="inline-flex flex-1 items-center justify-center rounded-[10px] bg-accent-400 px-6 py-3.5 text-base font-bold text-black transition hover:bg-accent-500"
                        >
                            {added
                                ? "Added to cart ✓"
                                : "Add to cart"}
                        </button>

                        <Link
                            href="/cart"
                            className="inline-flex flex-1 items-center justify-center rounded-[10px] border border-slate-200 bg-white px-6 py-3.5 text-base font-bold text-black transition hover:bg-slate-50"
                        >
                            View cart
                        </Link>
                    </div>

                    {/*
                     * =================================================
                     * MESSAGE SELLER
                     * =================================================
                     */}

                    {product.vendorId ? (
                        <div className="mt-3">
                            <button
                                type="button"
                                disabled={
                                    openingMessages ||
                                    ownListing
                                }
                                onClick={() =>
                                    void handleMessageSeller()
                                }
                                className="inline-flex w-full items-center justify-center rounded-[10px] border border-slate-900 bg-white px-6 py-3.5 text-base font-bold text-slate-950 transition hover:bg-slate-950 hover:text-white disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                            >
                                {ownListing
                                    ? "This is your listing"
                                    : openingMessages
                                      ? "Opening messages..."
                                      : "Message seller"}
                            </button>

                            {!ownListing ? (
                                <p className="mt-2 text-center text-xs leading-5 text-slate-500">
                                    Ask about
                                    availability,
                                    condition or
                                    campus pickup
                                    before ordering.
                                </p>
                            ) : null}
                        </div>
                    ) : null}

                    {/*
                     * =================================================
                     * FIRST MESSAGE COMPOSER
                     * =================================================
                     */}

                    {messageComposerOpen &&
                    !ownListing ? (
                        <form
                            onSubmit={
                                startSellerConversation
                            }
                            className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:p-5"
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                                        Message seller
                                    </p>

                                    <h2 className="mt-1 text-lg font-black text-slate-950">
                                        Ask about{" "}
                                        {
                                            product.title
                                        }
                                    </h2>
                                </div>

                                <button
                                    type="button"
                                    disabled={
                                        sendingMessage
                                    }
                                    onClick={() => {
                                        setMessageComposerOpen(
                                            false
                                        );

                                        setMessageError(
                                            ""
                                        );
                                    }}
                                    className="shrink-0 rounded-full px-2 py-1 text-lg font-bold text-slate-400 transition hover:bg-slate-200 hover:text-black disabled:cursor-not-allowed disabled:opacity-50"
                                    aria-label="Close message composer"
                                >
                                    ×
                                </button>
                            </div>

                            <textarea
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
                                rows={
                                    4
                                }
                                maxLength={
                                    MESSAGE_MAX_LENGTH
                                }
                                disabled={
                                    sendingMessage
                                }
                                placeholder="Hi, is this still available?"
                                className="mt-4 w-full resize-y rounded-[10px] border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                            />

                            <div className="mt-2 flex items-center justify-between gap-3">
                                <p className="text-[11px] text-slate-400">
                                    {
                                        messageDraft.length
                                    }
                                    /
                                    {
                                        MESSAGE_MAX_LENGTH
                                    }
                                </p>

                                <p className="text-[11px] text-slate-400">
                                    Contact details may
                                    be hidden.
                                </p>
                            </div>

                            {messageError ? (
                                <div
                                    role="alert"
                                    className="mt-3 rounded-[10px] border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-semibold leading-5 text-red-700"
                                >
                                    {
                                        messageError
                                    }
                                </div>
                            ) : null}

                            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                                <button
                                    type="submit"
                                    disabled={
                                        sendingMessage ||
                                        !messageDraft.trim()
                                    }
                                    className="inline-flex flex-1 items-center justify-center rounded-[10px] bg-slate-950 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {sendingMessage
                                        ? "Sending..."
                                        : "Send message"}
                                </button>

                                <button
                                    type="button"
                                    disabled={
                                        sendingMessage
                                    }
                                    onClick={() => {
                                        setMessageComposerOpen(
                                            false
                                        );

                                        setMessageError(
                                            ""
                                        );
                                    }}
                                    className="inline-flex items-center justify-center rounded-[10px] border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    ) : null}

                    {/*
                     * Message errors may also happen while
                     * checking for an existing thread.
                     */}

                    {messageError &&
                    !messageComposerOpen ? (
                        <div
                            role="alert"
                            className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"
                        >
                            {
                                messageError
                            }
                        </div>
                    ) : null}

                    <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm leading-7 text-slate-600">
                        Complete your
                        order through
                        CampusMart so
                        the purchase,
                        seller
                        fulfilment and
                        order history
                        remain recorded
                        on the
                        platform.
                    </div>
                </div>
            </div>

            {/*
             * =================================================
             * REVIEWS
             * =================================================
             */}

            <section className="mt-16 border-t border-slate-200 pt-10">
                <div className="flex flex-wrap items-end justify-between gap-4">
                    <div>
                        <p className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500">
                            Customer
                            reviews
                        </p>

                        <h2 className="mt-2 text-2xl font-bold text-black">
                            What buyers
                            are saying
                        </h2>
                    </div>

                    <p className="text-sm font-semibold text-slate-600">
                        {
                            reviews.length
                        }{" "}
                        review
                        {reviews.length ===
                        1
                            ? ""
                            : "s"}
                    </p>
                </div>

                <div className="mt-6 grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
                    <form
                        onSubmit={(
                            event
                        ) => {
                            event.preventDefault();

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
                                user.role !==
                                "client"
                            ) {
                                setReviewError(
                                    "Only client accounts can leave product reviews."
                                );

                                return;
                            }

                            if (
                                !reviewComment.trim()
                            ) {
                                setReviewError(
                                    "Write a short comment before submitting."
                                );

                                return;
                            }

                            addReview({
                                productId:
                                    product.id,

                                author:
                                    user.name,

                                rating:
                                    reviewRating,

                                comment:
                                    reviewComment.trim(),
                            });

                            setReviewComment(
                                ""
                            );

                            setReviewRating(
                                5
                            );

                            setReviewError(
                                ""
                            );
                        }}
                        className="site-card space-y-4 p-5"
                    >
                        <h3 className="text-lg font-bold text-slate-950">
                            Leave a
                            review
                        </h3>

                        <label className="block text-sm font-semibold text-slate-700">
                            Rating

                            <select
                                value={
                                    reviewRating
                                }
                                onChange={(
                                    event
                                ) =>
                                    setReviewRating(
                                        Number(
                                            event
                                                .target
                                                .value
                                        )
                                    )
                                }
                                className="mt-2 w-full rounded-[10px] border border-slate-200 bg-slate-50 px-3 py-3 text-slate-900"
                            >
                                <option value="5">
                                    5 -
                                    Excellent
                                </option>

                                <option value="4">
                                    4 -
                                    Good
                                </option>

                                <option value="3">
                                    3 -
                                    Average
                                </option>

                                <option value="2">
                                    2 -
                                    Below
                                    average
                                </option>

                                <option value="1">
                                    1 -
                                    Poor
                                </option>
                            </select>
                        </label>

                        <label className="block text-sm font-semibold text-slate-700">
                            Comment

                            <textarea
                                value={
                                    reviewComment
                                }
                                onChange={(
                                    event
                                ) =>
                                    setReviewComment(
                                        event
                                            .target
                                            .value
                                    )
                                }
                                rows={4}
                                className="mt-2 w-full resize-y rounded-[10px] border border-slate-200 bg-slate-50 px-3 py-3 text-slate-900"
                                placeholder="Share your experience with this product."
                            />
                        </label>

                        {reviewError ? (
                            <p
                                className="text-sm font-semibold text-red-600"
                                role="alert"
                            >
                                {
                                    reviewError
                                }
                            </p>
                        ) : null}

                        <button
                            type="submit"
                            className="rounded-[10px] bg-accent-400 px-4 py-3 text-sm font-bold text-black"
                        >
                            {user
                                ? "Post review"
                                : "Sign in to review"}
                        </button>
                    </form>

                    <div className="space-y-3">
                        {reviews.length ? (
                            reviews.map(
                                (
                                    review
                                ) => (
                                    <article
                                        key={
                                            review.id
                                        }
                                        className="rounded-xl border border-slate-200 p-5"
                                    >
                                        <div className="flex items-center justify-between gap-3">
                                            <p className="font-bold text-slate-950">
                                                {
                                                    review.author
                                                }
                                            </p>

                                            <span className="text-sm font-bold text-slate-600">
                                                {"★".repeat(
                                                    review.rating
                                                )}

                                                {"☆".repeat(
                                                    5 -
                                                        review.rating
                                                )}
                                            </span>
                                        </div>

                                        <p className="mt-3 text-sm leading-7 text-slate-600">
                                            {
                                                review.comment
                                            }
                                        </p>
                                    </article>
                                )
                            )
                        ) : (
                            <p className="rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-600">
                                No reviews
                                yet. Be the
                                first client
                                to share
                                your
                                experience.
                            </p>
                        )}
                    </div>
                </div>
            </section>

            {/*
             * =================================================
             * RELATED PRODUCTS
             * =================================================
             */}

            {relatedProducts.length >
            0 ? (
                <section className="mt-16 border-t border-slate-200 pt-10">
                    <p className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500">
                        Keep exploring
                    </p>

                    <h2 className="mt-2 text-2xl font-bold text-black">
                        You may also
                        like
                    </h2>

                    <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                        {relatedProducts.map(
                            (
                                item
                            ) => (
                                <ProductCard
                                    key={
                                        item.id
                                    }
                                    product={
                                        item
                                    }
                                />
                            )
                        )}
                    </div>
                </section>
            ) : null}

            {/*
             * =================================================
             * RECENTLY VIEWED
             * =================================================
             */}

            {recentProducts.filter(
                (
                    item
                ) =>
                    item.id !==
                    product.id
            ).length >
            0 ? (
                <section className="mt-16 border-t border-slate-200 pt-10">
                    <p className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500">
                        Your trail
                    </p>

                    <h2 className="mt-2 text-2xl font-bold text-black">
                        Recently viewed
                    </h2>

                    <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                        {recentProducts
                            .filter(
                                (
                                    item
                                ) =>
                                    item.id !==
                                    product.id
                            )
                            .slice(
                                0,
                                4
                            )
                            .map(
                                (
                                    item
                                ) => (
                                    <ProductCard
                                        key={
                                            item.id
                                        }
                                        product={
                                            item
                                        }
                                    />
                                )
                            )}
                    </div>
                </section>
            ) : null}
        </main>
    );
}