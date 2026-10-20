"use client";

import Link from "next/link";

import type {
  ReactNode,
} from "react";

import {
  usePathname,
} from "next/navigation";

import {
  useAuth,
} from "@/components/common/AuthContext";

const sellerLinks = [
  {
    href:
      "/vendor/dashboard",

    label:
      "Dashboard",
  },

  {
    href:
      "/vendor/listings",

    label:
      "Listings",
  },

  {
    href:
      "/vendor/orders",

    label:
      "Orders",
  },

  {
    href:
      "/vendor/pickup-points",

    label:
      "Pickup points",
  },
];

export default function VendorLayout({
  children,
}: {
  children:
    ReactNode;
}) {
  const pathname =
    usePathname();

  const {
    user,
  } =
    useAuth();

  const showSellerNavigation =
    user?.role ===
    "vendor";

  return (
    <>
      {showSellerNavigation ? (
        <div className="pointer-events-none sticky top-[70px] z-30 py-3 sm:top-[78px]">
          <div className="main-container flex justify-center">
            <nav
              className="pointer-events-auto flex max-w-full items-center gap-1 overflow-x-auto rounded-full border border-white/80 bg-[#FBF6ED]/80 p-1.5 shadow-[0_12px_34px_rgba(74,23,36,0.14)] backdrop-blur-2xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              aria-label="Seller tools"
            >
              {sellerLinks.map(
                (
                  link
                ) => {
                  const active =
                    pathname ===
                      link.href ||
                    (
                      link.href !==
                        "/vendor/dashboard" &&
                      pathname.startsWith(
                        `${link.href}/`
                      )
                    );

                  return (
                    <Link
                      key={
                        link.href
                      }
                      href={
                        link.href
                      }
                      aria-current={
                        active
                          ? "page"
                          : undefined
                      }
                      className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-black transition sm:px-5 sm:text-sm ${
                        active
                          ? "bg-[#4A1724] text-white shadow-sm"
                          : "text-[#755861] hover:bg-white/70 hover:text-[#4A1724]"
                      }`}
                    >
                      {
                        link.label
                      }
                    </Link>
                  );
                }
              )}
            </nav>
          </div>
        </div>
      ) : null}

      {
        children
      }
    </>
  );
}