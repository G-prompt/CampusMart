"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { Product } from "@/lib/products";
import { useAuth } from "./AuthContext";

export type CartItem = {
  id: number;
  title: string;
  price: number;
  quantity: number;
};

type CartContextValue = {
  items: CartItem[];
  itemCount: number;
  productCount: number;
  subtotal: number;

  addToCart: (
    product: Product,
    quantity?: number
  ) => void;

  removeFromCart: (
    id: number
  ) => void;

  updateQuantity: (
    id: number,
    quantity: number
  ) => void;

  clearCart: () => void;
};

const CartContext =
  createContext<CartContextValue | null>(
    null
  );

const STORAGE_PREFIX =
  "campusmart-cart";

const CART_CHANGE_EVENT =
  "campusmart-cart-change";

function getStorageKey(
  userId?: string | null
) {
  if (userId) {
    return `${STORAGE_PREFIX}:user:${userId}`;
  }

  return `${STORAGE_PREFIX}:guest`;
}

function normalizeCart(
  value: unknown
): CartItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalized =
    value
      .filter(
        (
          item
        ): item is CartItem =>
          Boolean(item) &&
          typeof item.id ===
            "number" &&
          Number.isInteger(
            item.id
          ) &&
          item.id > 0 &&
          typeof item.title ===
            "string" &&
          typeof item.price ===
            "number" &&
          Number.isFinite(
            item.price
          ) &&
          item.price >= 0 &&
          typeof item.quantity ===
            "number" &&
          Number.isFinite(
            item.quantity
          )
      )
      .map((item) => ({
        id: item.id,

        title:
          item.title,

        price:
          item.price,

        quantity:
          Math.max(
            1,
            Math.floor(
              item.quantity
            )
          ),
      }));

  /*
   * Merge duplicate product IDs
   * just in case older stored cart
   * data contains duplicates.
   */
  const merged =
    new Map<
      number,
      CartItem
    >();

  for (
    const item of
    normalized
  ) {
    const existing =
      merged.get(
        item.id
      );

    if (existing) {
      merged.set(
        item.id,
        {
          ...item,

          quantity:
            existing.quantity +
            item.quantity,
        }
      );
    } else {
      merged.set(
        item.id,
        item
      );
    }
  }

  return Array.from(
    merged.values()
  );
}

function readStoredCart(
  storageKey: string
): CartItem[] {
  if (
    typeof window ===
    "undefined"
  ) {
    return [];
  }

  try {
    const stored =
      localStorage.getItem(
        storageKey
      );

    if (!stored) {
      return [];
    }

    return normalizeCart(
      JSON.parse(
        stored
      )
    );
  } catch {
    return [];
  }
}

