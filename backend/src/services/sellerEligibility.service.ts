import {
  Prisma,
  StudentVerificationStatus,
  UserRole,
  VendorAccessStatus,
  VendorVerificationStatus,
} from "../generated/prisma/client";

import {
  prisma,
} from "../lib/prisma";

/*
 * =======================================================
 * CAMPUSMART SELLER ELIGIBILITY
 * =======================================================
 *
 * Single source of truth for:
 *
 * - what a seller is missing
 * - whether the seller is allowed to sell
 * - what seller access status should be
 *
 * IMPORTANT:
 *
 * Student verification,
 * Vendor Verification,
 * and seller access
 *
 * remain separate trust decisions.
 *
 * Vendor Verification is NOT yet required to begin selling.
 */

/*
 * =======================================================
 * CANONICAL SELLER STATE
 * =======================================================
 *
 * Any part of CampusMart that needs to decide whether a
 * seller may receive NEW marketplace activity must use
 * this state shape together with evaluateSellerState().
 *
 * This prevents product visibility, checkout, messaging,
 * middleware and future seller gates from independently
 * reimplementing the selling requirements.
 */

export const sellerEligibilityStateSelect = {
  id:
    true,

  role:
    true,

  universityId:
    true,

  university: {
    select: {
      id:
        true,

      name:
        true,

      shortName:
        true,
    },
  },

  matricNumber:
    true,

  fallbackUniversityName:
    true,

  fallbackState:
    true,

  fallbackCity:
    true,

  studentVerificationStatus:
    true,

  vendorProfile: {
    select: {
      id:
        true,

      businessName:
        true,

      businessDescription:
        true,

      pickupLocation:
        true,

      accessStatus:
        true,

      vendorVerificationStatus:
        true,
    },
  },
} satisfies Prisma.UserSelect;

export type SellerState =
  Prisma.UserGetPayload<{
    select:
      typeof sellerEligibilityStateSelect;
  }>;

/*
 * =======================================================
 * RESULT TYPES
 * =======================================================
 */

export type SellerRequirementKey =
  | "vendor_account"
  | "university_details"
  | "matric_number"
  | "student_verification"
  | "seller_profile"
  | "seller_access";

export type SellerRequirement = {
  key:
    SellerRequirementKey;

  label:
    string;

  complete:
    boolean;

  required:
    boolean;
};

export type SellerNextAction =
  | "not_a_seller"
  | "complete_university_details"
  | "add_matric_number"
  | "verify_student_identity"
  | "complete_seller_profile"
  | "seller_access_pending"
  | "seller_access_restricted"
  | "seller_access_suspended"
  | "ready_to_sell";

export type SellerEligibilityResult = {
  userId:
    string;

  isVendor:
    boolean;

  canSell:
    boolean;

  nextRequiredAction:
    SellerNextAction;

  message:
    string;

  studentVerificationStatus:
    StudentVerificationStatus;

  studentVerified:
    boolean;

  university: {
    type:
      | "listed"
      | "other"
      | "missing";

    id:
      | string
      | null;

    name:
      | string
      | null;

    shortName:
      | string
      | null;

    matricNumber:
      | string
      | null;
  };

  sellerProfile: {
    exists:
      boolean;

    complete:
      boolean;

    businessName:
      | string
      | null;

    businessDescription:
      | string
      | null;

    pickupLocation:
      | string
      | null;

    accessStatus:
      | VendorAccessStatus
      | null;

    vendorVerificationStatus:
      | VendorVerificationStatus
      | null;
  };

  requirements:
    SellerRequirement[];
};

/*
 * =======================================================
 * INTERNAL HELPERS
 * =======================================================
 */

function hasText(
  value:
    | string
    | null
    | undefined
): boolean {
  return Boolean(
    value?.trim()
  );
}

async function loadSellerState(
  userId:
    string
): Promise<SellerState> {
  const user =
    await prisma.user.findUnique({
      where: {
        id:
          userId,
      },

      select:
        sellerEligibilityStateSelect,
    });

  if (!user) {
    throw new Error(
      "USER_NOT_FOUND"
    );
  }

  return user;
}

/*
 * =======================================================
 * PURE ELIGIBILITY EVALUATOR
 * =======================================================
 *
 * This function performs NO database writes and NO
 * reconciliation.
 *
 * It can therefore safely be reused by:
 *
 * - public marketplace reads
 * - product-detail reads
 * - checkout validation inside a transaction
 * - messaging
 * - seller middleware
 * - tests
 *
 * A caller that already loaded the seller state should use
 * this function rather than performing another database
 * query.
 */

