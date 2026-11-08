"use client";

import Image from "next/image";
import Link from "next/link";

import {
  useState,
  type MouseEvent,
} from "react";

import type {
  Product,
} from "@/lib/products";

import {
  formatNaira,
  isServiceCategory,
} from "@/lib/products";

import {
  useSaved,
} from "./SavedContext";

import {
  useCart,
} from "./CartContext";

import {
  useAuth,
} from "./AuthContext";

export default function ProductCard({
  product,
  compact = true,
}: {
  product: Product;
  compact?: boolean;
}) {
  const {
    isSaved,
    toggleSaved,
  } =
    useSaved();

  const {
    addToCart,
  } =
    useCart();

  const {
    user,
  } =
    useAuth();

  const [
    imageFailed,
    setImageFailed,
  ] =
    useState(
      false
    );

  const saved =
    isSaved(
      product.id
    );

  const primaryImage =
    product.images?.[0];

  const sellerHref =
    product.vendorId
      ? `/seller/${product.vendorId}`
      : null;

  const ownListing =
    Boolean(
      user &&
      product.vendorId &&
      user.id ===
        product.vendorId
    );

  const isService =
    isServiceCategory(product.category);

  const matchesUserCampus =
    Boolean(
      user &&
      ((user.universityId &&
        product.sellerUniversityId &&
        user.universityId === product.sellerUniversityId) ||
        (user.campus &&
          product.sellerCampus &&
          user.campus.trim().toLowerCase() ===
            product.sellerCampus.trim().toLowerCase()))
    );

  const hasRating =
    typeof product.rating ===
      "number" &&
    product.rating >
      0;

  const sizes =
    product.sizes ??
    [];

  const colors =
    product.colors ??
    [];

  const needsOptionSelection =
    sizes.length >
      1 ||
    colors.length >
      1;

  const handleToggleSaved =
    (
      event:
        MouseEvent<HTMLButtonElement>
    ) => {
      event.preventDefault();
      event.stopPropagation();

      const nowSaved =
        toggleSaved(
          product.id
        );

      window.dispatchEvent(
        new CustomEvent(
          "campusmart-toast",
          {
            detail: {
              message:
                nowSaved
                  ? "Saved to your wishlist"
                  : "Removed from saved listings",
            },
          }
        )
      );
    };

  const handleAddToCart =
    (
      event:
        MouseEvent<HTMLButtonElement>
    ) => {
      event.preventDefault();
      event.stopPropagation();

      if (
        ownListing
      ) {
        return;
      }

      addToCart(
        product,
        1,
        {
          selectedSize:
            sizes.length ===
            1
              ? sizes[0]
              : undefined,

          selectedColor:
            colors.length ===
            1
              ? colors[0]
              : undefined,
        }
      );
    };

  return (
    <article
      className={`campusmart-product-card group overflow-hidden border border-slate-200 bg-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md ${
        compact
          ? "rounded-xl"
          : "rounded-2xl"
      }`}
    >
      <div className="campusmart-product-image relative aspect-[4/3] overflow-hidden bg-slate-100">
        <Link
          href={`/marketplace/products/${product.id}`}
          aria-label={`View ${product.title}`}
          className="relative block h-full"
        >
          {imageFailed ||
          !primaryImage ? (
            <div className="flex h-full items-center justify-center bg-slate-900 p-4 text-center text-[10px] font-bold text-white">
              CampusMart listing
            </div>
          ) : (
            <Image
              src={
                primaryImage
              }
              alt={
                product.title
              }
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
              onError={() =>
                setImageFailed(
                  true
                )
              }
              className="object-cover transition duration-300 group-hover:scale-[1.025]"
            />
          )}
        </Link>

        {matchesUserCampus ? (
          <span className="absolute left-2.5 top-2.5 rounded-full border border-white/80 bg-white/95 px-2.5 py-1 text-[9px] font-black text-[#4A1724] shadow-sm sm:text-[10px]">
            At your campus
          </span>
        ) : null}

        <button
          type="button"
          onClick={
            handleToggleSaved
          }
          aria-pressed={saved}
          className={`absolute right-2.5 top-2.5 flex h-10 w-10 items-center justify-center rounded-full border border-white/80 bg-white/95 shadow-md backdrop-blur-md transition hover:scale-105 hover:text-[#8A3D48] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8A3D48] focus-visible:ring-offset-2 ${
            saved
              ? "text-[#8A3D48]"
              : "text-slate-600"
          }`}
          aria-label={
            saved
              ? `Remove ${product.title} from saved listings`
              : `Save ${product.title}`
          }
        >
          <svg
            viewBox="0 0 24 24"
            fill={
              saved
                ? "currentColor"
                : "none"
            }
            stroke="currentColor"
            strokeWidth="1.8"
            className="h-5 w-5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
                d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78Z"
            />
          </svg>
        </button>
      </div>

      <div className="p-2.5 sm:p-3">
        <p className="truncate text-[8px] font-black uppercase tracking-[0.14em] text-slate-400 sm:text-[9px]">
          {
            product.category
          }
        </p>

        <Link
          href={`/marketplace/products/${product.id}`}
          className="mt-1 block"
        >
          <h3 className="line-clamp-2 min-h-[2.15rem] text-[12px] font-black leading-[1.35] text-slate-950 sm:text-[13px]">
            {
              product.title
            }
          </h3>
        </Link>

        <div className="mt-2 flex min-w-0 items-center justify-between gap-2">
          {sellerHref ? (
            <Link
              href={
                sellerHref
              }
              className="min-w-0 truncate text-[9px] font-semibold text-slate-500 hover:text-black hover:underline sm:text-[10px]"
            >
              {
                product.seller
              }
            </Link>
          ) : (
            <span className="min-w-0 truncate text-[9px] text-slate-500 sm:text-[10px]">
              {
                product.seller
              }
            </span>
          )}

          <span className="shrink-0 text-[9px] font-bold text-slate-500 sm:text-[10px]">
            {hasRating
              ? `★ ${product.rating.toFixed(1)}`
              : "New"}
          </span>
        </div>

        <p className="mt-2 text-[14px] font-black text-slate-950 sm:text-[15px]">
          {formatNaira(
            product.price
          )}
        </p>

        <div className="mt-2 grid grid-cols-2 gap-1.5">
          <Link
            href={`/marketplace/products/${product.id}`}
            className="campusmart-product-action-secondary inline-flex min-h-8 items-center justify-center rounded-lg border border-slate-200 bg-white px-1.5 text-center text-[9px] font-black text-slate-800 transition hover:border-slate-400 sm:text-[10px]"
          >
            View
          </Link>

          {(needsOptionSelection || isService) &&
          !ownListing ? (
            <Link
              href={`/marketplace/products/${product.id}`}
              className="inline-flex min-h-8 items-center justify-center rounded-lg bg-accent-400 px-1.5 text-center text-[9px] font-black text-black transition hover:bg-accent-500 sm:text-[10px]"
            >
              {isService ? "Ask about service" : "Choose options"}
            </Link>
          ) : (
            <button
              type="button"
              onClick={
                handleAddToCart
              }
              disabled={
                ownListing
              }
              className="inline-flex min-h-8 items-center justify-center rounded-lg bg-accent-400 px-1.5 text-center text-[9px] font-black text-black transition hover:bg-accent-500 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 sm:text-[10px]"
            >
              {ownListing
                ? "Yours"
                : "Add"}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}