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

const NEAR_BOTTOM_DISTANCE =
  120;

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

  buyerLastDeliveredAt?:
    | string
    | null;

  vendorLastDeliveredAt?:
    | string
    | null;

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

type ReplyPreview = {
  id: string;

  senderId: string;

  body:
    | string
    | null;

  deletedAt?:
    | string
    | null;

  createdAt: string;
};

type Message = {
  id: string;

  conversationId?:
    string;

  senderId: string;

  body: string;

  replyToMessageId?:
    | string
    | null;

  replyToMessage?:
    | ReplyPreview
    | null;

  createdAt: string;

  updatedAt?:
    string;

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

type MessageReceiptStatus =
  | "sent"
  | "received"
  | "viewed";

/*
 * =======================================================
 * GENERAL HELPERS
 * =======================================================
 */

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

function getReplyBody(
  body:
    string | null | undefined
) {
  if (
    !body
  ) {
    return "Original message unavailable.";
  }

  return body;
}

/*
 * =======================================================
 * RECEIPT HELPERS
 * =======================================================
 */

function receiptCoversMessage(
  receiptTimestamp:
    string | null | undefined,
  messageTimestamp:
    string
) {
  if (
    !receiptTimestamp
  ) {
    return false;
  }

  const receiptTime =
    new Date(
      receiptTimestamp
    ).getTime();

  const messageTime =
    new Date(
      messageTimestamp
    ).getTime();

  if (
    !Number.isFinite(
      receiptTime
    ) ||
    !Number.isFinite(
      messageTime
    )
  ) {
    return false;
  }

  return (
    receiptTime >=
    messageTime
  );
}

function getMessageReceiptStatus(
  message:
    Message,
  conversation:
    ConversationDetails
): MessageReceiptStatus {
  const recipientDeliveredAt =
    conversation.side ===
    "buyer"
      ? conversation
          .vendorLastDeliveredAt
      : conversation
          .buyerLastDeliveredAt;

  const recipientReadAt =
    conversation.side ===
    "buyer"
      ? conversation
          .vendorLastReadAt
      : conversation
          .buyerLastReadAt;

  if (
    receiptCoversMessage(
      recipientReadAt,
      message.createdAt
    )
  ) {
    return "viewed";
  }

  if (
    receiptCoversMessage(
      recipientDeliveredAt,
      message.createdAt
    )
  ) {
    return "received";
  }

  return "sent";
}

function getLatestIncomingMessage(
  messages:
    Message[],
  currentUserId:
    string
) {
  for (
    let index =
      messages.length -
      1;
    index >=
    0;
    index -=
      1
  ) {
    const message =
      messages[
        index
      ];

    if (
      message &&
      message.senderId !==
        currentUserId
    ) {
      return message;
    }
  }

  return null;
}

/*
 * =======================================================
 * PAGE
 * =======================================================
 */

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

  const currentUserId =
    user?.id ??
    null;

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
    replyingTo,
    setReplyingTo,
  ] =
    useState<
      Message | null
    >(
      null
    );

  const [
    highlightedMessageId,
    setHighlightedMessageId,
  ] =
    useState<
      string | null
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

  const [
    newMessagesBelow,
    setNewMessagesBelow,
  ] =
    useState(
      false
    );

  /*
   * =====================================================
   * REFS
   * =====================================================
   */

  const messageListRef =
    useRef<HTMLDivElement | null>(
      null
    );

  const textareaRef =
    useRef<HTMLTextAreaElement | null>(
      null
    );

  const initialScrollDoneRef =
    useRef(
      false
    );

  const lastRenderedMessageIdRef =
    useRef<
      string | null
    >(
      null
    );

  const nearBottomRef =
    useRef(
      true
    );

  const forceScrollToBottomRef =
    useRef(
      false
    );

  const lastReadAckMessageIdRef =
    useRef<
      string | null
    >(
      null
    );

  const highlightTimerRef =
    useRef<
      ReturnType<
        typeof setTimeout
      > | null
    >(
      null
    );

  /*
   * =====================================================
   * RESET THREAD-LOCAL STATE
   * =====================================================
   */

  useEffect(() => {
    initialScrollDoneRef.current =
      false;

    lastRenderedMessageIdRef.current =
      null;

    nearBottomRef.current =
      true;

    forceScrollToBottomRef.current =
      false;

    lastReadAckMessageIdRef.current =
      null;

    setNewMessagesBelow(
      false
    );

    setReplyingTo(
      null
    );

    setHighlightedMessageId(
      null
    );
  }, [
    conversationId,
  ]);

  /*
   * =====================================================
   * CLEAN HIGHLIGHT TIMER
   * =====================================================
   */

  useEffect(() => {
    return () => {
      if (
        highlightTimerRef.current
      ) {
        clearTimeout(
          highlightTimerRef.current
        );
      }
    };
  }, []);

  /*
   * =====================================================
   * KEEP REPLY SELECTION VALID
   * =====================================================
   */

  useEffect(() => {
    if (
      !replyingTo
    ) {
      return;
    }

    const stillExists =
      messages.some(
        (
          message
        ) =>
          message.id ===
          replyingTo.id &&
          !message.deletedAt
      );

    if (
      !stillExists
    ) {
      setReplyingTo(
        null
      );
    }
  }, [
    messages,
    replyingTo,
  ]);

  /*
   * =====================================================
   * SCROLL HELPERS
   * =====================================================
   */

  const scrollToLatest =
    useCallback(
      (
        behavior:
          ScrollBehavior =
          "smooth"
      ) => {
        const element =
          messageListRef.current;

        if (
          !element
        ) {
          return;
        }

        element.scrollTo({
          top:
            element.scrollHeight,

          behavior,
        });

        nearBottomRef.current =
          true;

        setNewMessagesBelow(
          false
        );
      },
      []
    );

  const scrollToMessage =
    useCallback(
      (
        messageId:
          string
      ) => {
        const container =
          messageListRef.current;

        const target =
          document.getElementById(
            `message-${messageId}`
          );

        if (
          !container ||
          !target
        ) {
          return;
        }

        const containerRect =
          container.getBoundingClientRect();

        const targetRect =
          target.getBoundingClientRect();

        const targetTop =
          container.scrollTop +
          (
            targetRect.top -
            containerRect.top
          ) -
          (
            container.clientHeight /
            2
          ) +
          (
            targetRect.height /
            2
          );

        container.scrollTo({
          top:
            Math.max(
              0,
              targetTop
            ),

          behavior:
            "smooth",
        });

        setHighlightedMessageId(
          messageId
        );

        if (
          highlightTimerRef.current
        ) {
          clearTimeout(
            highlightTimerRef.current
          );
        }

        highlightTimerRef.current =
          setTimeout(
            () => {
              setHighlightedMessageId(
                null
              );

              highlightTimerRef.current =
                null;
            },
            1500
          );
      },
      []
    );

  /*
   * =====================================================
   * REPLY HELPERS
   * =====================================================
   */

  const startReply =
    (
      message:
        Message
    ) => {
      setReplyingTo(
        message
      );

      setFeedback(
        null
      );

      window.requestAnimationFrame(
        () => {
          textareaRef.current
            ?.focus();
        }
      );
    };

  const cancelReply =
    () => {
      setReplyingTo(
        null
      );

      window.requestAnimationFrame(
        () => {
          textareaRef.current
            ?.focus();
        }
      );
    };

  const getReplyAuthorName =
    (
      senderId:
        string
    ) => {
      if (
        senderId ===
        currentUserId
      ) {
        return "You";
      }

      if (
        conversation
      ) {
        return getConversationName(
          conversation
        );
      }

      return "Message";
    };

  /*
   * =====================================================
   * MARK READ
   * =====================================================
   */

  const markConversationRead =
    useCallback(
      async (
        messageId?:
          string | null
      ) => {
        if (
          !conversationId ||
          !currentUserId
        ) {
          return;
        }

        if (
          messageId &&
          lastReadAckMessageIdRef.current ===
            messageId
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
          const response =
            await fetch(
              `${API_URL}/api/messages/conversations/${conversationId}/read`,
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
                  JSON.stringify(
                    messageId
                      ? {
                          messageId,
                        }
                      : {}
                  ),

                cache:
                  "no-store",
              }
            );

          if (
            !response.ok
          ) {
            return;
          }

          const data =
            await response.json();

          if (
            !data.success
          ) {
            return;
          }

          if (
            messageId
          ) {
            lastReadAckMessageIdRef.current =
              messageId;
          }

          setConversation(
            (
              current
            ) => {
              if (
                !current
              ) {
                return current;
              }

              if (
                current.side ===
                "buyer"
              ) {
                return {
                  ...current,

                  buyerLastDeliveredAt:
                    data.deliveredAt ??
                    current
                      .buyerLastDeliveredAt,

                  buyerLastReadAt:
                    data.readAt ??
                    current
                      .buyerLastReadAt,
                };
              }

              return {
                ...current,

                vendorLastDeliveredAt:
                  data.deliveredAt ??
                  current
                    .vendorLastDeliveredAt,

                vendorLastReadAt:
                  data.readAt ??
                  current
                    .vendorLastReadAt,
              };
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
        currentUserId,
      ]
    );

  /*
   * =====================================================
   * MARK LATEST INCOMING AS VIEWED
   * =====================================================
   */

  const markLatestIncomingAsRead =
    useCallback(
      () => {
        if (
          !currentUserId
        ) {
          return;
        }

        const latestIncoming =
          getLatestIncomingMessage(
            messages,
            currentUserId
          );

        if (
          !latestIncoming
        ) {
          return;
        }

        void markConversationRead(
          latestIncoming.id
        );
      },
      [
        messages,
        currentUserId,
        markConversationRead,
      ]
    );

  /*
   * =====================================================
   * SCROLL EVENT
   * =====================================================
   */

  const handleMessageListScroll =
    useCallback(
      () => {
        const element =
          messageListRef.current;

        if (
          !element
        ) {
          return;
        }

        const distanceFromBottom =
          element.scrollHeight -
          element.scrollTop -
          element.clientHeight;

        const nearBottom =
          distanceFromBottom <=
          NEAR_BOTTOM_DISTANCE;

        nearBottomRef.current =
          nearBottom;

        if (
          nearBottom
        ) {
          setNewMessagesBelow(
            false
          );

          markLatestIncomingAsRead();
        }
      },
      [
        markLatestIncomingAsRead,
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
          !currentUserId
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

        const nextConversation:
          ConversationDetails | null =
          data.conversation ??
          null;

        const nextMessages:
          Message[] =
          Array.isArray(
            data.messages
          )
            ? data.messages
            : [];

        setConversation(
          nextConversation
        );

        setMessages(
          nextMessages
        );

        if (
          !options?.silent
        ) {
          setError(
            ""
          );
        }

        /*
         * Initial thread open:
         * mark latest incoming viewed.
         *
         * Silent polling:
         * only mark viewed if the user is already near
         * the newest messages.
         */

        const shouldMarkRead =
          !options?.silent ||
          nearBottomRef.current;

        if (
          shouldMarkRead
        ) {
          const latestIncoming =
            getLatestIncomingMessage(
              nextMessages,
              currentUserId
            );

          if (
            latestIncoming
          ) {
            await markConversationRead(
              latestIncoming.id
            );
          }
        }
      },
      [
        conversationId,
        currentUserId,
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
      !currentUserId
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
    currentUserId,
    conversationId,
    loadConversation,
  ]);

  /*
   * =====================================================
   * AUTOMATIC V1 SYNC
   * =====================================================
   */

  useEffect(() => {
    if (
      !currentUserId ||
      !conversationId
    ) {
      return;
    }

    const refreshSilently =
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
              "Conversation sync error:",
              pollingError
            );
          }
        );
      };

    const interval =
      window.setInterval(
        refreshSilently,
        5000
      );

    const handleFocus =
      () => {
        refreshSilently();
      };

    const handleVisibilityChange =
      () => {
        if (
          document.visibilityState ===
          "visible"
        ) {
          refreshSilently();
        }
      };

    window.addEventListener(
      "focus",
      handleFocus
    );

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange
    );

    return () => {
      window.clearInterval(
        interval
      );

      window.removeEventListener(
        "focus",
        handleFocus
      );

      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange
      );
    };
  }, [
    currentUserId,
    conversationId,
    loadConversation,
  ]);

  /*
   * =====================================================
   * SMART AUTO-SCROLL
   * =====================================================
   */

  useEffect(() => {
    if (
      loading ||
      !conversation ||
      !currentUserId ||
      messages.length ===
        0
    ) {
      return;
    }

    const latestMessage =
      messages[
        messages.length -
          1
      ];

    if (
      !latestMessage
    ) {
      return;
    }

    const latestMessageId =
      latestMessage.id;

    if (
      !initialScrollDoneRef.current
    ) {
      initialScrollDoneRef.current =
        true;

      lastRenderedMessageIdRef.current =
        latestMessageId;

      window.requestAnimationFrame(
        () => {
          scrollToLatest(
            "auto"
          );
        }
      );

      return;
    }

    const previousLatestMessageId =
      lastRenderedMessageIdRef.current;

    lastRenderedMessageIdRef.current =
      latestMessageId;

    if (
      previousLatestMessageId ===
      latestMessageId
    ) {
      return;
    }

    const ownMessage =
      latestMessage.senderId ===
      currentUserId;

    const shouldAutoScroll =
      forceScrollToBottomRef.current ||
      ownMessage ||
      nearBottomRef.current;

    forceScrollToBottomRef.current =
      false;

    if (
      shouldAutoScroll
    ) {
      window.requestAnimationFrame(
        () => {
          scrollToLatest(
            "smooth"
          );
        }
      );

      return;
    }

    setNewMessagesBelow(
      true
    );
  }, [
    messages,
    loading,
    conversation,
    currentUserId,
    scrollToLatest,
  ]);

  /*
   * =====================================================
   * JUMP TO NEW MESSAGES
   * =====================================================
   */

  const handleJumpToLatest =
    () => {
      scrollToLatest(
        "smooth"
      );

      window.requestAnimationFrame(
        () => {
          markLatestIncomingAsRead();
        }
      );
    };

  /*
   * =====================================================
   * SEND MESSAGE / REPLY
   * =====================================================
   */

  const sendMessage =
    async (
      event:
        FormEvent<HTMLFormElement>
    ) => {
      event.preventDefault();

      if (
        !currentUserId ||
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

                  ...(replyingTo
                    ? {
                        replyToMessageId:
                          replyingTo.id,
                      }
                    : {}),
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
            "REPLY_MESSAGE_NOT_FOUND"
          ) {
            setReplyingTo(
              null
            );

            setFeedback({
              type:
                "warning",

              message:
                "The message you were replying to is no longer available. Please choose another message.",
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

        setReplyingTo(
          null
        );

        forceScrollToBottomRef.current =
          true;

        setNewMessagesBelow(
          false
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
      <section className="mx-auto flex h-[calc(100dvh-11rem)] min-h-[500px] max-h-[820px] max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {/*
         * =================================================
         * HEADER
         * =================================================
         */}

        <header className="shrink-0 border-b border-slate-200 bg-white p-4 sm:p-5">
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

        <div className="relative min-h-0 flex-1">
          <div
            ref={
              messageListRef
            }
            onScroll={
              handleMessageListScroll
            }
            className="h-full overflow-y-auto overscroll-contain bg-slate-50/60 px-4 py-5 sm:px-6"
          >
            {messages.length ===
            0 ? (
              <div className="flex min-h-full items-center justify-center text-center">
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

                    const receiptStatus =
                      ownMessage
                        ? getMessageReceiptStatus(
                            row.message,
                            conversation
                          )
                        : null;

                    const quotedMessage =
                      row.message
                        .replyToMessage;

                    return (
                      <div
                        id={`message-${row.message.id}`}
                        key={
                          row.message.id
                        }
                        className={`rounded-xl transition duration-500 ${
                          highlightedMessageId ===
                          row.message.id
                            ? "bg-amber-100/70 ring-2 ring-amber-200"
                            : ""
                        }`}
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
                          className={`group mb-3 flex ${
                            ownMessage
                              ? "justify-end"
                              : "justify-start"
                          }`}
                        >
                          <div
                            className={`flex max-w-[85%] flex-col sm:max-w-[72%] ${
                              ownMessage
                                ? "items-end"
                                : "items-start"
                            }`}
                          >
                            <div
                              className={`w-full rounded-2xl px-4 py-3 ${
                                ownMessage
                                  ? "rounded-br-md bg-slate-950 text-white"
                                  : "rounded-bl-md border border-slate-200 bg-white text-slate-900"
                              }`}
                            >
                              {row.message
                                .replyToMessageId ? (
                                quotedMessage ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      scrollToMessage(
                                        quotedMessage.id
                                      )
                                    }
                                    className={`mb-2 block w-full rounded-xl border-l-4 px-3 py-2 text-left transition ${
                                      ownMessage
                                        ? "border-accent-400 bg-white/10 hover:bg-white/15"
                                        : "border-slate-400 bg-slate-50 hover:bg-slate-100"
                                    }`}
                                  >
                                    <span
                                      className={`block text-[10px] font-black ${
                                        ownMessage
                                          ? "text-accent-300"
                                          : "text-slate-600"
                                      }`}
                                    >
                                      {getReplyAuthorName(
                                        quotedMessage
                                          .senderId
                                      )}
                                    </span>

                                    <span
                                      className={`mt-0.5 line-clamp-2 block text-xs leading-5 ${
                                        ownMessage
                                          ? "text-slate-300"
                                          : "text-slate-600"
                                      }`}
                                    >
                                      {getReplyBody(
                                        quotedMessage
                                          .body
                                      )}
                                    </span>
                                  </button>
                                ) : (
                                  <div
                                    className={`mb-2 rounded-xl border-l-4 px-3 py-2 text-xs ${
                                      ownMessage
                                        ? "border-slate-500 bg-white/10 text-slate-400"
                                        : "border-slate-300 bg-slate-50 text-slate-500"
                                    }`}
                                  >
                                    Original
                                    message
                                    unavailable.
                                  </div>
                                )
                              ) : null}

                              <p className="whitespace-pre-wrap break-words text-sm leading-6">
                                {
                                  row.message.body
                                }
                              </p>

                              <div
                                className={`mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] ${
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

                                {ownMessage &&
                                receiptStatus ? (
                                  <>
                                    <span>
                                      ·
                                    </span>

                                    {receiptStatus ===
                                    "viewed" ? (
                                      <span
                                        className="font-bold text-sky-400"
                                        title="Viewed"
                                        aria-label="Viewed"
                                      >
                                        ✓✓ Viewed
                                      </span>
                                    ) : receiptStatus ===
                                      "received" ? (
                                      <span
                                        className="font-bold text-slate-300"
                                        title="Received"
                                        aria-label="Received"
                                      >
                                        ✓✓ Received
                                      </span>
                                    ) : (
                                      <span
                                        className="font-bold text-slate-400"
                                        title="Sent"
                                        aria-label="Sent"
                                      >
                                        ✓ Sent
                                      </span>
                                    )}
                                  </>
                                ) : null}
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() =>
                                startReply(
                                  row.message
                                )
                              }
                              className={`mt-1 px-1 text-[10px] font-bold text-slate-400 transition hover:text-slate-700 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100 ${
                                ownMessage
                                  ? "text-right"
                                  : "text-left"
                              }`}
                            >
                              ↩ Reply
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            )}
          </div>

          {newMessagesBelow ? (
            <button
              type="button"
              onClick={
                handleJumpToLatest
              }
              className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2 rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-800 shadow-lg transition hover:bg-slate-50"
            >
              New messages ↓
            </button>
          ) : null}
        </div>

        {/*
         * =================================================
         * FEEDBACK
         * =================================================
         */}

        {feedback ? (
          <div className="shrink-0 border-t border-slate-200 bg-white px-4 pt-3 sm:px-5">
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

        <footer className="shrink-0 border-t border-slate-200 bg-white p-4 sm:p-5">
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
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 transition focus-within:border-slate-400 focus-within:bg-white focus-within:ring-2 focus-within:ring-slate-100">
                {replyingTo ? (
                  <div className="flex items-start gap-3 border-b border-slate-200 bg-white px-4 py-3">
                    <div className="min-w-0 flex-1 border-l-4 border-accent-400 pl-3">
                      <p className="text-[10px] font-black text-slate-700">
                        Replying
                        to{" "}
                        {getReplyAuthorName(
                          replyingTo
                            .senderId
                        )}
                      </p>

                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                        {
                          replyingTo.body
                        }
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={
                        cancelReply
                      }
                      aria-label="Cancel reply"
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-lg font-bold text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                    >
                      ×
                    </button>
                  </div>
                ) : null}

                <div className="p-2">
                  <textarea
                    ref={
                      textareaRef
                    }
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
                          "Escape" &&
                        replyingTo
                      ) {
                        event.preventDefault();

                        cancelReply();

                        return;
                      }

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
                    placeholder={
                      replyingTo
                        ? "Write a reply..."
                        : `Message ${conversationName}`
                    }
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

                      {replyingTo ? (
                        <p className="mt-1 text-[10px] font-medium text-slate-400">
                          Esc to cancel
                          reply
                        </p>
                      ) : null}

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
                        : replyingTo
                          ? "Reply"
                          : "Send"}
                    </button>
                  </div>
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