"use client";

import Link from "next/link";

import {
  FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  usePathname,
  useRouter,
} from "next/navigation";

import { useAuth } from "./AuthContext";
import { useCart } from "./CartContext";
import { useSaved } from "./SavedContext";

import {
  CartIcon,
  HeartIcon as NavHeartIcon,
  HomeIcon,
  UserIcon,
} from "./icons";

const navLinks = [
  {
    href: "/marketplace",
    label: "Marketplace",
  },
  {
    href: "/categories",
    label: "Categories",
  },
  {
    href: "/sell",
    label: "Sell",
  },
  {
    href: "/wallet",
    label: "Wallet",
  },
  {
    href: "/support",
    label: "Support",
  },
];

const mobileLinks = [
  {
    href: "/marketplace",
    label: "Shop",
    Icon: HomeIcon,
  },
  {
    href: "/marketplace/favourites",
    label: "Saved",
    Icon: NavHeartIcon,
  },
  {
    href: "/cart",
    label: "Cart",
    Icon: CartIcon,
  },
  {
    href: "/profile",
    label: "Profile",
    Icon: UserIcon,
  },
];

function MenuIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.3"
      aria-hidden="true"
      className="h-6 w-6"
    >
      <path
        strokeLinecap="round"
        d="M4 7h16M4 12h16M4 17h16"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
      className="h-6 w-6"
    >
      <path
        strokeLinecap="round"
        d="m6 6 12 12M18 6 6 18"
      />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      aria-hidden="true"
      className="h-5 w-5"
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

function HeartIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.3"
      aria-hidden="true"
      className="h-6 w-6"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20.8 5.8a5.5 5.5 0 0 0-7.8 0L12 6.9l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 22l8.8-8.4a5.5 5.5 0 0 0 0-7.8Z"
      />
    </svg>
  );
}

function CountBadge({
  count,
}: {
  count: number;
}) {
  if (count <= 0) {
    return null;
  }

  return (
    <span className="absolute -right-1 -top-1 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent-400 px-1 text-[10px] font-bold leading-none text-black shadow-sm">
      {count > 9
        ? "9+"
        : count}
    </span>
  );
}

