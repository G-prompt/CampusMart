"use client";

import Link from "next/link";

import {
  FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  usePathname,
  useRouter,
} from "next/navigation";

import {
  useAuth,
} from "./AuthContext";

import {
  useCart,
} from "./CartContext";

import {
  useSaved,
} from "./SavedContext";

import {
  CartIcon,
  HeartIcon as NavHeartIcon,
  HomeIcon,
  UserIcon,
} from "./icons";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:5000";

type InboxLatestMessage = {
  id: string;
  senderId: string;
  createdAt: string;
};

type InboxConversation = {
  id: string;

  side:
    | "buyer"
    | "vendor";

  latestMessage:
    | InboxLatestMessage
    | null;

  buyerLastDeliveredAt?:
    | string
    | null;

  vendorLastDeliveredAt?:
    | string
    | null;
};

type AccountNotification = {
  id: string;

  type:
    string;

  title:
    string;

  message:
    string;

  href:
    | string
    | null;

  orderId:
    | string
    | null;

  readAt:
    | string
    | null;

  createdAt:
    string;
};

function MessageIcon({
  className = "h-6 w-6",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
      className={
        className
      }
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6 4h12a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3h-7l-5 4v-4a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3Z"
      />

      <path
        strokeLinecap="round"
        d="M8 9h8M8 13h5"
      />
    </svg>
  );
}

function BellIcon({
  className = "h-5 w-5",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
      className={
        className
      }
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z"
      />

      <path
        strokeLinecap="round"
        d="M10 21h4"
      />
    </svg>
  );
}

function MenuIcon({
  className = "h-6 w-6",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.3"
      aria-hidden="true"
      className={
        className
      }
    >
      <path
        strokeLinecap="round"
        d="M4 7h16M4 12h16M4 17h16"
      />
    </svg>
  );
}

function CloseIcon({
  className = "h-6 w-6",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      aria-hidden="true"
      className={
        className
      }
    >
      <path
        strokeLinecap="round"
        d="m6 6 12 12M18 6 6 18"
      />
    </svg>
  );
}

function SearchIcon({
  className = "h-5 w-5",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.3"
      aria-hidden="true"
      className={
        className
      }
    >
      <circle
        cx="11"
        cy="11"
        r="6.5"
      />

      <path
        strokeLinecap="round"
        d="m16 16 4 4"
      />
    </svg>
  );
}

function CategoryIcon({
  className = "h-5 w-5",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
      className={
        className
      }
    >
      <rect
        x="4"
        y="4"
        width="6"
        height="6"
        rx="1.5"
      />

      <rect
        x="14"
        y="4"
        width="6"
        height="6"
        rx="1.5"
      />

      <rect
        x="4"
        y="14"
        width="6"
        height="6"
        rx="1.5"
      />

      <rect
        x="14"
        y="14"
        width="6"
        height="6"
        rx="1.5"
      />
    </svg>
  );
}

function SellIcon({
  className = "h-5 w-5",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
      className={
        className
      }
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5 7.5 7.5 5H17l2 2.5V20H5V7.5Z"
      />

      <path
        strokeLinecap="round"
        d="M9 10.5h6M12 7.5v6"
      />
    </svg>
  );
}

function DashboardIcon({
  className = "h-5 w-5",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
      className={
        className
      }
    >
      <rect
        x="4"
        y="4"
        width="6"
        height="6"
        rx="1.5"
      />

      <rect
        x="14"
        y="4"
        width="6"
        height="10"
        rx="1.5"
      />

      <rect
        x="4"
        y="14"
        width="6"
        height="6"
        rx="1.5"
      />

      <rect
        x="14"
        y="18"
        width="6"
        height="2"
        rx="1"
      />
    </svg>
  );
}

function OrdersIcon({
  className = "h-5 w-5",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
      className={
        className
      }
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6 4h12a2 2 0 0 1 2 2v14H4V6a2 2 0 0 1 2-2Z"
      />

      <path
        strokeLinecap="round"
        d="M8 9h8M8 13h8M8 17h5"
      />
    </svg>
  );
}

function WalletIcon({
  className = "h-5 w-5",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
      className={
        className
      }
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18a2 2 0 0 1 2 2v12H6.5A2.5 2.5 0 0 1 4 16.5v-9Z"
      />

      <path
        strokeLinecap="round"
        d="M16 11h4v4h-4a2 2 0 1 1 0-4Z"
      />
    </svg>
  );
}

function SupportIcon({
  className = "h-5 w-5",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
      className={
        className
      }
    >
      <circle
        cx="12"
        cy="12"
        r="8"
      />

      <path
        strokeLinecap="round"
        d="M9.8 9.5a2.4 2.4 0 0 1 4.6 1c0 1.8-2.4 2-2.4 3.6M12 17h.01"
      />
    </svg>
  );
}

