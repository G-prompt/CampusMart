export type ProductReview = {
  id: string;
  productId: number;
  author: string;
  rating: number;
  comment: string;
  createdAt: string;
};

const REVIEWS_KEY = "campusmart-product-reviews";

export function getReviews(productId: number): ProductReview[] {
  if (typeof window === "undefined") return [];
  try {
    const reviews = JSON.parse(localStorage.getItem(REVIEWS_KEY) ?? "[]") as ProductReview[];
    return reviews.filter((review) => review.productId === productId);
  } catch {
    return [];
  }
}

export function addReview(input: Omit<ProductReview, "id" | "createdAt">): ProductReview {
  const allReviews = typeof window === "undefined" ? [] : JSON.parse(localStorage.getItem(REVIEWS_KEY) ?? "[]") as ProductReview[];
  const review = { ...input, id: `${input.productId}-${Date.now()}`, createdAt: new Date().toISOString() };
  localStorage.setItem(REVIEWS_KEY, JSON.stringify([review, ...allReviews]));
  window.dispatchEvent(new CustomEvent("campusmart-reviews-change"));
  return review;
}

export function getAverageRating(productId: number, fallback: number) {
  const reviews = getReviews(productId);
  if (!reviews.length) return fallback;
  return reviews.reduce((total, review) => total + review.rating, 0) / reviews.length;
}
