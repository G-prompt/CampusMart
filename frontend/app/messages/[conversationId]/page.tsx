"use client";

import Link from "next/link";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
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

type ConversationContextType =
  | "general"
  | "listing"
  | "order";

type ConversationSide =
  | "buyer"
  | "vendor";

type ConversationParticipant = {
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

type ConversationProduct = {
  id: number;

  slug: string;

  title: string;

  image:
    | string
    | null;

  price: number;

  isArchived: boolean;
};

type ConversationOrder = {
  id: string;

  status: string;

  paymentStatus: string;

  createdAt: string;
};

type ConversationDetails = {
  id: string;

  side:
    ConversationSide;

  contextType:
    ConversationContextType;

  product:
    | ConversationProduct
    | null;

  order:
    | ConversationOrder
    | null;

  otherParty:
    ConversationParticipant;

  buyerLastReadAt?:
    | string
    | null;

  vendorLastReadAt?:
    | string
    | null;

  lastMessageAt: string;

  createdAt: string;

  updatedAt: string;
};

type Message = {
  id: string;

  conversationId?:
    string;

  senderId: string;

  body: string;

  createdAt: string;

  updatedAt?: string;

  editedAt:
    | string
    | null;

  deletedAt?:
    | string
    | null;
};

type ModerationAction =
  | "allow"
  | "redacted"
  | "blocked";

type ModerationResponse = {
  action?:
    ModerationAction;

  categories?:
    string[];

  warningCode?:
    string | null;

  restrictedUntil?:
    string | null;

  requiresReview?:
    boolean;
};

type Feedback = {
  type:
    | "info"
    | "warning"
    | "error";

  message: string;
};

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

function getInitials(
  value: string
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

  return parts
    .slice(
      0,
      2
    )
    .map(
      (
        part
      ) =>
        part[0]
          ?.toUpperCase() ||
        ""
    )
    .join(
      ""
    );
}

function formatMessageTime(
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

function formatMessageDate(
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
    return "Today";
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

  return date.toLocaleDateString(
    "en-GB",
    {
      day:
        "numeric",

      month:
        "long",

      year:
        "numeric",
    }
  );
}

function formatRestrictionTime(
  value:
    string | null | undefined
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
    "en-GB",
    {
      day:
        "numeric",

      month:
        "short",

      hour:
        "2-digit",

      minute:
        "2-digit",
    }
  );
}

function getConversationName(
  conversation:
    ConversationDetails
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

function getContextTitle(
  conversation:
    ConversationDetails
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

function getFeedbackClasses(
  type:
    Feedback["type"]
) {
  switch (
    type
  ) {
    case "error":
      return "border-red-200 bg-red-50 text-red-700";

    case "warning":
      return "border-amber-200 bg-amber-50 text-amber-800";

    case "info":
    default:
      return "border-blue-200 bg-blue-50 text-blue-700";
  }
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

  const conversationId =
    typeof params
      .conversationId ===
      "string"
      ? params.conversationId
      : "";

  const [
    conversation,
    setConversation,
  ] =
    useState<
      ConversationDetails | null
    >(
      null
    );

  const [
    messages,
    setMessages,
  ] =
    useState<
      Message[]
    >(
      []
    );

  const [
    draft,
    setDraft,
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
    sending,
    setSending,
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
    feedback,
    setFeedback,
  ] =
    useState<
      Feedback | null
    >(
      null
    );

  const [
    messagingRestrictedUntil,
    setMessagingRestrictedUntil,
  ] =
    useState<
      string | null
    >(
      null
    );

  const messageEndRef =
    useRef<HTMLDivElement | null>(
      null
    );

  const initialLoadCompleteRef =
    useRef(
      false
    );

  /*
   * =====================================================
   * MARK READ
   * =====================================================
   */

  const markConversationRead =
    useCallback(
      async () => {
        if (
          !conversationId ||
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
          return;
        }

        try {
          await fetch(
            `${API_URL}/api/messages/conversations/${conversationId}/read`,
            {
              method:
                "POST",

              headers: {
                Authorization:
                  `Bearer ${token}`,
              },

              cache:
                "no-store",
            }
          );
        } catch (
          readError
        ) {
          console.warn(
            "Unable to mark conversation as read:",
            readError
          );
        }
      },
      [
        conversationId,
        user,
      ]
    );

  /*
   * =====================================================
   * LOAD THREAD
   * =====================================================
   */

  const loadConversation =
    useCallback(
      async (
        options?: {
          signal?:
            AbortSignal;

          silent?:
            boolean;
        }
      ) => {
        if (
          !conversationId ||
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
            `${API_URL}/api/messages/conversations/${conversationId}`,
            {
              headers: {
                Authorization:
                  `Bearer ${token}`,
              },

              signal:
                options?.signal,

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
          if (
            response.status ===
            403
          ) {
            throw new Error(
              "You do not have access to this conversation."
            );
          }

          if (
            response.status ===
            404
          ) {
            throw new Error(
              "This conversation could not be found."
            );
          }

          throw new Error(
            data.message ||
              "Unable to load this conversation."
          );
        }

        setConversation(
          data.conversation ??
            null
        );

        setMessages(
          Array.isArray(
            data.messages
          )
            ? data.messages
            : []
        );

        if (
          !options?.silent
        ) {
          setError(
            ""
          );
        }

        await markConversationRead();
      },
      [
        conversationId,
        user,
        markConversationRead,
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

    if (
      !conversationId
    ) {
      setLoading(
        false
      );

      setError(
        "Invalid conversation."
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

          await loadConversation({
            signal:
              controller.signal,
          });

          initialLoadCompleteRef.current =
            true;
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
            "Conversation load error:",
            loadError
          );

          setError(
            loadError instanceof
              Error
              ? loadError.message
              : "Unable to load this conversation."
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
    conversationId,
    loadConversation,
  ]);

  /*
   * =====================================================
   * SIMPLE V1 POLLING
   * =====================================================
   *
   * This is intentionally polling, not fake realtime.
   *
   * Later we can replace this with WebSockets or SSE
   * without changing the chat UI.
   */

  useEffect(() => {
    if (
      !user ||
      !conversationId
    ) {
      return;
    }

    const interval =
      window.setInterval(
        () => {
          if (
            document.visibilityState !==
            "visible"
          ) {
            return;
          }

          void loadConversation({
            silent:
              true,
          }).catch(
            (
              pollingError
            ) => {
              console.warn(
                "Conversation polling error:",
                pollingError
              );
            }
          );
        },
        5000
      );

    return () => {
      window.clearInterval(
        interval
      );
    };
  }, [
    user,
    conversationId,
    loadConversation,
  ]);

  /*
   * =====================================================
   * SCROLL TO LATEST
   * =====================================================
   */

  useEffect(() => {
    if (
      messages.length ===
      0
    ) {
      return;
    }

    messageEndRef.current
      ?.scrollIntoView({
        behavior:
          initialLoadCompleteRef.current
            ? "smooth"
            : "auto",

        block:
          "end",
      });
  }, [
    messages,
  ]);

  /*
   * =====================================================
   * SEND MESSAGE
   * =====================================================
   */

  const sendMessage =
    async (
      event:
        FormEvent<HTMLFormElement>
    ) => {
      event.preventDefault();

      if (
        !user ||
        !conversationId ||
        sending
      ) {
        return;
      }

      const body =
        draft.trim();

      if (
        !body
      ) {
        return;
      }

      if (
        body.length >
        MESSAGE_MAX_LENGTH
      ) {
        setFeedback({
          type:
            "error",

          message:
            `Messages can be up to ${MESSAGE_MAX_LENGTH} characters.`,
        });

        return;
      }

      const token =
        localStorage.getItem(
          "campusmart-token"
        );

      if (
        !token
      ) {
        setFeedback({
          type:
            "error",

          message:
            "Your session is unavailable.",
        });

        return;
      }

      try {
        setSending(
          true
        );

        setFeedback(
          null
        );

        const response =
          await fetch(
            `${API_URL}/api/messages/conversations/${conversationId}/messages`,
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
          const restrictedUntil =
            data.restrictedUntil ??
            data.moderation
              ?.restrictedUntil ??
            null;

          if (
            data.code ===
            "MESSAGING_TEMPORARILY_RESTRICTED"
          ) {
            setMessagingRestrictedUntil(
              restrictedUntil
            );

            const formattedUntil =
              formatRestrictionTime(
                restrictedUntil
              );

            setFeedback({
              type:
                "error",

              message:
                formattedUntil
                  ? `Messaging is temporarily restricted until ${formattedUntil}. You can still read your conversations.`
                  : data.message ||
                    "Messaging is temporarily restricted. You can still read your conversations.",
            });

            return;
          }

          if (
            data.code ===
              "OFF_PLATFORM_ATTEMPT_BLOCKED" ||
            data.moderation
              ?.action ===
              "blocked"
          ) {
            if (
              restrictedUntil
            ) {
              setMessagingRestrictedUntil(
                restrictedUntil
              );
            }

            setFeedback({
              type:
                "warning",

              message:
                data.message ||
                "That message was not sent because it appears to move the conversation off CampusMart.",
            });

            return;
          }

          throw new Error(
            data.message ||
              "Unable to send your message."
          );
        }

        const moderation:
          ModerationResponse =
          data.moderation ??
          {};

        if (
          moderation.restrictedUntil
        ) {
          setMessagingRestrictedUntil(
            moderation.restrictedUntil
          );
        }

        if (
          moderation.action ===
          "redacted"
        ) {
          setFeedback({
            type:
              "warning",

            message:
              "Your message was sent, but contact information was hidden to keep the conversation on CampusMart.",
          });
        } else {
          setFeedback(
            null
          );
        }

        setDraft(
          ""
        );

        if (
          data.sentMessage
        ) {
          setMessages(
            (
              current
            ) => {
              const exists =
                current.some(
                  (
                    message
                  ) =>
                    message.id ===
                    data.sentMessage.id
                );

              if (
                exists
              ) {
                return current;
              }

              return [
                ...current,
                data.sentMessage,
              ];
            }
          );
        }

        /*
         * Refresh from the canonical backend state after
         * sending. This also picks up any sanitized body.
         */

        await loadConversation({
          silent:
            true,
        });
      } catch (
        sendError
      ) {
        console.error(
          "Send message error:",
          sendError
        );

        setFeedback({
          type:
            "error",

          message:
            sendError instanceof
              Error
              ? sendError.message
              : "Unable to send your message.",
        });
      } finally {
        setSending(
          false
        );
      }
    };

  /*
   * =====================================================
   * DATE GROUPING
   * =====================================================
   */

  const messageRows =
    useMemo(
      () => {
        return messages.map(
          (
            message,
            index
          ) => {
            const previous =
              messages[
                index -
                  1
              ];

            const currentDate =
              formatMessageDate(
                message.createdAt
              );

            const previousDate =
              previous
                ? formatMessageDate(
                    previous.createdAt
                  )
                : null;

            return {
              message,

              showDate:
                !previous ||
                currentDate !==
                  previousDate,

              dateLabel:
                currentDate,
            };
          }
        );
      },
      [
        messages,
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
        description="Private CampusMart conversations."
      >
        <section className="site-card mx-auto max-w-lg p-8 text-center sm:p-10">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-950 text-sm font-black text-white">
            CM
          </div>

          <h2 className="mt-5 text-2xl font-black text-slate-950">
            Sign in to continue
          </h2>

          <p className="mx-auto mt-3 max-w-sm text-sm leading-7 text-slate-600">
            Only conversation
            participants can open
            CampusMart messages.
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
   * LOADING
   * =====================================================
   */

  if (
    loading
  ) {
    return (
      <PageShell
        title="Messages"
        description="Loading conversation."
      >
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex animate-pulse gap-4 border-b border-slate-200 p-5">
            <div className="h-12 w-12 rounded-full bg-slate-200" />

            <div className="flex-1">
              <div className="h-4 w-40 rounded bg-slate-200" />

              <div className="mt-3 h-3 w-56 rounded bg-slate-100" />
            </div>
          </div>

          <div className="space-y-5 p-5">
            <div className="h-16 w-2/3 rounded-2xl bg-slate-100" />

            <div className="ml-auto h-20 w-3/5 rounded-2xl bg-slate-200" />

            <div className="h-14 w-1/2 rounded-2xl bg-slate-100" />
          </div>
        </section>
      </PageShell>
    );
  }

  /*
   * =====================================================
   * ERROR / MISSING THREAD
   * =====================================================
   */

  if (
    error ||
    !conversation
  ) {
    return (
      <PageShell
        title="Messages"
        description="CampusMart conversation."
      >
        <section className="site-card mx-auto max-w-lg p-8 text-center sm:p-10">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-sm font-black text-red-600">
            !
          </div>

          <h2 className="mt-5 text-2xl font-black text-slate-950">
            Conversation unavailable
          </h2>

          <p className="mx-auto mt-3 max-w-sm text-sm leading-7 text-slate-600">
            {error ||
              "This conversation could not be loaded."}
          </p>

          <button
            type="button"
            onClick={() =>
              router.push(
                "/messages"
              )
            }
            className="mt-6 rounded-[10px] bg-slate-950 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
          >
            Back to messages
          </button>
        </section>
      </PageShell>
    );
  }

  const conversationName =
    getConversationName(
      conversation
    );

  const contextTitle =
    getContextTitle(
      conversation
    );

  const productImage =
    conversation.product
      ?.image;

  const restricted =
    Boolean(
      messagingRestrictedUntil &&
      new Date(
        messagingRestrictedUntil
      ).getTime() >
        Date.now()
    );

  /*
   * =====================================================
   * PAGE
   * =====================================================
   */

  return (
    <PageShell
      title="Messages"
      description="Private CampusMart conversation."
    >
      <section className="mx-auto flex min-h-[70vh] max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {/*
         * =================================================
         * HEADER
         * =================================================
         */}

        <header className="border-b border-slate-200 bg-white p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <Link
              href="/messages"
              aria-label="Back to messages"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 text-lg font-bold text-slate-700 transition hover:bg-slate-50"
            >
              ←
            </Link>

            {productImage ? (
              <img
                src={
                  productImage
                }
                alt=""
                className="h-12 w-12 shrink-0 rounded-xl object-cover"
              />
            ) : (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-950 text-sm font-black text-white">
                {getInitials(
                  conversationName
                )}
              </div>
            )}

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-base font-black text-slate-950 sm:text-lg">
                  {
                    conversationName
                  }
                </h1>

                {conversation
                  .otherParty
                  .university ? (
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500">
                    {
                      conversation
                        .otherParty
                        .university
                        .shortName
                    }
                  </span>
                ) : null}
              </div>

              <p className="mt-0.5 truncate text-xs font-semibold text-slate-500">
                {
                  contextTitle
                }
              </p>
            </div>
          </div>

          {/*
           * ===============================================
           * CONTEXT CARD
           * ===============================================
           */}

          {conversation.contextType ===
            "listing" &&
          conversation.product ? (
            <div className="mt-4 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              {conversation.product
                .image ? (
                <img
                  src={
                    conversation
                      .product
                      .image
                  }
                  alt=""
                  className="h-12 w-12 shrink-0 rounded-[10px] object-cover"
                />
              ) : (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[10px] bg-slate-900 text-[9px] font-black text-white">
                  CM
                </div>
              )}

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-slate-950">
                  {
                    conversation
                      .product
                      .title
                  }
                </p>

                <div className="mt-1 flex flex-wrap items-center gap-2">
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
                    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                      Listing archived
                    </span>
                  ) : null}
                </div>
              </div>

              {!conversation
                .product
                .isArchived ? (
                <Link
                  href={`/marketplace/products/${conversation.product.id}`}
                  className="shrink-0 text-xs font-bold text-slate-700 underline-offset-4 hover:underline"
                >
                  View item
                </Link>
              ) : null}
            </div>
          ) : null}

          {conversation.contextType ===
            "order" &&
          conversation.order ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                  Order conversation
                </p>

                <p className="mt-1 text-sm font-black text-slate-950">
                  Order #
                  {shortOrderId(
                    conversation
                      .order
                      .id
                  )}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-bold capitalize text-slate-600">
                  {
                    conversation
                      .order
                      .status
                  }
                </span>

                <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-bold capitalize text-slate-600">
                  {
                    conversation
                      .order
                      .paymentStatus
                  }
                </span>
              </div>
            </div>
          ) : null}
        </header>

        {/*
         * =================================================
         * MESSAGES
         * =================================================
         */}

        <div className="flex-1 overflow-y-auto bg-slate-50/60 px-4 py-5 sm:px-6">
          {messages.length ===
          0 ? (
            <div className="flex min-h-72 items-center justify-center text-center">
              <div>
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-950 text-xs font-black text-white">
                  CM
                </div>

                <h2 className="mt-4 text-lg font-black text-slate-950">
                  Start the conversation
                </h2>

                <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
                  Ask about the
                  product, order or
                  campus handoff here.
                </p>
              </div>
            </div>
          ) : (
            <div>
              {messageRows.map(
                (
                  row
                ) => {
                  const ownMessage =
                    row.message
                      .senderId ===
                    user.id;

                  return (
                    <div
                      key={
                        row.message.id
                      }
                    >
                      {row.showDate ? (
                        <div className="my-5 flex items-center gap-3">
                          <div className="h-px flex-1 bg-slate-200" />

                          <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                            {
                              row.dateLabel
                            }
                          </span>

                          <div className="h-px flex-1 bg-slate-200" />
                        </div>
                      ) : null}

                      <div
                        className={`mb-3 flex ${
                          ownMessage
                            ? "justify-end"
                            : "justify-start"
                        }`}
                      >
                        <div
                          className={`max-w-[85%] rounded-2xl px-4 py-3 sm:max-w-[72%] ${
                            ownMessage
                              ? "rounded-br-md bg-slate-950 text-white"
                              : "rounded-bl-md border border-slate-200 bg-white text-slate-900"
                          }`}
                        >
                          <p className="whitespace-pre-wrap break-words text-sm leading-6">
                            {
                              row.message.body
                            }
                          </p>

                          <div
                            className={`mt-1.5 flex items-center gap-1 text-[10px] ${
                              ownMessage
                                ? "justify-end text-slate-400"
                                : "text-slate-400"
                            }`}
                          >
                            <span>
                              {formatMessageTime(
                                row.message
                                  .createdAt
                              )}
                            </span>

                            {row.message
                              .editedAt ? (
                              <span>
                                · edited
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }
              )}

              <div
                ref={
                  messageEndRef
                }
              />
            </div>
          )}
        </div>

        {/*
         * =================================================
         * MODERATION / RESTRICTION FEEDBACK
         * =================================================
         */}

        {feedback ? (
          <div className="border-t border-slate-200 bg-white px-4 pt-3 sm:px-5">
            <div
              role="alert"
              className={`rounded-xl border px-4 py-3 text-xs font-semibold leading-5 ${getFeedbackClasses(
                feedback.type
              )}`}
            >
              {
                feedback.message
              }
            </div>
          </div>
        ) : null}

        {/*
         * =================================================
         * COMPOSER
         * =================================================
         */}

        <footer className="border-t border-slate-200 bg-white p-4 sm:p-5">
          {restricted ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-black text-red-800">
                Messaging temporarily restricted
              </p>

              <p className="mt-1 text-xs leading-5 text-red-700">
                You can still read
                this conversation.
                Sending will become
                available again after{" "}
                {formatRestrictionTime(
                  messagingRestrictedUntil
                ) ||
                  "the restriction expires"}
                .
              </p>
            </div>
          ) : (
            <form
              onSubmit={
                sendMessage
              }
            >
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-2 transition focus-within:border-slate-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-slate-100">
                <textarea
                  value={
                    draft
                  }
                  onChange={(
                    event
                  ) => {
                    setDraft(
                      event.target.value
                    );

                    if (
                      feedback
                    ) {
                      setFeedback(
                        null
                      );
                    }
                  }}
                  onKeyDown={(
                    event
                  ) => {
                    if (
                      event.key ===
                        "Enter" &&
                      !event.shiftKey
                    ) {
                      event.preventDefault();

                      if (
                        draft
                          .trim()
                          .length >
                          0 &&
                        !sending
                      ) {
                        event.currentTarget
                          .form
                          ?.requestSubmit();
                      }
                    }
                  }}
                  maxLength={
                    MESSAGE_MAX_LENGTH
                  }
                  rows={
                    2
                  }
                  disabled={
                    sending
                  }
                  placeholder={`Message ${conversationName}`}
                  aria-label="Message"
                  className="max-h-40 min-h-14 w-full resize-none bg-transparent px-3 py-2 text-sm leading-6 text-slate-950 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
                />

                <div className="flex items-center justify-between gap-3 px-2 pb-1">
                  <div>
                    <p className="text-[10px] font-medium text-slate-400">
                      Enter to send ·
                      Shift + Enter for
                      a new line
                    </p>

                    {draft.length >
                    MESSAGE_MAX_LENGTH -
                      200 ? (
                      <p
                        className={`mt-1 text-[10px] font-bold ${
                          draft.length >=
                          MESSAGE_MAX_LENGTH
                            ? "text-red-600"
                            : "text-amber-600"
                        }`}
                      >
                        {
                          draft.length
                        }
                        /
                        {
                          MESSAGE_MAX_LENGTH
                        }
                      </p>
                    ) : null}
                  </div>

                  <button
                    type="submit"
                    disabled={
                      sending ||
                      !draft.trim()
                    }
                    className="shrink-0 rounded-[10px] bg-accent-400 px-5 py-2.5 text-sm font-black text-black transition hover:bg-accent-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {sending
                      ? "Sending..."
                      : "Send"}
                  </button>
                </div>
              </div>
            </form>
          )}

          <p className="mt-3 text-center text-[10px] leading-4 text-slate-400">
            Keep pre-purchase
            communication inside
            CampusMart. Contact details
            may be hidden and repeated
            attempts to move
            conversations off-platform
            may temporarily restrict
            messaging.
          </p>
        </footer>
      </section>
    </PageShell>
  );
}