function CountBadge({
  count,
}: {
  count:
    number;
}) {
  if (
    count <=
    0
  ) {
    return null;
  }

  return (
    <span className="absolute -right-1.5 -top-1.5 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent-400 px-1 text-[10px] font-black leading-none text-black shadow-sm">
      {count >
      9
        ? "9+"
        : count}
    </span>
  );
}

function timestampCoversMessage(
  timestamp:
    | string
    | null
    | undefined,
  messageCreatedAt:
    string
) {
  if (
    !timestamp
  ) {
    return false;
  }

  const receiptTime =
    new Date(
      timestamp
    ).getTime();

  const messageTime =
    new Date(
      messageCreatedAt
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

function compactName(
  value:
    string | undefined
) {
  const name =
    value?.trim();

  if (
    !name
  ) {
    return "Student";
  }

  const parts =
    name.split(
      /\s+/
    );

  if (
    parts.length ===
    1
  ) {
    return parts[0];
  }

  const first =
    parts[0];

  const surname =
    parts[
      parts.length -
      1
    ];

  return `${first
    .charAt(
      0
    )
    .toUpperCase()}. ${surname}`;
}

function notificationTime(
  value:
    string
) {
  const date =
    new Date(
      value
    );

  const difference =
    Date.now() -
    date.getTime();

  if (
    !Number.isFinite(
      difference
    )
  ) {
    return "";
  }

  const minutes =
    Math.floor(
      difference /
        60000
    );

  if (
    minutes <
    1
  ) {
    return "Now";
  }

  if (
    minutes <
    60
  ) {
    return `${minutes}m`;
  }

  const hours =
    Math.floor(
      minutes /
        60
    );

  if (
    hours <
    24
  ) {
    return `${hours}h`;
  }

  const days =
    Math.floor(
      hours /
        24
    );

  if (
    days <
    7
  ) {
    return `${days}d`;
  }

  return date.toLocaleDateString(
    undefined,
    {
      day:
        "numeric",

      month:
        "short",
    }
  );
}

const mobileLinks = [
  {
    href:
      "/marketplace",

    label:
      "Shop",

    Icon:
      HomeIcon,
  },

  {
    href:
      "/marketplace/favourites",

    label:
      "Saved",

    Icon:
      NavHeartIcon,
  },

  {
    href:
      "/messages",

    label:
      "Messages",

    Icon:
      MessageIcon,
  },

  {
    href:
      "/cart",

    label:
      "Cart",

    Icon:
      CartIcon,
  },

  {
    href:
      "/profile",

    label:
      "Profile",

    Icon:
      UserIcon,
  },
];

export default function Navbar() {
  const {
    user,
    openAuth,
    logout,
  } =
    useAuth();

  const {
    itemCount,
  } =
    useCart();

  const {
    savedCount,
  } =
    useSaved();

  const router =
    useRouter();

  const pathname =
    usePathname();

  const [
    menuOpen,
    setMenuOpen,
  ] =
    useState(
      false
    );

  const [
    searchOpen,
    setSearchOpen,
  ] =
    useState(
      false
    );

  const [
    notificationsOpen,
    setNotificationsOpen,
  ] =
    useState(
      false
    );

  const [
    query,
    setQuery,
  ] =
    useState(
      ""
    );

  const [
    searchFocused,
    setSearchFocused,
  ] =
    useState(
      false
    );

  const [
    messageUnreadCount,
    setMessageUnreadCount,
  ] =
    useState(
      0
    );

  const [
    notifications,
    setNotifications,
  ] =
    useState<
      AccountNotification[]
    >([]);

  const [
    notificationUnreadCount,
    setNotificationUnreadCount,
  ] =
    useState(
      0
    );

  const [
    notificationLoading,
    setNotificationLoading,
  ] =
    useState(
      false
    );

  const messageSyncInFlightRef =
    useRef(
      false
    );

  const notificationSyncInFlightRef =
    useRef(
      false
    );

  const displayName =
    user?.name
      ?.trim() ||
    "Student";

  const mobileDisplayName =
    compactName(
      user?.name
    );

  const sellerNavigation =
    user?.role ===
    "vendor"
      ? {
          href:
            "/vendor/dashboard",

          label:
            "Dashboard",

          Icon:
            DashboardIcon,
        }
      : {
          href:
            "/sell",

          label:
            "Sell on CampusMart",

          Icon:
            SellIcon,
        };

  const secondaryLinks = [
    {
      href:
        "/categories",

      label:
        "Categories",

      Icon:
        CategoryIcon,
    },

    sellerNavigation,

    {
      href:
        "/buyer/orders",

      label:
        "My orders",

      Icon:
        OrdersIcon,
    },

    {
      href:
        "/wallet",

      label:
        "Wallet",

      Icon:
        WalletIcon,
    },

    {
      href:
        "/support",

      label:
        "Support",

      Icon:
        SupportIcon,
    },
  ];

  const desktopDockLinks = [
    {
      href:
        "/marketplace",

      label:
        "Shop",

      Icon:
        HomeIcon,
    },

    ...secondaryLinks,
  ];

  const searchSuggestions = [
    "Books",
    "Technology",
    "Events",
    "Clothes",
    "Shoes",
  ].filter(
    (
      suggestion
    ) =>
      suggestion
        .toLowerCase()
        .includes(
          query
            .trim()
            .toLowerCase()
        )
  );

  const loadMessagingState =
    useCallback(
      async () => {
        if (
          !user
        ) {
          setMessageUnreadCount(
            0
          );

          return;
        }

        if (
          messageSyncInFlightRef.current
        ) {
          return;
        }

        const token =
          window.localStorage.getItem(
            "campusmart-token"
          );

        if (
          !token
        ) {
          setMessageUnreadCount(
            0
          );

          return;
        }

        messageSyncInFlightRef.current =
          true;

        try {
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
            return;
          }

          const nextCount =
            Number(
              data.totalUnread
            );

          setMessageUnreadCount(
            Number.isFinite(
              nextCount
            ) &&
            nextCount >
              0
              ? Math.floor(
                  nextCount
                )
              : 0
          );

          if (
            document.visibilityState !==
            "visible"
          ) {
            return;
          }

          const conversations:
            InboxConversation[] =
            Array.isArray(
              data.conversations
            )
              ? data.conversations
              : [];

          const deliveryRequests =
            conversations
              .filter(
                (
                  conversation
                ) => {
                  const latestMessage =
                    conversation.latestMessage;

                  if (
                    !latestMessage
                  ) {
                    return false;
                  }

                  if (
                    latestMessage.senderId ===
                    user.id
                  ) {
                    return false;
                  }

                  const cursor =
                    conversation.side ===
                    "buyer"
                      ? conversation
                          .buyerLastDeliveredAt
                      : conversation
                          .vendorLastDeliveredAt;

                  return !timestampCoversMessage(
                    cursor,
                    latestMessage.createdAt
                  );
                }
              )
              .map(
                async (
                  conversation
                ) => {
                  const latestMessage =
                    conversation.latestMessage;

                  if (
                    !latestMessage
                  ) {
                    return;
                  }

                  try {
                    await fetch(
                      `${API_URL}/api/messages/conversations/${conversation.id}/delivered`,
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
                            messageId:
                              latestMessage.id,
                          }),

                        cache:
                          "no-store",
                      }
                    );
                  } catch (
                    deliveryError
                  ) {
                    console.warn(
                      "Unable to acknowledge message delivery:",
                      deliveryError
                    );
                  }
                }
              );

          if (
            deliveryRequests.length >
            0
          ) {
            await Promise.allSettled(
              deliveryRequests
            );
          }
        } catch (
          messagingError
        ) {
          console.warn(
            "Unable to refresh messaging state:",
            messagingError
          );
        } finally {
          messageSyncInFlightRef.current =
            false;
        }
      },
      [
        user,
      ]
    );

  const loadNotifications =
    useCallback(
      async () => {
        if (
          !user
        ) {
          setNotifications(
            []
          );

          setNotificationUnreadCount(
            0
          );

          return;
        }

        if (
          notificationSyncInFlightRef.current
        ) {
          return;
        }

        const token =
          window.localStorage.getItem(
            "campusmart-token"
          );

        if (
          !token
        ) {
          return;
        }

        notificationSyncInFlightRef.current =
          true;

        try {
          setNotificationLoading(
            true
          );

          const response =
            await fetch(
              `${API_URL}/api/notifications?limit=20`,
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
            return;
          }

          setNotifications(
            Array.isArray(
              data.notifications
            )
              ? data.notifications
              : []
          );

          const unread =
            Number(
              data.unreadCount
            );

          setNotificationUnreadCount(
            Number.isFinite(
              unread
            ) &&
            unread >
              0
              ? Math.floor(
                  unread
                )
              : 0
          );
        } catch (
          notificationError
        ) {
          console.warn(
            "Unable to refresh notifications:",
            notificationError
          );
        } finally {
          notificationSyncInFlightRef.current =
            false;

          setNotificationLoading(
            false
          );
        }
      },
      [
        user,
      ]
    );

  useEffect(() => {
    if (
      !user
    ) {
      setMessageUnreadCount(
        0
      );

      return;
    }

    void loadMessagingState();

    const interval =
      window.setInterval(
        () => {
          if (
            document.visibilityState ===
            "visible"
          ) {
            void loadMessagingState();
          }
        },
        15000
      );

    return () => {
      window.clearInterval(
        interval
      );
    };
  }, [
    user,
    loadMessagingState,
  ]);

  useEffect(() => {
    if (
      !user
    ) {
      setNotifications(
        []
      );

      setNotificationUnreadCount(
        0
      );

      return;
    }

    void loadNotifications();

    const interval =
      window.setInterval(
        () => {
          if (
            document.visibilityState ===
            "visible"
          ) {
            void loadNotifications();
          }
        },
        30000
      );

    const refresh =
      () => {
        if (
          document.visibilityState ===
          "visible"
        ) {
          void loadNotifications();
        }
      };

    window.addEventListener(
      "focus",
      refresh
    );

    document.addEventListener(
      "visibilitychange",
      refresh
    );

    return () => {
      window.clearInterval(
        interval
      );

      window.removeEventListener(
        "focus",
        refresh
      );

      document.removeEventListener(
        "visibilitychange",
        refresh
      );
    };
  }, [
    user,
    loadNotifications,
  ]);

  useEffect(() => {
    if (
      user
    ) {
      void loadMessagingState();
      void loadNotifications();
    }

    setMenuOpen(
      false
    );

    setSearchOpen(
      false
    );

    setNotificationsOpen(
      false
    );
  }, [
    pathname,
    user,
    loadMessagingState,
    loadNotifications,
  ]);

  useEffect(() => {
    if (
      !menuOpen &&
      !searchOpen
    ) {
      return;
    }

    const previousOverflow =
      document.body.style
        .overflow;

    document.body.style.overflow =
      "hidden";

    const closeOnEscape =
      (
        event:
          KeyboardEvent
      ) => {
        if (
          event.key ===
          "Escape"
        ) {
          setMenuOpen(
            false
          );

          setSearchOpen(
            false
          );

          setNotificationsOpen(
            false
          );
        }
      };

    window.addEventListener(
      "keydown",
      closeOnEscape
    );

    return () => {
      document.body.style.overflow =
        previousOverflow;

      window.removeEventListener(
        "keydown",
        closeOnEscape
      );
    };
  }, [
    menuOpen,
    searchOpen,
  ]);

  const markNotificationRead =
    async (
      notification:
        AccountNotification
    ) => {
      const token =
        window.localStorage.getItem(
          "campusmart-token"
        );

      if (
        !notification.readAt &&
        token
      ) {
        try {
          const response =
            await fetch(
              `${API_URL}/api/notifications/${notification.id}/read`,
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

          if (
            response.ok
          ) {
            const now =
              new Date()
                .toISOString();

            setNotifications(
              (
                previous
              ) =>
                previous.map(
                  (
                    item
                  ) =>
                    item.id ===
                    notification.id
                      ? {
                          ...item,

                          readAt:
                            now,
                        }
                      : item
                )
            );

            setNotificationUnreadCount(
              (
                previous
              ) =>
                Math.max(
                  0,
                  previous -
                    1
                )
            );
          }
        } catch (
          error
        ) {
          console.warn(
            "Unable to mark notification read:",
            error
          );
        }
      }

      setNotificationsOpen(
        false
      );

      if (
        notification.href
      ) {
        router.push(
          notification.href
        );
      }
    };

  const markAllNotificationsRead =
    async () => {
      const token =
        window.localStorage.getItem(
          "campusmart-token"
        );

      if (
        !token ||
        notificationUnreadCount ===
          0
      ) {
        return;
      }

      try {
        const response =
          await fetch(
            `${API_URL}/api/notifications/read-all`,
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

        if (
          !response.ok
        ) {
          return;
        }

        const now =
          new Date()
            .toISOString();

        setNotifications(
          (
            previous
          ) =>
            previous.map(
              (
                notification
              ) => ({
                ...notification,

                readAt:
                  notification.readAt ||
                  now,
              })
            )
        );

        setNotificationUnreadCount(
          0
        );
      } catch (
        error
      ) {
        console.warn(
          "Unable to mark all notifications read:",
          error
        );
      }
    };

  const handleSearch =
    (
      event:
        FormEvent<HTMLFormElement>
    ) => {
      event.preventDefault();

      const search =
        query.trim();

      if (
        !search
      ) {
        return;
      }

      setSearchOpen(
        false
      );

      router.push(
        `/marketplace/search?q=${encodeURIComponent(
          search
        )}`
      );
    };

  const isLinkActive =
    (
      href:
        string
    ) => {
      if (
        href ===
        "/marketplace/favourites"
      ) {
        return (
          pathname ===
          "/marketplace/favourites"
        );
      }

      if (
        href ===
        "/marketplace"
      ) {
        return (
          pathname ===
            "/marketplace" ||
          pathname.startsWith(
            "/marketplace/products/"
          ) ||
          pathname.startsWith(
            "/marketplace/search"
          )
        );
      }

      if (
        href ===
        "/categories"
      ) {
        return (
          pathname ===
            "/categories" ||
          pathname ===
            "/marketplace/categories"
        );
      }

      if (
        href ===
        "/vendor/dashboard"
      ) {
        return pathname.startsWith(
          "/vendor/"
        );
      }

      if (
        href ===
        "/buyer/orders"
      ) {
        return (
          pathname ===
            "/buyer/orders" ||
          pathname.startsWith(
            "/buyer/orders/"
          )
        );
      }

      return (
        pathname ===
          href ||
        pathname.startsWith(
          `${href}/`
        )
      );
    };

  const handleLogout =
    () => {
      setMenuOpen(
        false
      );

      setNotificationsOpen(
        false
      );

      logout();

      router.push(
        "/"
      );

      router.refresh();
    };

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 border-b border-[#E6D8CB] bg-[#FBF6ED]/95 backdrop-blur-xl">
        <div className="grid min-h-[70px] grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-3 py-2 sm:min-h-[78px] sm:px-6 lg:gap-5 lg:px-8">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setSearchOpen(
                  false
                );

                setNotificationsOpen(
                  false
                );

                setMenuOpen(
                  true
                );
              }}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#4A1724] transition hover:bg-[#F0E2D6] lg:hidden"
              aria-label="Open navigation menu"
            >
              <MenuIcon />
            </button>

            {user ? (
              <Link
                href="/profile"
                className="min-w-0 max-w-[7rem] truncate text-[10px] font-black text-[#4A1724] min-[390px]:max-w-[9rem] min-[390px]:text-[11px] sm:max-w-[14rem] sm:text-sm lg:hidden"
              >
                Welcome,{" "}
                {
                  mobileDisplayName
                }
              </Link>
            ) : (
              <button
                type="button"
                onClick={() =>
                  openAuth(
                    "login",
                    "client"
                  )
                }
                className="truncate text-[10px] font-black text-[#4A1724] min-[390px]:text-[11px] sm:text-sm lg:hidden"
              >
                Sign up / Login
              </button>
            )}

            <form
              onSubmit={
                handleSearch
              }
              className="relative hidden w-full max-w-[19rem] lg:block xl:max-w-[23rem]"
              role="search"
            >
              <input
                value={
                  query
                }
                onChange={(
                  event
                ) =>
                  setQuery(
                    event.target.value
                  )
                }
                onFocus={() =>
                  setSearchFocused(
                    true
                  )
                }
                onBlur={() =>
                  window.setTimeout(
                    () =>
                      setSearchFocused(
                        false
                      ),
                    120
                  )
                }
                placeholder="Search CampusMart"
                className="h-11 w-full rounded-xl border border-[#E5D8CC] bg-white/75 py-2 pl-4 pr-11 text-sm font-medium outline-none focus:border-[#8A3D48] focus:bg-white"
              />

              <button
                type="submit"
                className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-[#6F2232]"
                aria-label="Search"
              >
                <SearchIcon />
              </button>

              {searchFocused &&
              query.length >
                0 &&
              searchSuggestions.length >
                0 ? (
                <div className="absolute left-0 right-0 top-12 z-20 rounded-xl border border-[#E5D8CC] bg-[#FBF6ED] p-2 shadow-xl">
                  {searchSuggestions.map(
                    (
                      suggestion
                    ) => (
                      <button
                        key={
                          suggestion
                        }
                        type="button"
                        onMouseDown={() => {
                          setQuery(
                            suggestion
                          );

                          router.push(
                            `/marketplace/search?q=${encodeURIComponent(
                              suggestion
                            )}`
                          );
                        }}
                        className="block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-[#4A1724] hover:bg-[#F0E2D6]"
                      >
                        {
                          suggestion
                        }
                      </button>
                    )
                  )}
                </div>
              ) : null}
            </form>
          </div>

          <Link
            href="/"
            className="justify-self-center whitespace-nowrap text-[15px] font-black tracking-tight text-black sm:text-xl lg:text-[26px]"
          >
            CampusMart
          </Link>

          <div className="flex min-w-0 items-center justify-end gap-0 lg:gap-1.5">
            {user ? (
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(
                    false
                  );

                  setSearchOpen(
                    false
                  );

                  setNotificationsOpen(
                    (
                      open
                    ) =>
                      !open
                  );

                  if (
                    !notificationsOpen
                  ) {
                    void loadNotifications();
                  }
                }}
                className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#4A1724] transition hover:bg-[#F0E2D6]"
                aria-label={`Notifications${
                  notificationUnreadCount >
                  0
                    ? `, ${notificationUnreadCount} unread`
                    : ""
                }`}
              >
                <BellIcon />

                <CountBadge
                  count={
                    notificationUnreadCount
                  }
                />
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => {
                setMenuOpen(
                  false
                );

                setNotificationsOpen(
                  false
                );

                setSearchOpen(
                  true
                );
              }}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#4A1724] transition hover:bg-[#F0E2D6] lg:hidden"
              aria-label="Open search"
            >
              <SearchIcon />
            </button>

            <Link
              href="/messages"
              className="relative hidden h-10 w-10 items-center justify-center rounded-full text-[#4A1724] transition hover:bg-[#F0E2D6] lg:inline-flex"
            >
              <MessageIcon />

              <CountBadge
                count={
                  messageUnreadCount
                }
              />
            </Link>

            <Link
              href="/marketplace/favourites"
              className="relative hidden h-10 w-10 items-center justify-center rounded-full text-[#4A1724] transition hover:bg-[#F0E2D6] lg:inline-flex"
            >
              <NavHeartIcon className="h-6 w-6" />

              <CountBadge
                count={
                  savedCount
                }
              />
            </Link>

            <Link
              href="/cart"
              className="relative hidden h-10 w-10 items-center justify-center rounded-full text-[#4A1724] transition hover:bg-[#F0E2D6] lg:inline-flex"
            >
              <CartIcon />

              <CountBadge
                count={
                  itemCount
                }
              />
            </Link>

            {user ? (
              <Link
                href="/profile"
                className="hidden min-w-0 max-w-[14rem] items-center gap-2 rounded-full border border-[#DDCDBF] bg-white/65 py-1.5 pl-1.5 pr-3 text-[#4A1724] hover:bg-white lg:flex"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#4A1724] text-[#FBF6ED]">
                  {user.avatarUrl ? (
                    <img
                      src={
                        user.avatarUrl
                      }
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <UserIcon className="h-5 w-5" />
                  )}
                </span>

                <span className="min-w-0">
                  <span className="block truncate text-[12px] font-black">
                    {
                      displayName
                    }
                  </span>

                  <span className="block text-[9px] font-bold uppercase tracking-[0.12em] text-[#8A7070]">
                    {user.role ===
                    "vendor"
                      ? "Seller"
                      : "Buyer"}
                  </span>
                </span>
              </Link>
            ) : (
              <button
                type="button"
                onClick={() =>
                  openAuth(
                    "login",
                    "client"
                  )
                }
                className="hidden rounded-full bg-[#4A1724] px-4 py-2 text-xs font-black text-white lg:inline-flex"
              >
                Sign up / Login
              </button>
            )}
          </div>
        </div>
      </header>

      <div className="h-[70px] sm:h-[78px]" />

      {notificationsOpen &&
      user ? (
        <>
          <button
            type="button"
            onClick={() =>
              setNotificationsOpen(
                false
              )
            }
            className="fixed inset-0 z-[54] bg-black/5"
            aria-label="Close notifications"
          />

          <section className="fixed right-3 top-[78px] z-[60] w-[calc(100%-1.5rem)] max-w-[390px] overflow-hidden rounded-[22px] border border-[#E5D8CC] bg-[#FBF6ED]/98 shadow-2xl backdrop-blur-2xl sm:right-6 sm:top-[86px]">
            <div className="flex items-center justify-between border-b border-[#E5D8CC] px-4 py-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[#8A6670]">
                  CampusMart
                </p>

                <h2 className="mt-0.5 text-lg font-black text-[#4A1724]">
                  Notifications
                </h2>
              </div>

              {notificationUnreadCount >
              0 ? (
                <button
                  type="button"
                  onClick={() =>
                    void markAllNotificationsRead()
                  }
                  className="text-xs font-black text-[#6F2232]"
                >
                  Mark all read
                </button>
              ) : null}
            </div>

            <div className="max-h-[62vh] overflow-y-auto">
              {notificationLoading &&
              notifications.length ===
                0 ? (
                <div className="space-y-3 p-4">
                  {Array.from({
                    length:
                      3,
                  }).map(
                    (
                      _,
                      index
                    ) => (
                      <div
                        key={
                          index
                        }
                        className="h-20 animate-pulse rounded-xl bg-[#F0E2D6]"
                      />
                    )
                  )}
                </div>
              ) : null}

              {!notificationLoading &&
              notifications.length ===
                0 ? (
                <div className="px-6 py-10 text-center">
                  <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#F0E2D6] text-[#6F2232]">
                    <BellIcon className="h-6 w-6" />
                  </span>

                  <p className="mt-4 font-black text-[#4A1724]">
                    You&apos;re all caught up.
                  </p>

                  <p className="mt-1 text-sm text-slate-500">
                    Order updates will appear here.
                  </p>
                </div>
              ) : null}

              {notifications.map(
                (
                  notification
                ) => (
                  <button
                    key={
                      notification.id
                    }
                    type="button"
                    onClick={() =>
                      void markNotificationRead(
                        notification
                      )
                    }
                    className={`flex w-full gap-3 border-b border-[#EEE2D7] px-4 py-4 text-left transition hover:bg-[#F7EDE3] ${
                      notification.readAt
                        ? "bg-transparent"
                        : "bg-[#FFF8EE]"
                    }`}
                  >
                    <span
                      className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
                        notification.readAt
                          ? "bg-transparent"
                          : "bg-accent-400"
                      }`}
                    />

                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-3">
                        <span className="font-black text-[#351019]">
                          {
                            notification.title
                          }
                        </span>

                        <span className="shrink-0 text-[10px] font-bold text-[#9A8280]">
                          {notificationTime(
                            notification.createdAt
                          )}
                        </span>
                      </span>

                      <span className="mt-1 block text-sm leading-5 text-slate-600">
                        {
                          notification.message
                        }
                      </span>
                    </span>
                  </button>
                )
              )}
            </div>
          </section>
        </>
      ) : null}

      <div
        className={`fixed inset-0 z-[70] transition lg:hidden ${
          searchOpen
            ? "visible"
            : "invisible delay-200"
        }`}
      >
        <button
          type="button"
          className={`absolute inset-0 bg-[#2A0C14]/20 backdrop-blur-[5px] transition-opacity ${
            searchOpen
              ? "opacity-100"
              : "opacity-0"
          }`}
          onClick={() =>
            setSearchOpen(
              false
            )
          }
        />

        <section
          className={`relative w-full border-b border-[#E5D8CC] bg-[#FBF6ED]/95 px-4 pb-6 pt-4 shadow-xl backdrop-blur-xl transition-transform ${
            searchOpen
              ? "translate-y-0"
              : "-translate-y-full"
          }`}
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-black text-[#4A1724]">
              Search CampusMart
            </h2>

            <button
              type="button"
              onClick={() =>
                setSearchOpen(
                  false
                )
              }
              className="flex h-10 w-10 items-center justify-center rounded-full text-[#4A1724]"
            >
              <CloseIcon />
            </button>
          </div>

          <form
            onSubmit={
              handleSearch
            }
            className="relative"
          >
            <input
              value={
                query
              }
              onChange={(
                event
              ) =>
                setQuery(
                  event.target.value
                )
              }
              placeholder="What are you looking for?"
              className="h-12 w-full rounded-xl border border-[#E5D8CC] bg-white py-2 pl-4 pr-12 outline-none focus:border-[#8A3D48]"
              autoFocus={
                searchOpen
              }
            />

            <button
              type="submit"
              className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-[#4A1724]"
            >
              <SearchIcon />
            </button>
          </form>
        </section>
      </div>

      <div
        className={`fixed inset-0 z-[65] transition lg:hidden ${
          menuOpen
            ? "visible"
            : "invisible delay-300"
        }`}
      >
        <button
          type="button"
          onClick={() =>
            setMenuOpen(
              false
            )
          }
          className={`absolute inset-0 bg-white/5 backdrop-blur-[7px] transition-opacity ${
            menuOpen
              ? "opacity-100"
              : "opacity-0"
          }`}
        />

        <button
          type="button"
          onClick={() =>
            setMenuOpen(
              false
            )
          }
          className={`absolute left-4 top-4 flex h-11 w-11 items-center justify-center rounded-full border border-[#E5D8CC] bg-[#FBF6ED]/95 text-[#4A1724] shadow-xl ${
            menuOpen
              ? "scale-100 opacity-100"
              : "scale-90 opacity-0"
          }`}
        >
          <CloseIcon />
        </button>

        <nav className="absolute left-4 top-[82px] flex w-[min(84vw,320px)] flex-col gap-3">
          {secondaryLinks.map(
            (
              item,
              index
            ) => {
              const active =
                isLinkActive(
                  item.href
                );

              return (
                <Link
                  key={
                    item.href
                  }
                  href={
                    item.href
                  }
                  onClick={() =>
                    setMenuOpen(
                      false
                    )
                  }
                  style={{
                    animationDelay:
                      `${60 + index * 75}ms`,
                  }}
                  className={`${
                    menuOpen
                      ? "floating-menu-item"
                      : "opacity-0"
                  } flex items-center gap-4 rounded-[18px] border px-4 py-3.5 shadow-xl backdrop-blur-xl ${
                    active
                      ? "border-[#8A3D48] bg-[#4A1724] text-white"
                      : "border-[#E5D8CC] bg-[#FBF6ED]/95 text-[#4A1724]"
                  }`}
                >
                  <span
                    className={`flex h-10 w-10 items-center justify-center rounded-full ${
                      active
                        ? "bg-white/15"
                        : "bg-[#F0E2D6]"
                    }`}
                  >
                    <item.Icon className="h-5 w-5" />
                  </span>

                  <span className="text-base font-black">
                    {
                      item.label
                    }
                  </span>
                </Link>
              );
            }
          )}

          {user ? (
            <button
              type="button"
              onClick={
                handleLogout
              }
              className={`${
                menuOpen
                  ? "floating-menu-item"
                  : "opacity-0"
              } rounded-[18px] border border-[#E5D8CC] bg-[#FBF6ED]/95 px-5 py-4 text-left text-base font-black text-[#8A2635] shadow-xl backdrop-blur-xl`}
            >
              Log out
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setMenuOpen(
                  false
                );

                openAuth(
                  "login",
                  "client"
                );
              }}
              className={`${
                menuOpen
                  ? "floating-menu-item"
                  : "opacity-0"
              } rounded-[18px] border border-[#E5D8CC] bg-[#FBF6ED]/95 px-5 py-4 text-left text-base font-black text-[#4A1724] shadow-xl backdrop-blur-xl`}
            >
              Sign up / Login
            </button>
          )}
        </nav>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-[#E4D8CC] bg-[#FBF6ED]/95 px-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_24px_rgba(74,23,36,0.08)] backdrop-blur-xl lg:hidden">
        {mobileLinks.map(
          (
            item
          ) => {
            const active =
              isLinkActive(
                item.href
              );

            const count =
              item.href ===
              "/marketplace/favourites"
                ? savedCount
                : item.href ===
                    "/cart"
                  ? itemCount
                  : item.href ===
                      "/messages"
                    ? messageUnreadCount
                    : 0;

            return (
              <Link
                key={
                  item.href
                }
                href={
                  item.href
                }
                className={`flex min-h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 text-[10px] font-bold ${
                  active
                    ? "text-[#4A1724]"
                    : "text-[#8A7070]"
                }`}
              >
                <span
                  className={`relative flex h-8 min-w-8 items-center justify-center rounded-full ${
                    active
                      ? "bg-[#F0E2D6]"
                      : ""
                  }`}
                >
                  <item.Icon
                    className={`h-5 w-5 ${
                      active
                        ? "text-[#8A3D48]"
                        : "text-[#8A7070]"
                    }`}
                  />

                  <CountBadge
                    count={
                      count
                    }
                  />
                </span>

                <span className="max-w-full truncate">
                  {
                    item.label
                  }
                </span>
              </Link>
            );
          }
        )}
      </nav>

      <nav className="fixed bottom-5 left-1/2 z-40 hidden -translate-x-1/2 items-center gap-1 rounded-[24px] border border-[#DDCDBF] bg-[#FBF6ED]/95 p-2 shadow-[0_18px_50px_rgba(74,23,36,0.18)] backdrop-blur-xl lg:flex">
        {desktopDockLinks.map(
          (
            item
          ) => {
            const active =
              isLinkActive(
                item.href
              );

            return (
              <Link
                key={
                  item.href
                }
                href={
                  item.href
                }
                className={`group flex min-w-[76px] flex-col items-center justify-center gap-1 rounded-[17px] px-2.5 py-2 text-[10px] font-black transition xl:min-w-[82px] ${
                  active
                    ? "bg-[#4A1724] text-white shadow-sm"
                    : "text-[#755861] hover:bg-[#F0E2D6] hover:text-[#4A1724]"
                }`}
              >
                <item.Icon className="h-5 w-5" />

                <span className="whitespace-nowrap">
                  {
                    item.label
                  }
                </span>
              </Link>
            );
          }
        )}
      </nav>
    </>
  );
}