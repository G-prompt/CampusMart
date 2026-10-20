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

import type {
  Product,
} from "@/lib/products";

import {
  useAuth,
} from "./AuthContext";

export type CartItem = {
  cartKey: string;

  id: number;

  title: string;

  price: number;

  quantity: number;

  vendorId?: string;

  seller?: string;

  image?: string;

  selectedSize?: string;

  selectedColor?: string;
};

type CartProduct =
  Product & {
    vendorId?: string;
  };

type CartOptions = {
  selectedSize?:
    string | null;

  selectedColor?:
    string | null;
};

type CartContextValue = {
  items:
    CartItem[];

  itemCount:
    number;

  productCount:
    number;

  subtotal:
    number;

  addToCart: (
    product:
      CartProduct,
    quantity?:
      number,
    options?:
      CartOptions
  ) => void;

  removeFromCart: (
    key:
      string | number
  ) => void;

  updateQuantity: (
    key:
      string | number,
    quantity:
      number
  ) => void;

  clearCart:
    () => void;
};

const CartContext =
  createContext<
    CartContextValue | null
  >(null);

const STORAGE_PREFIX =
  "campusmart-cart";

const CART_CHANGE_EVENT =
  "campusmart-cart-change";

function cleanOption(
  value:
    unknown
) {
  if (
    typeof value !==
    "string"
  ) {
    return undefined;
  }

  const cleaned =
    value.trim();

  return cleaned ||
    undefined;
}

function getCartKey(
  productId:
    number,
  selectedSize?:
    string,
  selectedColor?:
    string
) {
  return [
    productId,
    selectedSize ??
      "",
    selectedColor ??
      "",
  ].join(
    "::"
  );
}

function getStorageKey(
  userId?:
    string | null
) {
  return userId
    ? `${STORAGE_PREFIX}:user:${userId}`
    : `${STORAGE_PREFIX}:guest`;
}

function normalizeCart(
  value:
    unknown
): CartItem[] {
  if (
    !Array.isArray(
      value
    )
  ) {
    return [];
  }

  const merged =
    new Map<
      string,
      CartItem
    >();

  for (
    const raw of
    value
  ) {
    if (
      !raw ||
      typeof raw !==
        "object"
    ) {
      continue;
    }

    const item =
      raw as Record<
        string,
        unknown
      >;

    const id =
      Number(
        item.id
      );

    const price =
      Number(
        item.price
      );

    const quantity =
      Number(
        item.quantity
      );

    if (
      !Number.isInteger(
        id
      ) ||
      id <=
        0 ||
      typeof item.title !==
        "string" ||
      !Number.isFinite(
        price
      ) ||
      price <
        0 ||
      !Number.isFinite(
        quantity
      )
    ) {
      continue;
    }

    const selectedSize =
      cleanOption(
        item.selectedSize
      );

    const selectedColor =
      cleanOption(
        item.selectedColor
      );

    const cartKey =
      typeof item.cartKey ===
        "string" &&
      item.cartKey.trim()
        ? item.cartKey
        : getCartKey(
            id,
            selectedSize,
            selectedColor
          );

    const next: CartItem = {
      cartKey,

      id,

      title:
        item.title,

      price,

      quantity:
        Math.max(
          1,
          Math.floor(
            quantity
          )
        ),

      vendorId:
        cleanOption(
          item.vendorId
        ),

      seller:
        cleanOption(
          item.seller
        ),

      image:
        cleanOption(
          item.image
        ),

      selectedSize,

      selectedColor,
    };

    const existing =
      merged.get(
        cartKey
      );

    if (
      existing
    ) {
      merged.set(
        cartKey,
        {
          ...existing,
          ...next,

          quantity:
            existing.quantity +
            next.quantity,
        }
      );
    } else {
      merged.set(
        cartKey,
        next
      );
    }
  }

  return Array.from(
    merged.values()
  );
}

function readStoredCart(
  storageKey:
    string
) {
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

    return stored
      ? normalizeCart(
          JSON.parse(
            stored
          )
        )
      : [];
  } catch {
    return [];
  }
}

