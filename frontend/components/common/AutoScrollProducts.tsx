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
};

export default function AutoScrollProducts({
  products,
}: Props) {
  const scrollerRef =
    useRef<HTMLDivElement>(
      null
    );

  const userInteractingRef =
    useRef(
      false
    );

  /*
   * 1 = scrolling right
   * -1 = scrolling left
   */
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

    /*
     * Roughly 50px/sec.
     */
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

        /*
         * If every card already fits
         * on screen, there is nothing
         * to auto-scroll.
         */
        if (
          maxScroll >
            1 &&
          !userInteractingRef.current
        ) {
          scroller.scrollLeft +=
            delta *
            speed *
            directionRef.current;

          /*
           * Reverse naturally at the
           * far right instead of
           * cloning products.
           */
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

          /*
           * Reverse again when we
           * return to the beginning.
           */
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
        /*
         * Pause only while the user
         * is actively interacting
         * with the product rail.
         */
        userInteractingRef.current =
          true;
      }}
      onPointerUp={() => {
        /*
         * Allow manual scrolling to
         * settle before auto-scroll
         * resumes.
         */
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
        if (
          userInteractingRef.current
        ) {
          userInteractingRef.current =
            false;
        }
      }}
      className="flex gap-3 overflow-x-auto overscroll-x-contain pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {products.map(
        (
          product
        ) => (
          <div
            key={
              product.id
            }
            className="w-[190px] shrink-0 sm:w-[205px] lg:w-[220px]"
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