export function evaluateSellerState(
  user:
    SellerState
): SellerEligibilityResult {
  const isVendor =
    user.role ===
    UserRole.vendor;

  const hasListedUniversity =
    Boolean(
      user.universityId &&
      user.university
    );

  const hasFallbackUniversity =
    Boolean(
      hasText(
        user.fallbackUniversityName
      ) &&
      hasText(
        user.fallbackState
      ) &&
      hasText(
        user.fallbackCity
      )
    );

  const hasUniversityDetails =
    hasListedUniversity ||
    hasFallbackUniversity;

  /*
   * Managed/listed universities require a matric number.
   *
   * "Other / not listed" universities may use Manual
   * review and supporting evidence instead.
   */

  const matricRequired =
    hasListedUniversity;

  const hasRequiredMatric =
    !matricRequired ||
    hasText(
      user.matricNumber
    );

  const studentVerified =
    user.studentVerificationStatus ===
    StudentVerificationStatus.verified;

  const sellerProfileExists =
    Boolean(
      user.vendorProfile
    );

  const sellerProfileComplete =
    Boolean(
      user.vendorProfile &&
      hasText(
        user.vendorProfile
          .businessName
      ) &&
      hasText(
        user.vendorProfile
          .businessDescription
      ) &&
      hasText(
        user.vendorProfile
          .pickupLocation
      )
    );

  const accessStatus =
    user.vendorProfile
      ?.accessStatus ??
    null;

  const sellerAccessActive =
    accessStatus ===
    VendorAccessStatus.active;

  const canSell =
    isVendor &&
    hasUniversityDetails &&
    hasRequiredMatric &&
    studentVerified &&
    sellerProfileComplete &&
    sellerAccessActive;

  const requirements:
    SellerRequirement[] = [
      {
        key:
          "vendor_account",

        label:
          "Seller account",

        complete:
          isVendor,

        required:
          true,
      },

      {
        key:
          "university_details",

        label:
          "University details",

        complete:
          hasUniversityDetails,

        required:
          true,
      },

      {
        key:
          "matric_number",

        label:
          "Matric / student number",

        complete:
          hasRequiredMatric,

        required:
          matricRequired,
      },

      {
        key:
          "student_verification",

        label:
          "Student identity verified",

        complete:
          studentVerified,

        required:
          true,
      },

      {
        key:
          "seller_profile",

        label:
          "Seller profile completed",

        complete:
          sellerProfileComplete,

        required:
          true,
      },

      {
        key:
          "seller_access",

        label:
          "Seller access active",

        complete:
          sellerAccessActive,

        required:
          true,
      },
    ];

  let nextRequiredAction:
    SellerNextAction;

  let message:
    string;

  if (!isVendor) {
    nextRequiredAction =
      "not_a_seller";

    message =
      "This account is not registered as a seller.";
  } else if (
    !hasUniversityDetails
  ) {
    nextRequiredAction =
      "complete_university_details";

    message =
      "Complete your university details before setting up seller access.";
  } else if (
    !hasRequiredMatric
  ) {
    nextRequiredAction =
      "add_matric_number";

    message =
      user.university
        ?.shortName
        ? `Add your ${user.university.shortName} matric number before continuing.`
        : "Add your matric number before continuing.";
  } else if (
    !studentVerified
  ) {
    nextRequiredAction =
      "verify_student_identity";

    message =
      "Verify your student identity to unlock seller access.";
  } else if (
    !sellerProfileExists ||
    !sellerProfileComplete
  ) {
    nextRequiredAction =
      "complete_seller_profile";

    message =
      "Complete your seller profile to continue.";
  } else if (
    accessStatus ===
    VendorAccessStatus.restricted
  ) {
    nextRequiredAction =
      "seller_access_restricted";

    message =
      "Your seller access is currently restricted. Contact CampusMart support for assistance.";
  } else if (
    accessStatus ===
    VendorAccessStatus.suspended
  ) {
    nextRequiredAction =
      "seller_access_suspended";

    message =
      "Your seller access is currently suspended.";
  } else if (
    accessStatus !==
    VendorAccessStatus.active
  ) {
    nextRequiredAction =
      "seller_access_pending";

    message =
      "Your seller requirements are being finalised before seller access becomes active.";
  } else {
    nextRequiredAction =
      "ready_to_sell";

    message =
      "Your seller account is ready to sell on CampusMart.";
  }

  return {
    userId:
      user.id,

    isVendor,

    canSell,

    nextRequiredAction,

    message,

    studentVerificationStatus:
      user.studentVerificationStatus,

    studentVerified,

    university: {
      type:
        hasListedUniversity
          ? "listed"
          : hasFallbackUniversity
            ? "other"
            : "missing",

      id:
        user.university
          ?.id ??
        null,

      name:
        user.university
          ?.name ??
        user.fallbackUniversityName ??
        null,

      shortName:
        user.university
          ?.shortName ??
        null,

      matricNumber:
        user.matricNumber,
    },

    sellerProfile: {
      exists:
        sellerProfileExists,

      complete:
        sellerProfileComplete,

      businessName:
        user.vendorProfile
          ?.businessName ??
        null,

      businessDescription:
        user.vendorProfile
          ?.businessDescription ??
        null,

      pickupLocation:
        user.vendorProfile
          ?.pickupLocation ??
        null,

      accessStatus,

      vendorVerificationStatus:
        user.vendorProfile
          ?.vendorVerificationStatus ??
        null,
    },

    requirements,
  };
}

