import "dotenv/config";

import {
  OrderStatus,
} from "../src/generated/prisma/client";

import {
  prisma,
} from "../src/lib/prisma";

import {
  createFulfillmentCodeMaterial,
} from "../src/services/fulfillmentCode.service";

/*
 * =======================================================
 * LEGACY ORDER FULFILMENT BACKFILL
 * =======================================================
 *
 * Purpose:
 *
 * Find seller portions that were already CONFIRMED before
 * CampusMart introduced OrderVendorFulfillment records.
 *
 * Pending legacy orders do not need backfilling because a
 * fulfilment challenge is automatically created when the
 * seller confirms them.
 *
 * Completed/cancelled seller portions do not need a new
 * active fulfilment code either.
 *
 * -------------------------------------------------------
 * SAFETY
 * -------------------------------------------------------
 *
 * Default:
 *
 *   npx tsx scripts/backfill-order-fulfillments.ts
 *
 * performs a DRY RUN only.
 *
 * To actually create missing records:
 *
 *   npx tsx scripts/backfill-order-fulfillments.ts --apply
 *
 * Raw fulfilment codes are NEVER printed.
 */

type SellerPortion = {
  orderId: string;
  vendorId: string;
};

function pairKey(
  orderId: string,
  vendorId: string
) {
  return `${orderId}:${vendorId}`;
}

function shortId(
  value: string
) {
  if (
    value.length <=
    12
  ) {
    return value;
  }

  return `${value.slice(
    0,
    6
  )}...${value.slice(
    -6
  )}`;
}

