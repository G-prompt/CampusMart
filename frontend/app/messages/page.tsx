"use client";

import Link from "next/link";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

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

type ConversationContextType =
  | "general"
  | "listing"
  | "order";

type InboxParticipant = {
  id: string;

  name: string;

  role:
    | "client"
    | "vendor";

  businessName:
    | string
    | null;

  university:
    | {
        id: string;
        name: string;
        shortName: string;
      }
    | null;
};

type InboxProduct = {
  id: number;

  slug: string;

  title: string;

  image:
    | string
    | null;

  price: number;

  isArchived: boolean;
};

type InboxOrder = {
  id: string;

  status: string;

  paymentStatus: string;

  createdAt: string;
};

type InboxMessage = {
  id: string;

  senderId: string;

  body: string;

  createdAt: string;

  editedAt:
    | string
    | null;
};

type InboxConversation = {
  id: string;

  side:
    | "buyer"
    | "vendor";

  contextType:
    ConversationContextType;

  product:
    | InboxProduct
    | null;

  order:
    | InboxOrder
    | null;

  otherParty:
    InboxParticipant;

  latestMessage:
    | InboxMessage
    | null;

  unreadCount: number;

  lastMessageAt: string;

  createdAt: string;

  updatedAt: string;
};

function formatConversationTime(
  value: string
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

  const now =
    new Date();

  const sameDay =
    date.getFullYear() ===
      now.getFullYear() &&
    date.getMonth() ===
      now.getMonth() &&
    date.getDate() ===
      now.getDate();

  if (
    sameDay
  ) {
    return date.toLocaleTimeString(
      "en-GB",
      {
        hour:
          "2-digit",

        minute:
          "2-digit",
      }
    );
  }

  const yesterday =
    new Date(
      now
    );

  yesterday.setDate(
    now.getDate() -
      1
  );

  const wasYesterday =
    date.getFullYear() ===
      yesterday.getFullYear() &&
    date.getMonth() ===
      yesterday.getMonth() &&
    date.getDate() ===
      yesterday.getDate();

  if (
    wasYesterday
  ) {
    return "Yesterday";
  }

  if (
    date.getFullYear() ===
    now.getFullYear()
  ) {
    return date.toLocaleDateString(
      "en-GB",
      {
        day:
          "numeric",

        month:
          "short",
      }
    );
  }

  return date.toLocaleDateString(
    "en-GB",
    {
      day:
        "numeric",

      month:
        "short",

      year:
        "numeric",
    }
  );
}

function shortOrderId(
  value: string
) {
  if (
    value.length <=
    8
  ) {
    return value.toUpperCase();
  }

  return value
    .slice(
      -8
    )
    .toUpperCase();
}

function getConversationName(
  conversation:
    InboxConversation
) {
  return (
    conversation
      .otherParty
      .businessName ||
    conversation
      .otherParty
      .name
  );
}

function getContextLabel(
  conversation:
    InboxConversation
) {
  if (
    conversation.contextType ===
      "listing" &&
    conversation.product
  ) {
    return conversation.product
      .title;
  }

  if (
    conversation.contextType ===
      "order" &&
    conversation.order
  ) {
    return `Order #${shortOrderId(
      conversation.order.id
    )}`;
  }

  return "Seller conversation";
}

function getInitials(
  value: string
) {
  const words =
    value
      .trim()
      .split(
        /\s+/
      )
      .filter(
        Boolean
      );

  if (
    words.length ===
    0
  ) {
    return "CM";
  }

  return words
    .slice(
      0,
      2
    )
    .map(
      (
        word
      ) =>
        word[0]
          ?.toUpperCase() ||
        ""
    )
    .join(
      ""
    );
}