export default function Navbar() {
  const {
    user,
    openAuth,
    logout,
  } = useAuth();

  const {
    itemCount,
  } = useCart();

  const {
    savedCount,
  } = useSaved();

  const router =
    useRouter();

  const pathname =
    usePathname();

  const [
    sidebarOpen,
    setSidebarOpen,
  ] = useState(false);

  const [
    searchOpen,
    setSearchOpen,
  ] = useState(false);

  const [
    query,
    setQuery,
  ] = useState("");

  const [
    searchFocused,
    setSearchFocused,
  ] = useState(false);

  const searchCloseRef =
    useRef<HTMLButtonElement>(
      null
    );

  const sidebarCloseRef =
    useRef<HTMLButtonElement>(
      null
    );

  const firstName =
    user?.name
      ?.trim()
      .split(/\s+/)[0] ||
    "";

  const showHomeWelcome =
    pathname === "/" &&
    Boolean(user);

  const searchSuggestions = [
    "Books",
    "Technology",
    "Events",
    "Clothes",
    "Food",
  ].filter(
    (
      suggestion
    ) =>
      suggestion
        .toLowerCase()
        .includes(
          query.toLowerCase()
        )
  );

  useEffect(() => {
    if (
      !sidebarOpen
    ) {
      return;
    }

    const closeOnEscape = (
      event: KeyboardEvent
    ) => {
      if (
        event.key ===
        "Escape"
      ) {
        setSidebarOpen(
          false
        );
      }
    };

    document.body.style.overflow =
      "hidden";

    window.addEventListener(
      "keydown",
      closeOnEscape
    );

    sidebarCloseRef.current?.focus();

    return () => {
      document.body.style.overflow =
        "";

      window.removeEventListener(
        "keydown",
        closeOnEscape
      );
    };
  }, [
    sidebarOpen,
  ]);

  useEffect(() => {
    if (
      !searchOpen
    ) {
      return;
    }

    const closeOnEscape = (
      event: KeyboardEvent
    ) => {
      if (
        event.key ===
        "Escape"
      ) {
        setSearchOpen(
          false
        );
      }
    };

    document.body.style.overflow =
      "hidden";

    window.addEventListener(
      "keydown",
      closeOnEscape
    );

    searchCloseRef.current?.focus();

    return () => {
      document.body.style.overflow =
        "";

      window.removeEventListener(
        "keydown",
        closeOnEscape
      );
    };
  }, [
    searchOpen,
  ]);

  const handleLogout =
    () => {
      logout();

      setSidebarOpen(
        false
      );

      router.push(
        "/"
      );
    };

  const handleOpenAuth = (
    mode:
      | "login"
      | "register"
  ) => {
    setSidebarOpen(
      false
    );

    openAuth(
      mode
    );
  };

  const handleSearch = (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    const search =
      query.trim();

    if (!search) {
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

  const isMobileLinkActive = (
    href: string
  ) => {
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
      "/marketplace/favourites"
    ) {
      return (
        pathname ===
        "/marketplace/favourites"
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

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-[#E6D8CB] bg-[#FBF6ED]/95 backdrop-blur-md">
        <div className="relative flex min-h-[70px] items-center justify-between px-3 py-2 sm:min-h-[78px] sm:px-6 lg:px-8">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:flex-none sm:gap-3">
            <button
              type="button"
              onClick={() =>
                setSidebarOpen(
                  true
                )
              }
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center text-[#4A1724] transition hover:text-[#7B293B]"
              aria-label="Open navigation menu"
              aria-expanded={
                sidebarOpen
              }
            >
              <MenuIcon />
            </button>

            {showHomeWelcome ? (
              <div className="min-w-0">
                <p className="truncate text-[10px] font-bold text-black sm:text-sm">
                  Welcome
                  back,{" "}
                  {
                    firstName
                  }
                </p>

                <div className="mt-0.5 flex items-center gap-2">
                  <Link
                    href="/marketplace"
                    className="text-[10px] font-bold text-slate-700 transition hover:text-black sm:text-xs"
                  >
                    Buy
                  </Link>

                  {user?.role ===
                  "vendor" ? (
                    <Link
                      href="/vendor/add-listing"
                      className="rounded-md bg-accent-400 px-2.5 py-1 text-[10px] font-bold text-black transition hover:bg-accent-500 sm:text-xs"
                    >
                      Sell
                    </Link>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>

          <Link
            href="/"
            className="ml-auto mr-1 shrink-0 text-[17px] font-bold tracking-tight text-black sm:absolute sm:left-1/2 sm:mr-0 sm:-translate-x-1/2 sm:text-3xl"
            aria-label="CampusMart home"
          >
            CampusMart
          </Link>

          <div className="flex shrink-0 items-center gap-0 sm:ml-auto sm:gap-2 lg:gap-4">
            <form
              onSubmit={
                handleSearch
              }
              className="relative hidden w-[clamp(14rem,27vw,31rem)] lg:block"
              role="search"
            >
              <label
                htmlFor="site-search"
                className="sr-only"
              >
                Search
                CampusMart
              </label>

              <input
                id="site-search"
                value={
                  query
                }
                onChange={(
                  event
                ) =>
                  setQuery(
                    event
                      .target
                      .value
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
                className="h-10 w-full rounded-lg border border-[#E5D8CC] bg-white/70 py-2 pl-4 pr-11 text-sm text-slate-900 outline-none transition placeholder:text-slate-500 focus:border-[#8A3D48] focus:bg-white"
              />

              <button
                type="submit"
                className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-[#6F2232]"
                aria-label="Search"
              >
                <SearchIcon />
              </button>

              {searchFocused &&
              query.length >
                0 &&
              searchSuggestions.length >
                0 ? (
                <div className="absolute left-0 right-0 top-12 z-20 rounded-lg border border-[#E5D8CC] bg-[#FBF6ED] p-2 shadow-xl">
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
                        className="block w-full rounded-md px-3 py-2 text-left text-sm font-semibold text-[#4A1724] hover:bg-[#F0E2D6]"
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

            <button
              type="button"
              onClick={() =>
                setSearchOpen(
                  true
                )
              }
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center text-[#4A1724] transition hover:text-[#7B293B] lg:hidden"
              aria-label="Open search"
            >
              <SearchIcon />
            </button>

            <Link
              href="/marketplace/favourites"
              className="relative hidden h-10 w-10 shrink-0 items-center justify-center text-[#4A1724] transition hover:text-[#7B293B] sm:inline-flex"
              aria-label={`Wishlist${
                savedCount >
                0
                  ? `, ${savedCount} saved items`
                  : ""
              }`}
            >
              <HeartIcon />

              <CountBadge
                count={
                  savedCount
                }
              />
            </Link>

            <Link
              href="/cart"
              className="relative hidden h-10 w-10 shrink-0 items-center justify-center text-[#4A1724] transition hover:text-[#7B293B] sm:inline-flex"
              aria-label={`Cart${
                itemCount >
                0
                  ? `, ${itemCount} items`
                  : ""
              }`}
            >
              <CartIcon />

              <CountBadge
                count={
                  itemCount
                }
              />
            </Link>
          </div>
        </div>
      </header>

      {/* MOBILE SEARCH */}
      <div
        className={`fixed inset-0 z-[60] transition md:hidden ${
          searchOpen
            ? "visible"
            : "invisible delay-200"
        }`}
        aria-hidden={
          !searchOpen
        }
      >
        <button
          type="button"
          className={`absolute inset-0 bg-[#2A0C14]/45 transition-opacity duration-200 ${
            searchOpen
              ? "opacity-100"
              : "opacity-0"
          }`}
          onClick={() =>
            setSearchOpen(
              false
            )
          }
          aria-label="Close search"
          tabIndex={
            searchOpen
              ? 0
              : -1
          }
        />

        <section
          className={`relative w-full bg-[#FBF6ED] px-4 pb-6 pt-4 shadow-xl transition-transform duration-200 ${
            searchOpen
              ? "translate-y-0"
              : "-translate-y-full"
          }`}
          aria-label="Search panel"
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-[#4A1724]">
              Search
              CampusMart
            </h2>

            <button
              ref={
                searchCloseRef
              }
              type="button"
              onClick={() =>
                setSearchOpen(
                  false
                )
              }
              className="inline-flex h-10 w-10 items-center justify-center text-[#4A1724]"
              aria-label="Close search"
            >
              <CloseIcon />
            </button>
          </div>

          <form
            onSubmit={
              handleSearch
            }
            className="relative w-full"
            role="search"
          >
            <label
              htmlFor="mobile-site-search"
              className="sr-only"
            >
              Search
              CampusMart
            </label>

            <input
              id="mobile-site-search"
              value={
                query
              }
              onChange={(
                event
              ) =>
                setQuery(
                  event
                    .target
                    .value
                )
              }
              placeholder="What are you looking for?"
              className="h-12 w-full rounded-lg border border-[#E5D8CC] bg-white py-2 pl-4 pr-12 text-base text-slate-900 outline-none placeholder:text-slate-500 focus:border-[#8A3D48]"
              autoFocus={
                searchOpen
              }
            />

            <button
              type="submit"
              className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-[#4A1724]"
              aria-label="Submit search"
            >
              <SearchIcon />
            </button>
          </form>
        </section>
      </div>

      {/* SIDEBAR */}
      <div
        className={`fixed inset-0 z-50 transition ${
          sidebarOpen
            ? "visible"
            : "invisible delay-300"
        }`}
        aria-hidden={
          !sidebarOpen
        }
      >
        <button
          type="button"
          className={`absolute inset-0 bg-[#2A0C14]/45 backdrop-blur-[2px] transition-opacity duration-300 ${
            sidebarOpen
              ? "opacity-100"
              : "opacity-0"
          }`}
          onClick={() =>
            setSidebarOpen(
              false
            )
          }
          aria-label="Close navigation menu"
          tabIndex={
            sidebarOpen
              ? 0
              : -1
          }
        />

        <aside
          className={`relative flex h-full w-[min(88vw,360px)] flex-col bg-[#FBF6ED] shadow-2xl transition-transform duration-300 ease-out ${
            sidebarOpen
              ? "translate-x-0"
              : "-translate-x-full"
          }`}
          aria-label="Main navigation"
        >
          <div className="flex items-center justify-end px-5 py-4">
            <button
              ref={
                sidebarCloseRef
              }
              type="button"
              onClick={() =>
                setSidebarOpen(
                  false
                )
              }
              className="inline-flex h-10 w-10 items-center justify-center text-[#4A1724]"
              aria-label="Close navigation menu"
            >
              <CloseIcon />
            </button>
          </div>

          <div className="border-y border-[#E7D9CC] p-5">
            {user ? (
              <div className="space-y-3">
                <p className="text-sm text-[#795F5F]">
                  Signed in
                  as{" "}
                  <span className="font-bold text-[#4A1724]">
                    {
                      user.name
                    }
                  </span>
                </p>

                <Link
                  href={
                    user.role ===
                    "vendor"
                      ? "/vendor/dashboard"
                      : "/buyer/dashboard"
                  }
                  onClick={() =>
                    setSidebarOpen(
                      false
                    )
                  }
                  className="block w-full rounded-[10px] border border-[#D9C5B7] bg-white/60 px-4 py-3 text-center text-sm font-bold text-[#4A1724]"
                >
                  Open dashboard
                </Link>

                <button
                  type="button"
                  onClick={
                    handleLogout
                  }
                  className="w-full rounded-[10px] bg-[#EADBD0] px-4 py-3 text-sm font-bold text-[#4A1724]"
                >
                  Sign out
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() =>
                    handleOpenAuth(
                      "login"
                    )
                  }
                  className="rounded-[10px] bg-[#EADBD0] px-4 py-3 text-sm font-bold text-[#4A1724]"
                >
                  Sign in
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleOpenAuth(
                      "register"
                    )
                  }
                  className="rounded-[10px] bg-accent-400 px-4 py-3 text-sm font-bold text-black"
                >
                  Register
                </button>
              </div>
            )}
          </div>

          <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-4 py-5">
            {navLinks.map(
              (
                item
              ) => {
                const active =
                  pathname.startsWith(
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
                      setSidebarOpen(
                        false
                      )
                    }
                    aria-current={
                      active
                        ? "page"
                        : undefined
                    }
                    className={`rounded-lg border-l-2 px-4 py-3.5 text-lg font-bold transition ${
                      active
                        ? "border-[#8A3D48] bg-[#F0E2D6] text-[#4A1724]"
                        : "border-transparent text-[#4A1724] hover:bg-[#F0E2D6]"
                    }`}
                  >
                    {
                      item.label
                    }
                  </Link>
                );
              }
            )}
          </nav>

          <div className="px-5 py-4">
            <p className="text-xs tracking-wide text-[#8A7070]">
              © CampusMart
              2026
            </p>
          </div>
        </aside>
      </div>

      {/* MOBILE BOTTOM NAV */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-[#E4D8CC] bg-[#FBF6ED]/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_24px_rgba(74,23,36,0.08)] backdrop-blur md:hidden"
        aria-label="Mobile navigation"
      >
        {mobileLinks.map(
          (
            item
          ) => {
            const active =
              isMobileLinkActive(
                item.href
              );

            const count =
              item.href ===
              "/marketplace/favourites"
                ? savedCount
                : item.href ===
                    "/cart"
                  ? itemCount
                  : 0;

            return (
              <Link
                key={
                  item.href
                }
                href={
                  item.href
                }
                aria-current={
                  active
                    ? "page"
                    : undefined
                }
                className={`flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-lg text-[11px] font-bold transition ${
                  active
                    ? "text-[#4A1724]"
                    : "text-[#8A7070]"
                }`}
              >
                <span className="relative">
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

                {
                  item.label
                }
              </Link>
            );
          }
        )}
      </nav>
    </>
  );
}