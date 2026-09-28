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

import { useAuth } from "./AuthContext";

type SavedContextValue = {
  savedIds: number[];
  savedCount: number;

  isSaved: (
    productId: number
  ) => boolean;

  saveProduct: (
    productId: number
  ) => void;

  removeSaved: (
    productId: number
  ) => void;

  toggleSaved: (
    productId: number
  ) => boolean;

  clearSaved: () => void;
};

const SavedContext =
  createContext<SavedContextValue | null>(
    null
  );

const STORAGE_PREFIX =
  "campusmart-saved-products";

function getStorageKey(
  userId?: string | null
) {
  if (userId) {
    return `${STORAGE_PREFIX}:user:${userId}`;
  }

  return `${STORAGE_PREFIX}:guest`;
}

function normalizeSavedIds(
  value: unknown
): number[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return [
    ...new Set(
      value
        .map((item) =>
          Number(item)
        )
        .filter(
          (item) =>
            Number.isInteger(
              item
            ) &&
            item > 0
        )
    ),
  ];
}

function readStoredSaved(
  storageKey: string
): number[] {
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

    return normalizeSavedIds(
      JSON.parse(stored)
    );
  } catch {
    return [];
  }
}

export function SavedProvider({
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
    savedIds,
    setSavedIds,
  ] = useState<number[]>(
    []
  );

  const savedRef =
    useRef<number[]>([]);

  const storageKeyRef =
    useRef(storageKey);

  /*
   * Whenever the signed-in account
   * changes, switch to that account's
   * own saved-items storage.
   */
  useEffect(() => {
    storageKeyRef.current =
      storageKey;

    const next =
      readStoredSaved(
        storageKey
      );

    savedRef.current =
      next;

    setSavedIds(
      next
    );
  }, [storageKey]);

  /*
   * Sync changes from other tabs and
   * same-tab CampusMart events.
   */
  useEffect(() => {
    const syncSaved =
      () => {
        const next =
          readStoredSaved(
            storageKey
          );

        savedRef.current =
          next;

        setSavedIds(
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
        syncSaved();
      }
    };

    const handleWishlistChange =
      (
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
          syncSaved();
        }
      };

    window.addEventListener(
      "storage",
      handleStorage
    );

    window.addEventListener(
      "campusmart-wishlist-change",
      handleWishlistChange
    );

    return () => {
      window.removeEventListener(
        "storage",
        handleStorage
      );

      window.removeEventListener(
        "campusmart-wishlist-change",
        handleWishlistChange
      );
    };
  }, [storageKey]);

  const commitSaved =
    useCallback(
      (
        nextIds: number[]
      ) => {
        const normalized =
          normalizeSavedIds(
            nextIds
          );

        savedRef.current =
          normalized;

        setSavedIds(
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
            "campusmart-wishlist-change",
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

  const isSaved =
    useCallback(
      (
        productId: number
      ) =>
        savedRef.current.includes(
          productId
        ),
      []
    );

  const saveProduct =
    useCallback(
      (
        productId: number
      ) => {
        if (
          savedRef.current.includes(
            productId
          )
        ) {
          return;
        }

        commitSaved([
          ...savedRef.current,
          productId,
        ]);
      },
      [commitSaved]
    );

  const removeSaved =
    useCallback(
      (
        productId: number
      ) => {
        commitSaved(
          savedRef.current.filter(
            (id) =>
              id !==
              productId
          )
        );
      },
      [commitSaved]
    );

  const toggleSaved =
    useCallback(
      (
        productId: number
      ) => {
        const currentlySaved =
          savedRef.current.includes(
            productId
          );

        if (
          currentlySaved
        ) {
          commitSaved(
            savedRef.current.filter(
              (id) =>
                id !==
                productId
            )
          );

          return false;
        }

        commitSaved([
          ...savedRef.current,
          productId,
        ]);

        return true;
      },
      [commitSaved]
    );

  const clearSaved =
    useCallback(() => {
      commitSaved([]);
    }, [commitSaved]);

  const savedCount =
    savedIds.length;

  const value =
    useMemo(
      () => ({
        savedIds,
        savedCount,

        isSaved,
        saveProduct,
        removeSaved,
        toggleSaved,
        clearSaved,
      }),
      [
        savedIds,
        savedCount,
        isSaved,
        saveProduct,
        removeSaved,
        toggleSaved,
        clearSaved,
      ]
    );

  return (
    <SavedContext.Provider
      value={value}
    >
      {children}
    </SavedContext.Provider>
  );
}

export function useSaved() {
  const context =
    useContext(
      SavedContext
    );

  if (!context) {
    throw new Error(
      "useSaved must be used within a SavedProvider"
    );
  }

  return context;
}