/*
 * =======================================================
 * READ-ONLY ELIGIBILITY
 * =======================================================
 */

export async function getSellerEligibility(
  userId:
    string
): Promise<SellerEligibilityResult> {
  const user =
    await loadSellerState(
      userId
    );

  return evaluateSellerState(
    user
  );
}

/*
 * =======================================================
 * BATCH READ-ONLY ELIGIBILITY
 * =======================================================
 *
 * Useful when a caller has several seller IDs and wants
 * canonical eligibility without creating an N+1 query
 * pattern.
 *
 * Missing/deleted users simply do not appear in the
 * returned map, allowing marketplace callers to treat
 * them as unavailable.
 */

export async function getSellerEligibilityMap(
  userIds:
    readonly string[]
): Promise<
  Map<
    string,
    SellerEligibilityResult
  >
> {
  const uniqueUserIds =
    Array.from(
      new Set(
        userIds.filter(
          (
            userId
          ) =>
            Boolean(
              userId
            )
        )
      )
    );

  if (
    uniqueUserIds.length ===
    0
  ) {
    return new Map();
  }

  const users =
    await prisma.user.findMany({
      where: {
        id: {
          in:
            uniqueUserIds,
        },
      },

      select:
        sellerEligibilityStateSelect,
    });

  return new Map(
    users.map(
      (
        user
      ) => [
        user.id,
        evaluateSellerState(
          user
        ),
      ]
    )
  );
}

/*
 * =======================================================
 * SELLER ACCESS RECONCILIATION
 * =======================================================
 *
 * This keeps accessStatus aligned with the actual minimum
 * selling requirements.
 *
 * Automatic transitions allowed:
 *
 * pending_review -> active
 * active         -> pending_review
 *
 * Automatic transitions NOT allowed:
 *
 * restricted -> anything
 * suspended  -> anything
 *
 * Those are Admin/risk controls.
 */

export async function reconcileSellerAccess(
  userId:
    string
): Promise<SellerEligibilityResult> {
  const user =
    await loadSellerState(
      userId
    );

  const current =
    evaluateSellerState(
      user
    );

  /*
   * Nothing to reconcile if this is not a seller account
   * or if the seller has not created a VendorProfile yet.
   */

  if (
    !current.isVendor ||
    !user.vendorProfile
  ) {
    return current;
  }

  const currentAccess =
    user.vendorProfile
      .accessStatus;

  /*
   * Never automatically override risk/Admin controls.
   */

  if (
    currentAccess ===
      VendorAccessStatus.restricted ||
    currentAccess ===
      VendorAccessStatus.suspended
  ) {
    return current;
  }

  const hasListedUniversity =
    current.university.type ===
    "listed";

  const hasUniversityDetails =
    current.university.type !==
    "missing";

  const hasRequiredMatric =
    !hasListedUniversity ||
    hasText(
      current.university
        .matricNumber
    );

  const shouldBeActive =
    current.isVendor &&
    hasUniversityDetails &&
    hasRequiredMatric &&
    current.studentVerified &&
    current.sellerProfile
      .complete;

  const desiredAccessStatus =
    shouldBeActive
      ? VendorAccessStatus.active
      : VendorAccessStatus.pending_review;

  if (
    currentAccess ===
    desiredAccessStatus
  ) {
    return current;
  }

  await prisma.vendorProfile.update({
    where: {
      id:
        user.vendorProfile
          .id,
    },

    data: {
      accessStatus:
        desiredAccessStatus,
    },
  });

  /*
   * Reload after mutation so the caller always receives
   * the final persisted state.
   */

  return getSellerEligibility(
    userId
  );
}