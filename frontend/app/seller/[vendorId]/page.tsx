"use client";

import Link from "next/link";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";

import {
  useParams,
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

const MESSAGE_MAX_LENGTH =
  2000;

type StorefrontUniversity = {
  id:
    | string
    | null;

  name:
    string;

  shortName:
    | string
    | null;

  state:
    | string
    | null;

  city:
    | string
    | null;

  managed:
    boolean;
};

type Storefront = {
  sellerId:
    string;

  ownerName:
    string;

  businessName:
    string;

  description:
    string;

  university:
    | StorefrontUniversity
    | null;

  badges: {
    studentVerified:
      boolean;

    vendorVerified:
      boolean;
  };

  memberSince:
    string;

  listingCount:
    number;
};

type StorefrontProduct = {
  id:
    number;

  slug:
    string;

  title:
    string;

  category:
    string;

  price:
    number;

  rating:
    number;

  description:
    string;

  images:
    string[];

  createdAt:
    string;
};

type StorefrontResponse = {
  success:
    boolean;

  storefront?:
    Storefront;

  products?:
    StorefrontProduct[];

  message?:
    string;
};

type ExistingConversation = {
  id:
    string;

  contextType:
    | "general"
    | "listing"
    | "order";

  otherParty: {
    id: string;
  };
};

function formatMemberSince(
  value:
    string
) {
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

  return date.toLocaleDateString(
    "en-GB",
    {
      month:
        "short",

      year:
        "numeric",
    }
  );
}

function sellerInitials(
  value:
    string
) {
  const parts =
    value
      .trim()
      .split(
        /\s+/
      )
      .filter(
        Boolean
      );

  if (
    parts.length ===
    0
  ) {
    return "CM";
  }

  if (
    parts.length ===
    1
  ) {
    return parts[0]
      .slice(
        0,
        2
      )
      .toUpperCase();
  }

  return `${parts[0][0]}${parts[parts.length - 1][0]}`
    .toUpperCase();
}

export default function Page() {
  const params =
    useParams();

  const router =
    useRouter();

  const {
    user,
    openAuth,
  } =
    useAuth();

  const vendorId =
    typeof params.vendorId ===
      "string"
      ? params.vendorId
      : "";

  const [
    storefront,
    setStorefront,
  ] =
    useState<
      Storefront | null
    >(
      null
    );

  const [
    products,
    setProducts,
  ] =
    useState<
      StorefrontProduct[]
    >(
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
    error,
    setError,
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

  /*
   * =====================================================
   * LOAD PUBLIC STOREFRONT
   * =====================================================
   */

  useEffect(() => {
    if (
      !vendorId
    ) {
      setLoading(
        false
      );

      setError(
        "Seller storefront not available."
      );

      return;
    }

    const controller =
      new AbortController();

    const loadStorefront =
      async () => {
        try {
          setLoading(
            true
          );

          setError(
            ""
          );

          const response =
            await fetch(
              `${API_URL}/api/vendor/storefront/${encodeURIComponent(
                vendorId
              )}`,
              {
                signal:
                  controller.signal,

                cache:
                  "no-store",
              }
            );

          const data =
            await response.json() as
              StorefrontResponse;

          if (
            !response.ok ||
            !data.success ||
            !data.storefront
          ) {
            throw new Error(
              data.message ||
                "Seller storefront not available."
            );
          }

          setStorefront(
            data.storefront
          );

          setProducts(
            Array.isArray(
              data.products
            )
              ? data.products
              : []
          );
        } catch (
          storefrontError
        ) {
          if (
            storefrontError instanceof
              DOMException &&
            storefrontError.name ===
              "AbortError"
          ) {
            return;
          }

          console.error(
            "Storefront load error:",
            storefrontError
          );

          setStorefront(
            null
          );

          setProducts(
            []
          );

          setError(
            storefrontError instanceof
              Error
              ? storefrontError.message
              : "Seller storefront not available."
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

    void loadStorefront();

    return () => {
      controller.abort();
    };
  }, [
    vendorId,
  ]);

  /*
   * =====================================================
   * OPEN EXISTING GENERAL CONVERSATION
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
        !storefront
      ) {
        return;
      }

      if (
        user.id ===
        storefront.sellerId
      ) {
        setMessageError(
          "You cannot message your own storefront."
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
          "Your session is unavailable. Sign in again to message this seller."
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
         * Look for the existing canonical GENERAL thread.
         *
         * Clicking Message seller does not create an empty
         * conversation.
         */

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

        const existingConversation =
          conversations.find(
            (
              conversation
            ) =>
              conversation.contextType ===
                "general" &&
              conversation.otherParty
                ?.id ===
                storefront.sellerId
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
         * No thread yet.
         *
         * Ask for the first real message before creating
         * the conversation.
         */

        setMessageComposerOpen(
          true
        );
      } catch (
        messagingError
      ) {
        console.error(
          "Open storefront messaging error:",
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
   * START GENERAL SELLER CONVERSATION
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
        !storefront ||
        sendingMessage
      ) {
        return;
      }

      if (
        user.id ===
        storefront.sellerId
      ) {
        setMessageError(
          "You cannot message your own storefront."
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
          "Your session is unavailable. Sign in again to message this seller."
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
                    "general",

                  vendorId:
                    storefront.sellerId,

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
          "Start storefront conversation error:",
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
      <PageShell
        title="Seller storefront"
        description="Loading this CampusMart seller."
      >
        <div className="animate-pulse space-y-6">
          <section className="site-card h-72 bg-slate-100" />

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              1,
              2,
              3,
            ].map(
              (
                item
              ) => (
                <div
                  key={
                    item
                  }
                  className="site-card h-[360px] bg-slate-100"
                />
              )
            )}
          </div>
        </div>
      </PageShell>
    );
  }

  /*
   * =====================================================
   * UNAVAILABLE STOREFRONT
   * =====================================================
   */

  if (
    error ||
    !storefront
  ) {
    return (
      <PageShell
        title="Seller storefront"
        description="Browse trusted sellers on CampusMart."
      >
        <div className="site-card mx-auto max-w-xl p-8 text-center sm:p-10">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-sm font-black text-slate-700">
            CM
          </div>

          <h1 className="mt-5 text-2xl font-bold text-slate-950">
            Storefront unavailable
          </h1>

          <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-slate-600">
            This seller storefront is
            unavailable or is not
            currently active on
            CampusMart.
          </p>

          <Link
            href="/marketplace"
            className="mt-6 inline-flex rounded-[10px] bg-accent-400 px-5 py-3 text-sm font-bold text-black transition hover:bg-accent-500"
          >
            Browse marketplace
          </Link>
        </div>
      </PageShell>
    );
  }

  /*
   * =====================================================
   * PAGE DATA
   * =====================================================
   */

  const university =
    storefront.university;

  const universityLabel =
    university
      ? university.shortName ||
        university.name
      : "";

  const locationLabel =
    university
      ? [
          university.city,
          university.state,
        ]
          .filter(
            Boolean
          )
          .join(
            ", "
          )
      : "";

  const memberSince =
    formatMemberSince(
      storefront.memberSince
    );

  const initials =
    sellerInitials(
      storefront.businessName
    );

  const ownStorefront =
    Boolean(
      user &&
      user.id ===
        storefront.sellerId
    );

  return (
    <PageShell
      title={
        storefront.businessName
      }
      description={`Shop from ${storefront.businessName} on CampusMart.`}
    >
      {/*
       * =================================================
       * STOREFRONT HEADER
       * =================================================
       */}

      <section className="site-card overflow-hidden">
        <div className="bg-slate-950 px-5 py-8 sm:px-8 sm:py-10">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-col gap-6 sm:flex-row sm:items-center">
              <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-3xl border border-white/10 bg-white text-2xl font-black text-slate-950 shadow-xl">
                {
                  initials
                }
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
                    {
                      storefront.businessName
                    }
                  </h1>

                  {storefront.badges
                    .vendorVerified ? (
                    <span className="rounded-full border border-blue-400/30 bg-blue-400/10 px-3 py-1 text-xs font-bold text-blue-200">
                      Verified vendor
                    </span>
                  ) : null}

                  {storefront.badges
                    .studentVerified ? (
                    <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-bold text-emerald-200">
                      Verified student
                    </span>
                  ) : null}
                </div>

                <p className="mt-2 text-sm text-slate-300">
                  Run by{" "}
                  <span className="font-semibold text-white">
                    {
                      storefront.ownerName
                    }
                  </span>
                </p>

                <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-slate-300">
                  {universityLabel ? (
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                      University:{" "}
                      {
                        universityLabel
                      }
                    </span>
                  ) : null}

                  {locationLabel ? (
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                      {
                        locationLabel
                      }
                    </span>
                  ) : null}

                  {memberSince ? (
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                      Member since{" "}
                      {
                        memberSince
                      }
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            {/*
             * =============================================
             * MESSAGE SELLER
             * =============================================
             */}

            <div className="shrink-0">
              <button
                type="button"
                disabled={
                  openingMessages ||
                  ownStorefront
                }
                onClick={() =>
                  void handleMessageSeller()
                }
                className="inline-flex min-h-12 w-full items-center justify-center rounded-[10px] bg-accent-400 px-6 py-3 text-sm font-black text-black transition hover:bg-accent-500 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-slate-400 sm:w-auto"
              >
                {ownStorefront
                  ? "Your storefront"
                  : openingMessages
                    ? "Opening messages..."
                    : "Message seller"}
              </button>

              {!ownStorefront ? (
                <p className="mt-2 max-w-52 text-xs leading-5 text-slate-400">
                  Ask a general question
                  about this shop.
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="grid gap-6 px-5 py-6 sm:px-8 lg:grid-cols-[1fr_auto] lg:items-start">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
              About this shop
            </p>

            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-700">
              {
                storefront.description
              }
            </p>
          </div>

          <div className="grid min-w-[180px] grid-cols-2 gap-3">
            <div className="rounded-2xl bg-slate-50 p-4 text-center">
              <p className="text-2xl font-black text-slate-950">
                {
                  storefront.listingCount
                }
              </p>

              <p className="mt-1 text-xs font-semibold text-slate-500">
                Active{" "}
                {storefront.listingCount ===
                1
                  ? "listing"
                  : "listings"}
              </p>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4 text-center">
              <p className="text-2xl font-black text-slate-950">
                {storefront.badges
                  .studentVerified
                  ? "✓"
                  : "—"}
              </p>

              <p className="mt-1 text-xs font-semibold text-slate-500">
                Student status
              </p>
            </div>
          </div>
        </div>
      </section>

      {/*
       * =================================================
       * GENERAL MESSAGE COMPOSER
       * =================================================
       */}

      {messageComposerOpen &&
      !ownStorefront ? (
        <section className="site-card mt-5 p-5 sm:p-6">
          <form
            onSubmit={
              startSellerConversation
            }
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                  New conversation
                </p>

                <h2 className="mt-2 text-xl font-black text-slate-950">
                  Message{" "}
                  {
                    storefront.businessName
                  }
                </h2>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                  Ask about the shop,
                  availability, products
                  or campus pickup. For a
                  question about one
                  specific product, you
                  can also message from
                  that listing.
                </p>
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
                aria-label="Close message composer"
                className="shrink-0 rounded-full px-2 py-1 text-lg font-bold text-slate-400 transition hover:bg-slate-100 hover:text-black disabled:cursor-not-allowed disabled:opacity-50"
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
              placeholder={`Hi, I have a question about ${storefront.businessName}...`}
              className="mt-5 w-full resize-y rounded-[10px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            />

            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
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
                Contact details may be
                hidden by CampusMart.
              </p>
            </div>

            {messageError ? (
              <div
                role="alert"
                className="mt-4 rounded-[10px] border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold leading-5 text-red-700"
              >
                {
                  messageError
                }
              </div>
            ) : null}

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <button
                type="submit"
                disabled={
                  sendingMessage ||
                  !messageDraft.trim()
                }
                className="inline-flex items-center justify-center rounded-[10px] bg-slate-950 px-6 py-3 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
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
                className="inline-flex items-center justify-center rounded-[10px] border border-slate-200 bg-white px-6 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      ) : null}

      {messageError &&
      !messageComposerOpen ? (
        <div
          role="alert"
          className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"
        >
          {
            messageError
          }
        </div>
      ) : null}

      {/*
       * =================================================
       * LISTINGS
       * =================================================
       */}

      <section className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
              Shop listings
            </p>

            <h2 className="mt-2 text-2xl font-black text-slate-950">
              Available now
            </h2>
          </div>

          <Link
            href="/marketplace"
            className="text-sm font-bold text-slate-700 transition hover:text-black"
          >
            Browse all CampusMart →
          </Link>
        </div>

        {products.length >
        0 ? (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {products.map(
              (
                product
              ) => (
                <Link
                  key={
                    product.id
                  }
                  href={`/marketplace/products/${product.id}`}
                  className="site-card group overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg"
                >
                  {product.images
                    .length >
                  0 ? (
                    <img
                      src={
                        product
                          .images[0]
                      }
                      alt={
                        product.title
                      }
                      className="h-52 w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                    />
                  ) : (
                    <div className="flex h-52 items-center justify-center bg-slate-950 px-6 text-center text-sm font-bold text-white">
                      CampusMart
                      listing
                    </div>
                  )}

                  <div className="p-5">
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                      {
                        product.category
                      }
                    </p>

                    <h3 className="mt-2 line-clamp-1 text-lg font-bold text-slate-950">
                      {
                        product.title
                      }
                    </h3>

                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">
                      {
                        product.description
                      }
                    </p>

                    <div className="mt-5 flex items-center justify-between gap-3">
                      <p className="text-lg font-black text-slate-950">
                        {formatNaira(
                          product.price
                        )}
                      </p>

                      <span className="text-sm font-bold text-slate-500 transition group-hover:text-black">
                        View →
                      </span>
                    </div>
                  </div>
                </Link>
              )
            )}
          </div>
        ) : (
          <div className="site-card mt-6 p-8 text-center">
            <h3 className="text-xl font-bold text-slate-950">
              No active listings
            </h3>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              This seller does not
              currently have any
              products available.
            </p>
          </div>
        )}
      </section>
    </PageShell>
  );
}