export default function Page() {
  const {
    user,
    openAuth,
  } =
    useAuth();

  const [
    conversations,
    setConversations,
  ] =
    useState<
      InboxConversation[]
    >(
      []
    );

  const [
    totalUnread,
    setTotalUnread,
  ] =
    useState(
      0
    );

  const [
    loading,
    setLoading,
  ] =
    useState(
      true
    );

  const [
    refreshing,
    setRefreshing,
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
    search,
    setSearch,
  ] =
    useState(
      ""
    );

  /*
   * =====================================================
   * LOAD INBOX
   * =====================================================
   */

  const loadInbox =
    useCallback(
      async (
        signal?:
          AbortSignal
      ) => {
        if (
          !user
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
          throw new Error(
            "Your session is unavailable."
          );
        }

        const response =
          await fetch(
            `${API_URL}/api/messages/conversations`,
            {
              headers: {
                Authorization:
                  `Bearer ${token}`,
              },

              signal,

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
              "Unable to load your messages."
          );
        }

        setConversations(
          Array.isArray(
            data.conversations
          )
            ? data.conversations
            : []
        );

        setTotalUnread(
          Number(
            data.totalUnread
          ) ||
            0
        );
      },
      [
        user,
      ]
    );

  /*
   * =====================================================
   * INITIAL LOAD
   * =====================================================
   */

  useEffect(() => {
    if (
      !user
    ) {
      setLoading(
        false
      );

      return;
    }

    const controller =
      new AbortController();

    const run =
      async () => {
        try {
          setLoading(
            true
          );

          setError(
            ""
          );

          await loadInbox(
            controller.signal
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
            "Messaging inbox error:",
            loadError
          );

          setError(
            loadError instanceof
              Error
              ? loadError.message
              : "Unable to load your messages."
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

    void run();

    return () => {
      controller.abort();
    };
  }, [
    user,
    loadInbox,
  ]);

  /*
   * =====================================================
   * REFRESH
   * =====================================================
   */

  const refreshInbox =
    async () => {
      if (
        !user
      ) {
        return;
      }

      try {
        setRefreshing(
          true
        );

        setError(
          ""
        );

        await loadInbox();
      } catch (
        refreshError
      ) {
        console.error(
          "Refresh messaging inbox error:",
          refreshError
        );

        setError(
          refreshError instanceof
            Error
            ? refreshError.message
            : "Unable to refresh your messages."
        );
      } finally {
        setRefreshing(
          false
        );
      }
    };

  /*
   * =====================================================
   * FILTER
   * =====================================================
   */

  const filteredConversations =
    useMemo(
      () => {
        const query =
          search
            .trim()
            .toLowerCase();

        if (
          !query
        ) {
          return conversations;
        }

        return conversations.filter(
          (
            conversation
          ) => {
            const name =
              getConversationName(
                conversation
              ).toLowerCase();

            const context =
              getContextLabel(
                conversation
              ).toLowerCase();

            const latest =
              conversation
                .latestMessage
                ?.body
                ?.toLowerCase() ||
              "";

            return (
              name.includes(
                query
              ) ||
              context.includes(
                query
              ) ||
              latest.includes(
                query
              )
            );
          }
        );
      },
      [
        conversations,
        search,
      ]
    );

  /*
   * =====================================================
   * SIGNED OUT
   * =====================================================
   */

  if (
    !user
  ) {
    return (
      <PageShell
        title="Messages"
        description="Chat safely with CampusMart buyers and sellers."
      >
        <section className="site-card mx-auto max-w-lg p-8 text-center sm:p-10">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-950 text-sm font-black text-white">
            CM
          </div>

          <h2 className="mt-5 text-2xl font-black text-slate-950">
            Sign in to view messages
          </h2>

          <p className="mx-auto mt-3 max-w-sm text-sm leading-7 text-slate-600">
            Conversations are private
            to the buyers and sellers
            involved.
          </p>

          <button
            type="button"
            onClick={() =>
              openAuth(
                "login",
                "client"
              )
            }
            className="mt-6 rounded-[10px] bg-accent-400 px-5 py-3 text-sm font-bold text-black transition hover:bg-accent-500"
          >
            Sign in
          </button>
        </section>
      </PageShell>
    );
  }

  /*
   * =====================================================
   * PAGE
   * =====================================================
   */

  return (
    <PageShell
      title="Messages"
      description="Keep product questions, order updates and handoff conversations inside CampusMart."
    >
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {/*
         * =================================================
         * TOOLBAR
         * =================================================
         */}

        <div className="border-b border-slate-200 p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-black text-slate-950">
                  Inbox
                </h2>

                {totalUnread >
                0 ? (
                  <span className="inline-flex min-w-7 items-center justify-center rounded-full bg-accent-400 px-2 py-1 text-xs font-black text-black">
                    {
                      totalUnread
                    }
                  </span>
                ) : null}
              </div>

              <p className="mt-1 text-sm text-slate-500">
                {
                  conversations.length
                }{" "}
                {conversations.length ===
                1
                  ? "conversation"
                  : "conversations"}
              </p>
            </div>

            <button
              type="button"
              disabled={
                refreshing
              }
              onClick={() =>
                void refreshInbox()
              }
              className="rounded-[10px] border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:border-slate-400 hover:text-black disabled:cursor-not-allowed disabled:opacity-60"
            >
              {refreshing
                ? "Refreshing..."
                : "Refresh"}
            </button>
          </div>

          <div className="mt-4">
            <label
              htmlFor="message-search"
              className="sr-only"
            >
              Search conversations
            </label>

            <input
              id="message-search"
              type="search"
              value={
                search
              }
              onChange={(
                event
              ) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="Search people, products or messages"
              className="min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-100"
            />
          </div>
        </div>

        {/*
         * =================================================
         * ERROR
         * =================================================
         */}

        {error ? (
          <div
            role="alert"
            className="m-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 sm:m-5"
          >
            {
              error
            }
          </div>
        ) : null}

        {/*
         * =================================================
         * LOADING
         * =================================================
         */}

        {loading ? (
          <div className="divide-y divide-slate-100">
            {[
              1,
              2,
              3,
              4,
            ].map(
              (
                item
              ) => (
                <div
                  key={
                    item
                  }
                  className="flex animate-pulse gap-4 p-5"
                >
                  <div className="h-14 w-14 shrink-0 rounded-full bg-slate-200" />

                  <div className="min-w-0 flex-1">
                    <div className="h-4 w-36 rounded bg-slate-200" />

                    <div className="mt-3 h-3 w-52 max-w-full rounded bg-slate-100" />

                    <div className="mt-3 h-3 w-32 rounded bg-slate-100" />
                  </div>
                </div>
              )
            )}
          </div>
        ) : null}

        {/*
         * =================================================
         * EMPTY
         * =================================================
         */}

        {!loading &&
        conversations.length ===
          0 ? (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-950 text-sm font-black text-white">
              CM
            </div>

            <h2 className="mt-5 text-xl font-black text-slate-950">
              No conversations yet
            </h2>

            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
              When you message a seller
              about a product, shop or
              order, the conversation
              will appear here.
            </p>

            <Link
              href="/marketplace"
              className="mt-6 inline-flex rounded-[10px] bg-accent-400 px-5 py-3 text-sm font-bold text-black transition hover:bg-accent-500"
            >
              Browse marketplace
            </Link>
          </div>
        ) : null}

        {!loading &&
        conversations.length >
          0 &&
        filteredConversations.length ===
          0 ? (
          <div className="px-6 py-12 text-center">
            <h2 className="text-lg font-black text-slate-950">
              No matching conversations
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Try another search.
            </p>
          </div>
        ) : null}

        {/*
         * =================================================
         * CONVERSATIONS
         * =================================================
         */}

        {!loading &&
        filteredConversations.length >
          0 ? (
          <div className="divide-y divide-slate-100">
            {filteredConversations.map(
              (
                conversation
              ) => {
                const name =
                  getConversationName(
                    conversation
                  );

                const unread =
                  conversation.unreadCount >
                  0;

                const image =
                  conversation.product
                    ?.image;

                return (
                  <Link
                    key={
                      conversation.id
                    }
                    href={`/messages/${conversation.id}`}
                    className={`group flex gap-4 p-4 transition sm:p-5 ${
                      unread
                        ? "bg-amber-50/40 hover:bg-amber-50"
                        : "bg-white hover:bg-slate-50"
                    }`}
                  >
                    <div className="relative shrink-0">
                      {image ? (
                        <img
                          src={
                            image
                          }
                          alt=""
                          className="h-14 w-14 rounded-xl object-cover"
                        />
                      ) : (
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-950 text-sm font-black text-white">
                          {getInitials(
                            name
                          )}
                        </div>
                      )}

                      {unread ? (
                        <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white bg-accent-400" />
                      ) : null}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3
                              className={`truncate text-sm text-slate-950 ${
                                unread
                                  ? "font-black"
                                  : "font-bold"
                              }`}
                            >
                              {
                                name
                              }
                            </h3>

                            {conversation
                              .otherParty
                              .university ? (
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                                {
                                  conversation
                                    .otherParty
                                    .university
                                    .shortName
                                }
                              </span>
                            ) : null}
                          </div>

                          <p className="mt-1 truncate text-xs font-semibold text-slate-500">
                            {getContextLabel(
                              conversation
                            )}
                          </p>
                        </div>

                        <div className="shrink-0 text-right">
                          <p
                            className={`text-[11px] ${
                              unread
                                ? "font-bold text-slate-950"
                                : "font-medium text-slate-400"
                            }`}
                          >
                            {formatConversationTime(
                              conversation.lastMessageAt
                            )}
                          </p>

                          {conversation.unreadCount >
                          0 ? (
                            <span className="mt-2 inline-flex min-w-6 items-center justify-center rounded-full bg-slate-950 px-1.5 py-0.5 text-[10px] font-black text-white">
                              {conversation.unreadCount >
                              99
                                ? "99+"
                                : conversation.unreadCount}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <p
                        className={`mt-2 truncate text-sm ${
                          unread
                            ? "font-semibold text-slate-800"
                            : "text-slate-500"
                        }`}
                      >
                        {conversation
                          .latestMessage
                          ?.senderId ===
                        user.id
                          ? "You: "
                          : ""}
                        {conversation
                          .latestMessage
                          ?.body ||
                          "Conversation started"}
                      </p>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {conversation.contextType ===
                          "listing" &&
                        conversation.product ? (
                          <>
                            <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                              Listing
                            </span>

                            <span className="text-xs font-bold text-slate-700">
                              {formatNaira(
                                conversation
                                  .product
                                  .price
                              )}
                            </span>

                            {conversation
                              .product
                              .isArchived ? (
                              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-500">
                                Listing archived
                              </span>
                            ) : null}
                          </>
                        ) : null}

                        {conversation.contextType ===
                          "order" &&
                        conversation.order ? (
                          <>
                            <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                              Order
                            </span>

                            <span className="text-xs font-semibold capitalize text-slate-500">
                              {
                                conversation
                                  .order
                                  .status
                              }
                            </span>
                          </>
                        ) : null}

                        {conversation.contextType ===
                        "general" ? (
                          <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                            Seller chat
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </Link>
                );
              }
            )}
          </div>
        ) : null}
      </section>

      <section className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-xs font-bold text-slate-700">
          Stay protected on CampusMart
        </p>

        <p className="mt-1 text-xs leading-5 text-slate-500">
          Keep pre-purchase communication
          inside CampusMart. Contact details
          may be hidden and attempts to move
          transactions off-platform may be
          restricted.
        </p>
      </section>
    </PageShell>
  );
}