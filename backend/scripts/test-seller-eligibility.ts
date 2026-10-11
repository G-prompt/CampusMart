import {
  StudentVerificationStatus,
  UserRole,
  VendorAccessStatus,
} from "../src/generated/prisma/client";

import {
  prisma,
} from "../src/lib/prisma";

import {
  reconcileSellerAccess,
} from "../src/services/sellerEligibility.service";

/*
 * =======================================================
 * CAMPUSMART SELLER ELIGIBILITY TEST
 * =======================================================
 *
 * Proves:
 *
 * 1. active + unverified
 *      -> pending_review
 *
 * 2. pending_review + verified + complete profile
 *      -> active
 *      -> canSell = true
 *
 * 3. restricted
 *      -> remains restricted
 *
 * 4. suspended
 *      -> remains suspended
 *
 * All temporary users are deleted afterwards.
 */

const TEST_EMAILS = [
  "seller-unverified-active@campusmart.local",
  "seller-verified-pending@campusmart.local",
  "seller-restricted@campusmart.local",
  "seller-suspended@campusmart.local",
];

let passed =
  0;

let failed =
  0;

function assert(
  condition:
    boolean,

  message:
    string
) {
  if (condition) {
    passed +=
      1;

    console.log(
      `PASS  ${message}`
    );

    return;
  }

  failed +=
    1;

  console.error(
    `FAIL  ${message}`
  );
}

async function cleanup() {
  await prisma.user.deleteMany({
    where: {
      email: {
        in:
          TEST_EMAILS,
      },
    },
  });
}

async function createSeller({
  email,
  studentVerificationStatus,
  accessStatus,
}: {
  email:
    string;

  studentVerificationStatus:
    StudentVerificationStatus;

  accessStatus:
    VendorAccessStatus;
}) {
  return prisma.user.create({
    data: {
      name:
        "Seller Eligibility Test",

      email,

      /*
       * These accounts never log in.
       * We only need a stored password hash field value.
       */
      passwordHash:
        "test-only-not-a-login-hash",

      role:
        UserRole.vendor,

      /*
       * Use the supported "Other / not listed" university
       * path so this test does not depend on a real or test
       * managed university record.
       */
      fallbackUniversityName:
        "CampusMart Test University",

      fallbackState:
        "Test State",

      fallbackCity:
        "Test City",

      studentVerificationStatus,

      vendorProfile: {
        create: {
          businessName:
            "CampusMart Test Shop",

          businessDescription:
            "Temporary seller eligibility test shop.",

          pickupLocation:
            "Test Campus",

          accessStatus,
        },
      },
    },

    select: {
      id:
        true,

      email:
        true,
    },
  });
}

async function main() {
  console.log("");
  console.log(
    "CampusMart seller eligibility tests"
  );

  console.log(
    "----------------------------------"
  );

  /*
   * Remove leftovers from an interrupted older run.
   */
  await cleanup();

  /*
   * =====================================================
   * TEST 1
   *
   * Legacy / unsafe state:
   *
   * Student NOT verified
   * Seller profile complete
   * accessStatus = active
   *
   * Must be corrected to pending_review.
   * =====================================================
   */

  const unverifiedActive =
    await createSeller({
      email:
        TEST_EMAILS[0],

      studentVerificationStatus:
        StudentVerificationStatus.not_started,

      accessStatus:
        VendorAccessStatus.active,
    });

  const unverifiedResult =
    await reconcileSellerAccess(
      unverifiedActive.id
    );

  assert(
    unverifiedResult
      .sellerProfile
      .accessStatus ===
      VendorAccessStatus.pending_review,

    "Unverified active seller is corrected to pending_review"
  );

  assert(
    unverifiedResult.canSell ===
      false,

    "Unverified seller cannot sell"
  );

  assert(
    unverifiedResult.nextRequiredAction ===
      "verify_student_identity",

    "Unverified seller is directed to student verification"
  );

  /*
   * =====================================================
   * TEST 2
   *
   * Student verified
   * Seller profile complete
   * accessStatus = pending_review
   *
   * Must safely promote to active.
   * =====================================================
   */

  const verifiedPending =
    await createSeller({
      email:
        TEST_EMAILS[1],

      studentVerificationStatus:
        StudentVerificationStatus.verified,

      accessStatus:
        VendorAccessStatus.pending_review,
    });

  const verifiedResult =
    await reconcileSellerAccess(
      verifiedPending.id
    );

  assert(
    verifiedResult
      .sellerProfile
      .accessStatus ===
      VendorAccessStatus.active,

    "Verified eligible seller is promoted to active"
  );

  assert(
    verifiedResult.canSell ===
      true,

    "Verified seller with complete profile can sell"
  );

  assert(
    verifiedResult.nextRequiredAction ===
      "ready_to_sell",

    "Eligible seller receives ready_to_sell"
  );

  /*
   * =====================================================
   * TEST 3
   *
   * Restricted is an Admin/risk state.
   *
   * Reconciliation must NEVER override it.
   * =====================================================
   */

  const restricted =
    await createSeller({
      email:
        TEST_EMAILS[2],

      studentVerificationStatus:
        StudentVerificationStatus.verified,

      accessStatus:
        VendorAccessStatus.restricted,
    });

  const restrictedResult =
    await reconcileSellerAccess(
      restricted.id
    );

  assert(
    restrictedResult
      .sellerProfile
      .accessStatus ===
      VendorAccessStatus.restricted,

    "Restricted seller remains restricted"
  );

  assert(
    restrictedResult.canSell ===
      false,

    "Restricted seller cannot sell"
  );

  assert(
    restrictedResult.nextRequiredAction ===
      "seller_access_restricted",

    "Restricted seller receives restricted next action"
  );

  /*
   * =====================================================
   * TEST 4
   *
   * Suspended is also an Admin/risk state.
   *
   * Reconciliation must NEVER override it.
   * =====================================================
   */

  const suspended =
    await createSeller({
      email:
        TEST_EMAILS[3],

      studentVerificationStatus:
        StudentVerificationStatus.verified,

      accessStatus:
        VendorAccessStatus.suspended,
    });

  const suspendedResult =
    await reconcileSellerAccess(
      suspended.id
    );

  assert(
    suspendedResult
      .sellerProfile
      .accessStatus ===
      VendorAccessStatus.suspended,

    "Suspended seller remains suspended"
  );

  assert(
    suspendedResult.canSell ===
      false,

    "Suspended seller cannot sell"
  );

  assert(
    suspendedResult.nextRequiredAction ===
      "seller_access_suspended",

    "Suspended seller receives suspended next action"
  );

  console.log("");
  console.log(
    "Seller eligibility test summary"
  );

  console.log(
    "-------------------------------"
  );

  console.log(
    `Passed: ${passed}`
  );

  console.log(
    `Failed: ${failed}`
  );

  if (
    failed > 0
  ) {
    process.exitCode =
      1;
  } else {
    console.log("");
    console.log(
      "All seller eligibility tests passed."
    );
  }
}

main()
  .catch(
    (
      error
    ) => {
      console.error("");
      console.error(
        "Seller eligibility test failed unexpectedly:"
      );

      console.error(
        error
      );

      process.exitCode =
        1;
    }
  )
  .finally(
    async () => {
      try {
        await cleanup();

        console.log("");
        console.log(
          "Temporary seller accounts removed."
        );
      } catch (
        cleanupError
      ) {
        console.error(
          "Temporary seller cleanup failed:",
          cleanupError
        );

        process.exitCode =
          1;
      }

      await prisma.$disconnect();
    }
  );