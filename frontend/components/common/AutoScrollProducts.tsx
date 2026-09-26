"use client";

import {
  useEffect,
  useRef,
} from "react";

import ProductCard from "@/components/common/ProductCard";
import type { Product } from "@/lib/products";

type Props = {
  products: Product[];
};

export default function AutoScrollProducts({
  products,
}: Props) {
  const scrollerRef =
    useRef<HTMLDivElement>(null);

  const firstGroupRef =
    useRef<HTMLDivElement>(null);

  const userInteractingRef =
    useRef(false);

  useEffect(() => {
    const scroller =
      scrollerRef.current;

    const firstGroup =
      firstGroupRef.current;

    if (
      !scroller ||
      !firstGroup ||
      products.length === 0
    ) {
      return;
    }

    let animationFrame = 0;
    let previousTime =
      performance.now();

    /*
     * Auto-scroll speed.
     *
     * Increase this number
     * if you want it faster.
     *
     * 0.05 = about 50px/sec.
     */
    const speed = 0.05;

    const animate = (
      currentTime: number
    ) => {
      const delta =
        Math.min(
          currentTime -
            previousTime,
          50
        );

      previousTime =
        currentTime;

      /*
       * It ALWAYS scrolls by
       * itself unless the user
       * is physically touching/
       * dragging the rail.
       *
       * Hovering does NOT stop it.
       */
      if (
        !userInteractingRef.current
      ) {
        scroller.scrollLeft +=
          delta * speed;
      }

      const groupWidth =
        firstGroup
          .scrollWidth;

      /*
       * Once the original group
       * has completely passed,
       * quietly jump back by
       * exactly one group width.
       *
       * Because an identical copy
       * follows it, the user
       * cannot see the reset.
       */
      if (
        groupWidth > 0 &&
        scroller.scrollLeft >=
          groupWidth
      ) {
        scroller.scrollLeft -=
          groupWidth;
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
  }, [products]);

  if (!products.length) {
    return null;
  }

  /*
   * When there are only a few
   * products in the database,
   * repeat them enough times to
   * create a proper continuous
   * advertising rail.
   *
   * When there are eventually
   * 10, 20 or 30 products, each
   * will naturally appear.
   */
  const minimumCards = 8;

  const repetitions =
    Math.max(
      1,
      Math.ceil(
        minimumCards /
          products.length
      )
    );

  const railProducts =
    Array.from({
      length: repetitions,
    }).flatMap(
      () => products
    );

  const renderGroup = (
    duplicate = false
  ) =>
    railProducts.map(
      (product, index) => (
        <div
          key={`${
            duplicate
              ? "duplicate"
              : "original"
          }-${product.id}-${index}`}
          className="w-[190px] shrink-0 sm:w-[205px] lg:w-[220px]"
        >
          <ProductCard
            product={product}
          />
        </div>
      )
    );

  return (
    <div
      ref={scrollerRef}
      onPointerDown={() => {
        /*
         * Only pause when the
         * person actually touches
         * or drags the carousel.
         */
        userInteractingRef.current =
          true;
      }}
      onPointerUp={() => {
        /*
         * Give them a moment after
         * dragging, then resume
         * advertising automatically.
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
        /*
         * Normal mouse hover does
         * NOT pause the animation.
         *
         * This simply makes sure a
         * finished drag cannot leave
         * it permanently paused.
         */
        if (
          userInteractingRef.current
        ) {
          userInteractingRef.current =
            false;
        }
      }}
      className="flex overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <div
        ref={firstGroupRef}
        className="flex shrink-0 gap-3 pr-3"
      >
        {renderGroup()}
      </div>

      <div
        className="flex shrink-0 gap-3 pr-3"
        aria-hidden="true"
      >
        {renderGroup(true)}
      </div>
    </div>
  );
}