async function main() {
  const apply =
    process.argv.includes(
      "--apply"
    );

  console.log("");
  console.log(
    "=============================================="
  );

  console.log(
    "CampusMart legacy fulfilment backfill"
  );

  console.log(
    `Mode: ${
      apply
        ? "APPLY"
        : "DRY RUN"
    }`
  );

  console.log(
    "=============================================="
  );

  /*
   * =====================================================
   * FIND CONFIRMED LEGACY SELLER PORTIONS
   * =====================================================
   *
   * If at least one item for an order/vendor pair remains
   * confirmed, that seller portion still needs a buyer
   * fulfilment challenge.
   */

  const confirmedItems =
    await prisma.orderItem.findMany({
      where: {
        status:
          OrderStatus.confirmed,
      },

      select: {
        orderId:
          true,

        vendorId:
          true,
      },
    });

  const portionMap =
    new Map<
      string,
      SellerPortion
    >();

  for (
    const item of
    confirmedItems
  ) {
    portionMap.set(
      pairKey(
        item.orderId,
        item.vendorId
      ),
      {
        orderId:
          item.orderId,

        vendorId:
          item.vendorId,
      }
    );
  }

  const candidatePortions =
    Array.from(
      portionMap.values()
    );

  console.log("");
  console.log(
    `Confirmed seller portions found: ${candidatePortions.length}`
  );

  /*
   * =====================================================
   * DETERMINE WHICH PORTIONS ARE ACTUALLY MISSING
   * =====================================================
   */

  const missingPortions:
    SellerPortion[] =
    [];

  let alreadyPresent =
    0;

  for (
    const portion of
    candidatePortions
  ) {
    const existing =
      await prisma.orderVendorFulfillment.findUnique({
        where: {
          orderId_vendorId: {
            orderId:
              portion.orderId,

            vendorId:
              portion.vendorId,
          },
        },

        select: {
          id:
            true,

          verifiedAt:
            true,
        },
      });

    if (
      existing
    ) {
      alreadyPresent +=
        1;

      continue;
    }

    missingPortions.push(
      portion
    );
  }

  console.log(
    `Already protected: ${alreadyPresent}`
  );

  console.log(
    `Missing fulfilment records: ${missingPortions.length}`
  );

  /*
   * =====================================================
   * DRY RUN
   * =====================================================
   */

  if (
    !apply
  ) {
    if (
      missingPortions.length ===
      0
    ) {
      console.log("");
      console.log(
        "No legacy confirmed seller portions require backfilling."
      );
    } else {
      console.log("");
      console.log(
        "The following seller portions would receive new fulfilment challenges:"
      );

      for (
        const portion of
        missingPortions
      ) {
        console.log(
          `- order ${shortId(
            portion.orderId
          )} / seller ${shortId(
            portion.vendorId
          )}`
        );
      }
    }

    console.log("");
    console.log(
      "No database changes were made."
    );

    console.log("");
    console.log(
      "Run again with --apply to create the missing records."
    );

    return;
  }

  /*
   * =====================================================
   * APPLY
   * =====================================================
   */

  if (
    missingPortions.length ===
    0
  ) {
    console.log("");
    console.log(
      "Nothing to backfill."
    );

    return;
  }

  let created =
    0;

  let skipped =
    0;

  const failures:
    {
      orderId: string;
      vendorId: string;
      error: string;
    }[] =
    [];

  for (
    const portion of
    missingPortions
  ) {
    try {
      /*
       * Re-check inside the transaction.
       *
       * This makes the script safe if another process
       * creates the record between the dry-run scan and
       * this write.
       */

      const result =
        await prisma.$transaction(
          async (
            tx
          ) => {
            const existing =
              await tx.orderVendorFulfillment.findUnique({
                where: {
                  orderId_vendorId: {
                    orderId:
                      portion.orderId,

                    vendorId:
                      portion.vendorId,
                  },
                },

                select: {
                  id:
                    true,
                },
              });

            if (
              existing
            ) {
              return "skipped" as const;
            }

            /*
             * Re-check that this seller still has at
             * least one confirmed item.
             *
             * If the order changed while this script was
             * running, we do not create a stale challenge.
             */

            const confirmedItemCount =
              await tx.orderItem.count({
                where: {
                  orderId:
                    portion.orderId,

                  vendorId:
                    portion.vendorId,

                  status:
                    OrderStatus.confirmed,
                },
              });

            if (
              confirmedItemCount ===
              0
            ) {
              return "skipped" as const;
            }

            const material =
              createFulfillmentCodeMaterial();

            await tx.orderVendorFulfillment.create({
              data: {
                orderId:
                  portion.orderId,

                vendorId:
                  portion.vendorId,

                codeHash:
                  material.codeHash,

                codeCiphertext:
                  material.codeCiphertext,

                codeCreatedAt:
                  new Date(),
              },
            });

            return "created" as const;
          }
        );

      if (
        result ===
        "created"
      ) {
        created +=
          1;

        console.log(
          `CREATED: order ${shortId(
            portion.orderId
          )} / seller ${shortId(
            portion.vendorId
          )}`
        );
      } else {
        skipped +=
          1;

        console.log(
          `SKIPPED: order ${shortId(
            portion.orderId
          )} / seller ${shortId(
            portion.vendorId
          )}`
        );
      }
    } catch (
      error
    ) {
      const message =
        error instanceof
          Error
          ? error.message
          : "Unknown error";

      failures.push({
        orderId:
          portion.orderId,

        vendorId:
          portion.vendorId,

        error:
          message,
      });

      console.error(
        `FAILED: order ${shortId(
          portion.orderId
        )} / seller ${shortId(
          portion.vendorId
        )}`
      );
    }
  }

  /*
   * =====================================================
   * VERIFY BACKFILL
   * =====================================================
   */

  let remainingMissing =
    0;

  const remainingConfirmedItems =
    await prisma.orderItem.findMany({
      where: {
        status:
          OrderStatus.confirmed,
      },

      select: {
        orderId:
          true,

        vendorId:
          true,
      },
    });

  const remainingPairs =
    new Map<
      string,
      SellerPortion
    >();

  for (
    const item of
    remainingConfirmedItems
  ) {
    remainingPairs.set(
      pairKey(
        item.orderId,
        item.vendorId
      ),
      {
        orderId:
          item.orderId,

        vendorId:
          item.vendorId,
      }
    );
  }

  for (
    const portion of
    remainingPairs.values()
  ) {
    const fulfillment =
      await prisma.orderVendorFulfillment.findUnique({
        where: {
          orderId_vendorId: {
            orderId:
              portion.orderId,

            vendorId:
              portion.vendorId,
          },
        },

        select: {
          id:
            true,
        },
      });

    if (
      !fulfillment
    ) {
      remainingMissing +=
        1;
    }
  }

  console.log("");
  console.log(
    "=============================================="
  );

  console.log(
    `Created: ${created}`
  );

  console.log(
    `Skipped: ${skipped}`
  );

  console.log(
    `Failed: ${failures.length}`
  );

  console.log(
    `Confirmed portions still missing fulfilment records: ${remainingMissing}`
  );

  console.log(
    "=============================================="
  );

  if (
    failures.length >
      0 ||
    remainingMissing >
      0
  ) {
    process.exitCode =
      1;
  }
}

main()
  .catch(
    (
      error
    ) => {
      console.error(
        "Legacy fulfilment backfill crashed:",
        error
      );

      process.exitCode =
        1;
    }
  )
  .finally(
    async () => {
      await prisma.$disconnect();
    }
  );