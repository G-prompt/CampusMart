export type ProductReview = {
  id: string;

  rating: number;

  comment: string;

  createdAt: string;

  author: {
    id: string;

    name: string;
  };
};

export type ReviewEligibility = {
  canReview: boolean;

  reason:
    | "eligible"
    | "already_reviewed"
    | "wait_period"
    | "purchase_required";

  eligibleAt:
    | string
    | null;
};