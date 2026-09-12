import type { Product } from "./products";

const STORAGE_KEY = "campusmart-listings";

export type ListingInput = Pick<Product, "title" | "category" | "price" | "description" | "images">;

export function getStoredListings(): Product[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as Product[];
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

export function saveListing(input: ListingInput, seller: string): Product {
  const listing: Product = {
    ...input,
    images: input.images.length ? input.images : ["https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=1200"],
    id: Date.now(),
    slug: input.title.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
    rating: 0,
    seller,
  };
  const next = [listing, ...getStoredListings()];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("campusmart-listings-change"));
  return listing;
}

export function deleteListing(id: number) {
  const next = getStoredListings().filter((listing) => listing.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("campusmart-listings-change"));
}