export function CartProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const {
    user,
  } = useAuth();

  const storageKey =
    useMemo(
      () =>
        getStorageKey(
          user?.id
        ),
      [user?.id]
    );

  const [
    items,
    setItems,
  ] =
    useState<CartItem[]>(
      []
    );

  const itemsRef =
    useRef<CartItem[]>(
      []
    );

  const storageKeyRef =
    useRef(
      storageKey
    );

  /*
   * When the signed-in account
   * changes, switch immediately
   * to that account's own cart.
   */
  useEffect(() => {
    storageKeyRef.current =
      storageKey;

    const next =
      readStoredCart(
        storageKey
      );

    itemsRef.current =
      next;

    setItems(
      next
    );
  }, [
    storageKey,
  ]);

  /*
   * Keep separate tabs and
   * same-page CampusMart
   * components in sync.
   */
  useEffect(() => {
    const syncCart =
      () => {
        const next =
          readStoredCart(
            storageKey
          );

        itemsRef.current =
          next;

        setItems(
          next
        );
      };

    const handleStorage = (
      event: StorageEvent
    ) => {
      if (
        event.key ===
        storageKey
      ) {
        syncCart();
      }
    };

    const handleCartChange = (
      event: Event
    ) => {
      const customEvent =
        event as CustomEvent<{
          storageKey?: string;
        }>;

      if (
        !customEvent.detail
          ?.storageKey ||
        customEvent.detail
          .storageKey ===
          storageKey
      ) {
        syncCart();
      }
    };

    window.addEventListener(
      "storage",
      handleStorage
    );

    window.addEventListener(
      CART_CHANGE_EVENT,
      handleCartChange
    );

    return () => {
      window.removeEventListener(
        "storage",
        handleStorage
      );

      window.removeEventListener(
        CART_CHANGE_EVENT,
        handleCartChange
      );
    };
  }, [
    storageKey,
  ]);

  const commitCart =
    useCallback(
      (
        nextItems: CartItem[]
      ) => {
        const normalized =
          normalizeCart(
            nextItems
          );

        itemsRef.current =
          normalized;

        setItems(
          normalized
        );

        const activeStorageKey =
          storageKeyRef.current;

        localStorage.setItem(
          activeStorageKey,
          JSON.stringify(
            normalized
          )
        );

        window.dispatchEvent(
          new CustomEvent(
            CART_CHANGE_EVENT,
            {
              detail: {
                storageKey:
                  activeStorageKey,
              },
            }
          )
        );
      },
      []
    );

  const addToCart =
    useCallback(
      (
        product: Product,
        quantity = 1
      ) => {
        const safeQuantity =
          Math.max(
            1,
            Math.floor(
              quantity
            )
          );

        const current =
          itemsRef.current;

        const existing =
          current.find(
            (item) =>
              item.id ===
              product.id
          );

        let nextItems:
          CartItem[];

        if (existing) {
          nextItems =
            current.map(
              (item) =>
                item.id ===
                product.id
                  ? {
                      ...item,

                      quantity:
                        item.quantity +
                        safeQuantity,
                    }
                  : item
            );
        } else {
          nextItems = [
            ...current,

            {
              id:
                product.id,

              title:
                product.title,

              price:
                product.price,

              quantity:
                safeQuantity,
            },
          ];
        }

        commitCart(
          nextItems
        );

        window.dispatchEvent(
          new CustomEvent(
            "campusmart-toast",
            {
              detail: {
                message:
                  `${product.title} added to cart`,
              },
            }
          )
        );
      },
      [
        commitCart,
      ]
    );

  const removeFromCart =
    useCallback(
      (
        id: number
      ) => {
        commitCart(
          itemsRef.current.filter(
            (item) =>
              item.id !==
              id
          )
        );
      },
      [
        commitCart,
      ]
    );

  const updateQuantity =
    useCallback(
      (
        id: number,
        quantity: number
      ) => {
        if (
          quantity <= 0
        ) {
          commitCart(
            itemsRef.current.filter(
              (item) =>
                item.id !==
                id
            )
          );

          return;
        }

        const safeQuantity =
          Math.max(
            1,
            Math.floor(
              quantity
            )
          );

        commitCart(
          itemsRef.current.map(
            (item) =>
              item.id ===
              id
                ? {
                    ...item,

                    quantity:
                      safeQuantity,
                  }
                : item
          )
        );
      },
      [
        commitCart,
      ]
    );

  const clearCart =
    useCallback(
      () => {
        commitCart(
          []
        );
      },
      [
        commitCart,
      ]
    );

  const itemCount =
    useMemo(
      () =>
        items.reduce(
          (
            total,
            item
          ) =>
            total +
            item.quantity,
          0
        ),
      [
        items,
      ]
    );

  const productCount =
    items.length;

  const subtotal =
    useMemo(
      () =>
        items.reduce(
          (
            total,
            item
          ) =>
            total +
            item.price *
              item.quantity,
          0
        ),
      [
        items,
      ]
    );

  const value =
    useMemo(
      () => ({
        items,
        itemCount,
        productCount,
        subtotal,

        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
      }),
      [
        items,
        itemCount,
        productCount,
        subtotal,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
      ]
    );

  return (
    <CartContext.Provider
      value={value}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context =
    useContext(
      CartContext
    );

  if (!context) {
    throw new Error(
      "useCart must be used within a CartProvider"
    );
  }

  return context;
}