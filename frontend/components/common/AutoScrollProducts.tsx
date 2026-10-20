"use client";

import {
  useEffect,
  useRef,
} from "react";

import ProductCard from "@/components/common/ProductCard";

import type {
  Product,
} from "@/lib/products";

type Props = {
  products:
    Product[];

  size?:
    | "default"
    | "small";
};

export default function AutoScrollProducts({
  products,
  size =
    "default",
}: Props) {
  const scrollerRef =
    useRef<HTMLDivElement>(
      null
    );

  const userInteractingRef =
    useRef(
      false
    );

  const directionRef =
    useRef<
      1 | -1
    >(
      1
    );

  useEffect(() => {
    const scroller =
      scrollerRef.current;

    if (
      !scroller ||
      products.length ===
        0
    ) {
      return;
    }

    let animationFrame =
      0;

    let previousTime =
      performance.now();

    const speed =
      0.05;

    const animate =
      (
        currentTime:
          number
      ) => {
        const delta =
          Math.min(
            currentTime -
              previousTime,
            50
          );

        previousTime =
          currentTime;

        const maxScroll =
          Math.max(
            0,
            scroller.scrollWidth -
              scroller.clientWidth
          );

        if (
          maxScroll >
            1 &&
          !userInteractingRef.current
        ) {
          scroller.scrollLeft +=
            delta *
            speed *
            directionRef.current;

          if (
            scroller.scrollLeft >=
            maxScroll -
              1
          ) {
            scroller.scrollLeft =
              maxScroll;

            directionRef.current =
              -1;
          }

          if (
            scroller.scrollLeft <=
            1
          ) {
            scroller.scrollLeft =
              0;

            directionRef.current =
              1;
          }
        }

        animationFrame =
          requestAnimationFrame(
            animate
          );
      };

    animationFrame =
      requestAnimationFrame(
        animate
      );

    return () => {
      cancelAnimationFrame(
        animationFrame
      );
    };
  }, [
    products,
  ]);

  if (
    !products.length
  ) {
    return null;
  }

  return (
    <div
      ref={
        scrollerRef
      }
      onPointerDown={() => {
        userInteractingRef.current =
          true;
      }}
      onPointerUp={() => {
        window.setTimeout(
          () => {
            userInteractingRef.current =
              false;
          },
          700
        );
      }}
      onPointerCancel={() => {
        userInteractingRef.current =
          false;
      }}
      onPointerLeave={() => {
        userInteractingRef.current =
          false;
      }}
      className="flex gap-2.5 overflow-x-auto overscroll-x-contain pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {products.map(
        (
          product
        ) => (
          <div
            key={
              product.id
            }
            className={
              size ===
              "small"
                ? "w-[145px] shrink-0 sm:w-[160px] lg:w-[175px]"
                : "w-[180px] shrink-0 sm:w-[195px] lg:w-[210px]"
            }
          >
            <ProductCard
              product={
                product
              }
            />
          </div>
        )
      )}
    </div>
  );
}