export function CartProvider({
  children,
}: {
  children:
    React.ReactNode;
}) {
  const {
    user,
  } =
    useAuth();

  const storageKey =
    useMemo(
      () =>
        getStorageKey(
          user?.id
        ),
      [
        user?.id,
      ]
    );

  const [
    items,
    setItems,
  ] =
    useState<
      CartItem[]
    >([]);

  const itemsRef =
    useRef<
      CartItem[]
    >([]);

  const storageKeyRef =
    useRef(
      storageKey
    );

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

    const handleStorage =
      (
        event:
          StorageEvent
      ) => {
        if (
          event.key ===
          storageKey
        ) {
          syncCart();
        }
      };

    const handleCartChange =
      (
        event:
          Event
      ) => {
        const customEvent =
          event as
            CustomEvent<{
              storageKey?:
                string;
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
        nextItems:
          CartItem[]
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
        product:
          CartProduct,
        quantity =
          1,
        options?:
          CartOptions
      ) => {
        const sizes =
          product.sizes ??
          [];

        const colors =
          product.colors ??
          [];

        const selectedSize =
          cleanOption(
            options?.selectedSize
          ) ??
          (
            sizes.length ===
            1
              ? sizes[0]
              : undefined
          );

        const selectedColor =
          cleanOption(
            options?.selectedColor
          ) ??
          (
            colors.length ===
            1
              ? colors[0]
              : undefined
          );

        if (
          sizes.length >
            0 &&
          (
            !selectedSize ||
            !sizes.includes(
              selectedSize
            )
          )
        ) {
          window.dispatchEvent(
            new CustomEvent(
              "campusmart-toast",
              {
                detail: {
                  message:
                    "Choose a size first",
                },
              }
            )
          );

          return;
        }

        if (
          colors.length >
            0 &&
          (
            !selectedColor ||
            !colors.includes(
              selectedColor
            )
          )
        ) {
          window.dispatchEvent(
            new CustomEvent(
              "campusmart-toast",
              {
                detail: {
                  message:
                    "Choose a colour first",
                },
              }
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

        const cartKey =
          getCartKey(
            product.id,
            selectedSize,
            selectedColor
          );

        const existing =
          itemsRef.current.find(
            (
              item
            ) =>
              item.cartKey ===
              cartKey
          );

        const nextItems =
          existing
            ? itemsRef.current.map(
                (
                  item
                ) =>
                  item.cartKey ===
                  cartKey
                    ? {
                        ...item,

                        title:
                          product.title,

                        price:
                          product.price,

                        vendorId:
                          product.vendorId ??
                          item.vendorId,

                        seller:
                          product.seller ??
                          item.seller,

                        image:
                          product.images?.[0] ??
                          item.image,

                        selectedSize,

                        selectedColor,

                        quantity:
                          item.quantity +
                          safeQuantity,
                      }
                    : item
              )
            : [
                ...itemsRef.current,

                {
                  cartKey,

                  id:
                    product.id,

                  title:
                    product.title,

                  price:
                    product.price,

                  quantity:
                    safeQuantity,

                  vendorId:
                    product.vendorId,

                  seller:
                    product.seller,

                  image:
                    product.images?.[0],

                  selectedSize,

                  selectedColor,
                },
              ];

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
        key:
          string | number
      ) => {
        commitCart(
          itemsRef.current.filter(
            (
              item
            ) =>
              typeof key ===
              "number"
                ? item.id !==
                  key
                : item.cartKey !==
                  key
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
        key:
          string | number,
        quantity:
          number
      ) => {
        if (
          quantity <=
          0
        ) {
          removeFromCart(
            key
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
            (
              item
            ) => {
              const matches =
                typeof key ===
                "number"
                  ? item.id ===
                    key
                  : item.cartKey ===
                    key;

              return matches
                ? {
                    ...item,
                    quantity:
                      safeQuantity,
                  }
                : item;
            }
          )
        );
      },
      [
        commitCart,
        removeFromCart,
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
    useMemo(
      () =>
        new Set(
          items.map(
            (
              item
            ) =>
              item.id
          )
        ).size,
      [
        items,
      ]
    );

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
      value={
        value
      }
    >
      {
        children
      }
    </CartContext.Provider>
  );
}

export function useCart() {
  const context =
    useContext(
      CartContext
    );

  if (
    !context
  ) {
    throw new Error(
      "useCart must be used within a CartProvider"
    );
  }

  return context;
}