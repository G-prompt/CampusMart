
import "dotenv/config";

import { randomUUID } from "node:crypto";
import { testUserToken } from "./helpers/testUserToken";
import app from "../src/app";

import {
  OrderStatus,
  PaymentStatus,
  PickupPointType,
  StudentVerificationStatus,
  UserRole,
  VendorAccessStatus,
  WalletEntryKind,
  WalletHoldStatus,
} from "../src/generated/prisma/client";

import { prisma } from "../src/lib/prisma";

const secret = process.env.JWT_SECRET;
if (!secret) {
  throw new Error("JWT_SECRET is not configured.");
}

if (process.env.NODE_ENV === "production") {
  throw new Error("Financial tests cannot run in production mode.");
}

const tag = randomUUID().slice(0, 8);
const STARTING_BALANCE = 20000;
const PRICE_A = 2000;
const PRICE_B = 3000;
const FEE = 100;
const TOTAL = PRICE_A + PRICE_B + FEE;

let passed = 0;
let failed = 0;

const created = {
  universityId: "",
  buyerId: "",
  users: [] as string[],
  products: [] as number[],
};

function check(condition: unknown, label: string) {
  const number = ++passed + failed;

  if (condition) {
    console.log(`PASS ${number}: ${label}`);
  } else {
    passed--;
    failed++;
    console.error(`FAIL ${number}: ${label}`);
  }
}

type HttpMethod = "GET" | "POST" | "PATCH";

async function api(
  base: string,
  path: string,
  authToken: string,
  method: HttpMethod = "GET",
  body?: unknown
) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${authToken}`,
      ...(body === undefined
        ? {}
        : { "Content-Type": "application/json" }),
    },
    body:
      body === undefined
        ? undefined
        : JSON.stringify(body),
  });

  const raw = await response.text();
  let data: any = null;

  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = raw;
  }

  return { status: response.status, data };
}

async function balance(userId: string) {
  const wallet = await prisma.wallet.findUnique({
    where: { userId },
    select: { balance: true },
  });

  return wallet?.balance ?? null;
}

async function ledgerCount(
  orderId: string,
  kind: WalletEntryKind,
  vendorId?: string
) {
  return prisma.walletEntry.count({
    where: {
      orderId,
      kind,
      ...(vendorId ? { vendorId } : {}),
    },
  });
}

async function hold(orderId: string, vendorId: string) {
  return prisma.walletHold.findUnique({
    where: {
      orderId_vendorId: { orderId, vendorId },
    },
  });
}

async function cleanup() {
  const userIds = created.users;

  if (created.buyerId) {
    const orders = await prisma.order.findMany({
      where: { buyerId: created.buyerId },
      select: { id: true },
    });

    const orderIds = orders.map((order) => order.id);

    if (orderIds.length) {
      await prisma.walletHold.deleteMany({
        where: { orderId: { in: orderIds } },
      });

      await prisma.notification.deleteMany({
        where: { orderId: { in: orderIds } },
      });
    }

    await prisma.walletEntry.deleteMany({
      where: {
        OR: [
          { orderId: { in: orderIds } },
          { userId: { in: userIds } },
        ],
      },
    });

    await prisma.order.deleteMany({
      where: { buyerId: created.buyerId },
    });
  }

  if (created.products.length) {
    await prisma.product.deleteMany({
      where: {
        id: { in: created.products },
      },
    });
  }

  if (userIds.length) {
    await prisma.notification.deleteMany({
      where: { userId: { in: userIds } },
    });

    await prisma.walletEntry.deleteMany({
      where: { userId: { in: userIds } },
    });

    await prisma.wallet.deleteMany({
      where: { userId: { in: userIds } },
    });

    await prisma.conversation.deleteMany({
      where: {
        OR: [
          { buyerId: { in: userIds } },
          { vendorId: { in: userIds } },
        ],
      },
    });

    await prisma.user.deleteMany({
      where: { id: { in: userIds } },
    });
  }

  if (created.universityId) {
    await prisma.university.delete({
      where: { id: created.universityId },
    });
  }
}

async function main() {
  let server: ReturnType<typeof app.listen> | null = null;

  console.log(
    "\nCampusMart Wallet & Order Financial Integrity\n"
  );

  try {
    const university = await prisma.university.create({
      data: {
        name: `Finance Test University ${tag}`,
        shortName: "FQA",
        slug: `finance-qa-${tag}`,
        country: "Nigeria",
        state: "Rivers",
        city: "Port Harcourt",
        active: true,
      },
    });

    created.universityId = university.id;

    const buyer = await prisma.user.create({
      data: {
        name: "Finance Test Buyer",
        email: `finance-buyer-${tag}@example.com`,
        passwordHash: "not-a-login-hash",
        phone: "08123456789",
        role: UserRole.client,
        universityId: university.id,
      },
    });

    created.buyerId = buyer.id;
    created.users.push(buyer.id);

    async function createSeller(letter: string) {
      const seller = await prisma.user.create({
        data: {
          name: `Finance Seller ${letter}`,
          email: `finance-seller-${letter}-${tag}@example.com`,
          passwordHash: "not-a-login-hash",
          phone: "08123456789",
          role: UserRole.vendor,
          universityId: university.id,
          matricNumber: `FQA-${letter}-${tag}`,
          studentVerificationStatus:
            StudentVerificationStatus.verified,
          studentVerifiedAt: new Date(),
          vendorProfile: {
            create: {
              businessName: `Finance Shop ${letter}`,
              businessDescription: "Temporary test shop",
              pickupLocation: "Main University Gate",
              accessStatus: VendorAccessStatus.active,
            },
          },
        },
      });

      created.users.push(seller.id);

      const point = await prisma.vendorPickupPoint.create({
        data: {
          vendorId: seller.id,
          type: PickupPointType.campus,
          label: `Campus Gate ${letter}`,
          detail: "Test entrance",
          isActive: true,
        },
      });

      return { seller, point };
    }

    const A = await createSeller("A");
    const B = await createSeller("B");

    async function createProduct(
      vendorId: string,
      letter: string,
      price: number
    ) {
      const product = await prisma.product.create({
        data: {
          slug: `finance-product-${letter}-${tag}`,
          title: `Finance Test Product ${letter}`,
          category: "Technology",
          description: "Temporary finance test listing",
          price,
          rating: 0,
          images: [],
          sizes: [],
          colors: [],
          vendorId,
        },
      });

      created.products.push(product.id);
      return product;
    }

    const productA = await createProduct(
      A.seller.id, "a", PRICE_A
    );
    const productB = await createProduct(
      B.seller.id, "b", PRICE_B
    );

    await prisma.wallet.create({
      data: {
        userId: buyer.id,
        balance: 0,
      },
    });

    server = await new Promise<
      ReturnType<typeof app.listen>
    >((resolve, reject) => {
      const instance = app.listen(
        0, "127.0.0.1", () => resolve(instance)
      );
      instance.once("error", reject);
    });

    const address = server.address();

    if (!address || typeof address === "string") {
      throw new Error("Unable to start test server.");
    }

    const base = `http://127.0.0.1:${address.port}`;

    const buyerToken = testUserToken(buyer);
    const tokenA = testUserToken(A.seller);
    const tokenB = testUserToken(B.seller);

    function checkoutPayload(checkoutKey: string) {
      return {
        checkoutKey,
        pickupMode: "seller_points",
        items: [
          { productId: productA.id, quantity: 1 },
          { productId: productB.id, quantity: 1 },
        ],
        pickupSelections: [
          {
            vendorId: A.seller.id,
            pickupPointId: A.point.id,
          },
          {
            vendorId: B.seller.id,
            pickupPointId: B.point.id,
          },
        ],
      };
    }

    async function changeStatus(
      orderId: string,
      sellerToken: string,
      status: string
    ) {
      return api(
        base,
        `/api/orders/vendor/${orderId}/status`,
        sellerToken,
        "PATCH",
        { status }
      );
    }

    // 1. INSUFFICIENT FUNDS

    const insufficientKey = randomUUID();

    const insufficient = await api(
      base, "/api/orders", buyerToken, "POST",
      checkoutPayload(insufficientKey)
    );

    check(
      insufficient.status === 402 &&
        insufficient.data?.code === "INSUFFICIENT_FUNDS",
      "Checkout rejects insufficient wallet funds"
    );

    const unpaidOrder = await prisma.order.findUnique({
      where: { checkoutKey: insufficientKey },
    });

    const originalEntries = await prisma.walletEntry.count({
      where: { userId: buyer.id },
    });

    check(
      unpaidOrder === null &&
        originalEntries === 0 &&
        (await balance(buyer.id)) === 0,
      "Failed checkout rolls back order and financial writes"
    );

    // Development-only fixture funding. Not a public top-up API.

    await prisma.wallet.update({
      where: { userId: buyer.id },
      data: { balance: STARTING_BALANCE },
    });

    await prisma.walletEntry.create({
      data: {
        userId: buyer.id,
        reference: `finance-fixture:${tag}`,
        kind: WalletEntryKind.development_funding,
        amount: STARTING_BALANCE,
      },
    });

    // 2. PAID MULTI-SELLER CHECKOUT

    const firstKey = randomUUID();

    const first = await api(
      base, "/api/orders", buyerToken, "POST",
      checkoutPayload(firstKey)
    );

    const firstId: string = first.data?.order?.id ?? "";

    check(
      first.status === 201 &&
        first.data?.order?.paymentStatus ===
          PaymentStatus.paid &&
        first.data?.order?.status ===
          OrderStatus.pending &&
        first.data?.order?.total === TOTAL,
      "Paid checkout creates a pending seller-confirmation order"
    );

    if (!firstId) {
      throw new Error(
        "First paid checkout failed; cannot continue financial tests."
      );
    }

    const firstDebit = await prisma.walletEntry.findMany({
      where: {
        orderId: firstId,
        kind: WalletEntryKind.checkout_debit,
      },
    });

    check(
      (await balance(buyer.id)) ===
        STARTING_BALANCE - TOTAL &&
        firstDebit.length === 1 &&
        firstDebit[0].amount === -TOTAL,
      "Wallet is debited once for items plus single fee"
    );

    const firstHoldA = await hold(firstId, A.seller.id);
    const firstHoldB = await hold(firstId, B.seller.id);

    check(
      firstHoldA?.amount === PRICE_A &&
        firstHoldB?.amount === PRICE_B &&
        firstHoldA.status === WalletHoldStatus.held &&
        firstHoldB.status === WalletHoldStatus.held,
      "Each seller receives an independent held balance"
    );

    // 3. IDEMPOTENT CHECKOUT RETRY

    const replay = await api(
      base, "/api/orders", buyerToken, "POST",
      checkoutPayload(firstKey)
    );

    check(
      replay.status === 200 &&
        replay.data?.order?.id === firstId,
      "Checkout retry returns the original order"
    );

    check(
      (await balance(buyer.id)) ===
        STARTING_BALANCE - TOTAL &&
        (await ledgerCount(
          firstId, WalletEntryKind.checkout_debit
        )) === 1 &&
        (await prisma.walletHold.count({
          where: { orderId: firstId },
        })) === 2,
      "Checkout retry cannot debit twice or duplicate holds"
    );

    // 4. PARTIAL SELLER CANCELLATION

    const cancelA = await changeStatus(
      firstId, tokenA, "cancelled"
    );

    const expectedAfterRefundA =
      STARTING_BALANCE - TOTAL + PRICE_A;

    check(
      cancelA.status === 200 &&
        (await balance(buyer.id)) === expectedAfterRefundA &&
        (await hold(firstId, A.seller.id))?.status ===
          WalletHoldStatus.refunded,
      "Seller A cancellation refunds only Seller A portion"
    );

    const storedFirstAfterPartial =
      await prisma.order.findUnique({
        where: { id: firstId },
        select: { paymentStatus: true },
      });

    check(
      storedFirstAfterPartial?.paymentStatus ===
        PaymentStatus.paid &&
        (await hold(firstId, B.seller.id))?.status ===
          WalletHoldStatus.held &&
        (await ledgerCount(
          firstId, WalletEntryKind.service_fee_refund
        )) === 0,
      "Partial cancellation preserves Seller B hold and order fee"
    );

    await changeStatus(firstId, tokenA, "cancelled");

    check(
      (await balance(buyer.id)) === expectedAfterRefundA &&
        (await ledgerCount(
          firstId,
          WalletEntryKind.seller_refund,
          A.seller.id
        )) === 1,
      "Repeated cancellation cannot refund Seller A twice"
    );

    // 5. CONFIRMATION AND SECURE HANDOFF

    const confirmB = await changeStatus(
      firstId, tokenB, "confirmed"
    );

    check(
      confirmB.status === 200 &&
        confirmB.data?.order?.vendorStatus ===
          OrderStatus.confirmed,
      "Remaining seller confirms independently"
    );

    const codes = await api(
      base,
      `/api/orders/${firstId}/fulfillment-codes`,
      buyerToken
    );

    const portions = Array.isArray(codes.data?.portions)
      ? codes.data.portions
      : [];

    const portionA = portions.find(
      (portion: any) => portion.vendorId === A.seller.id
    );

    const portionB = portions.find(
      (portion: any) => portion.vendorId === B.seller.id
    );

    const codeB =
      typeof portionB?.code === "string"
        ? portionB.code
        : "";

    check(
      codes.status === 200 &&
        /^\d{4}$/.test(codeB) &&
        portionB?.codeAvailable === true &&
        portionA?.codeAvailable === false,
      "Only confirmed seller receives an active buyer handoff code"
    );

    if (!/^\d{4}$/.test(codeB)) {
      throw new Error(
        "Seller B code was unavailable; cannot test settlement."
      );
    }

    const handoff = await api(
      base,
      `/api/orders/vendor/${firstId}/fulfillment`,
      tokenB,
      "POST",
      { code: codeB }
    );

    const expectedSellerNet =
      PRICE_B - Math.round(PRICE_B * 0.01);

    check(
      handoff.status === 200 &&
        handoff.data?.vendorStatus === OrderStatus.completed,
      "Verified buyer code completes Seller B handoff"
    );

    check(
      (await hold(firstId, B.seller.id))?.status ===
        WalletHoldStatus.settled &&
        (await balance(B.seller.id)) === expectedSellerNet &&
        (await ledgerCount(
          firstId,
          WalletEntryKind.seller_settlement,
          B.seller.id
        )) === 1,
      "Seller B receives the correct one-time net settlement"
    );

    check(
      (await balance(buyer.id)) === expectedAfterRefundA &&
        (await hold(firstId, A.seller.id))?.status ===
          WalletHoldStatus.refunded &&
        (await balance(A.seller.id)) === null,
      "Seller settlement leaves buyer refund and cancelled seller untouched"
    );

    await api(
      base,
      `/api/orders/vendor/${firstId}/fulfillment`,
      tokenB,
      "POST",
      { code: codeB }
    );

    check(
      (await balance(B.seller.id)) === expectedSellerNet &&
        (await ledgerCount(
          firstId,
          WalletEntryKind.seller_settlement,
          B.seller.id
        )) === 1,
      "Repeated handoff cannot settle the seller twice"
    );

    const cancelCompleted = await changeStatus(
      firstId, tokenB, "cancelled"
    );

    check(
      cancelCompleted.status >= 400 &&
        (await hold(firstId, B.seller.id))?.status ===
          WalletHoldStatus.settled &&
        (await balance(buyer.id)) === expectedAfterRefundA,
      "Completed seller cannot cancel and reclaim settled funds"
    );

    // 6. FULL CANCELLATION AND FEE REFUND

    const second = await api(
      base,
      "/api/orders",
      buyerToken,
      "POST",
      checkoutPayload(randomUUID())
    );

    const secondId: string = second.data?.order?.id ?? "";

    check(
      second.status === 201 &&
        second.data?.order?.paymentStatus ===
          PaymentStatus.paid,
      "Second checkout is paid independently"
    );

    if (!secondId) {
      throw new Error(
        "Second checkout failed; cannot test full refund."
      );
    }

    const beforeSecond = expectedAfterRefundA;
    const afterSecondCheckout = beforeSecond - TOTAL;

    check(
      (await balance(buyer.id)) === afterSecondCheckout,
      "Second checkout deducts exactly one order total"
    );

    const secondCancelA = await changeStatus(
      secondId, tokenA, "cancelled"
    );

    check(
      secondCancelA.status === 200 &&
        (await balance(buyer.id)) ===
          afterSecondCheckout + PRICE_A,
      "First seller refund does not release the full order fee"
    );

    const secondCancelB = await changeStatus(
      secondId, tokenB, "cancelled"
    );

    const fullyCancelled = await prisma.order.findUnique({
      where: { id: secondId },
      select: {
        status: true,
        paymentStatus: true,
      },
    });

    check(
      secondCancelB.status === 200 &&
        fullyCancelled?.status === OrderStatus.cancelled &&
        fullyCancelled.paymentStatus === PaymentStatus.refunded,
      "All seller cancellations mark the paid order refunded"
    );

    check(
      (await balance(buyer.id)) === beforeSecond &&
        (await hold(secondId, A.seller.id))?.status ===
          WalletHoldStatus.refunded &&
        (await hold(secondId, B.seller.id))?.status ===
          WalletHoldStatus.refunded,
      "Full cancellation restores entire order amount including fee"
    );

    check(
      (await ledgerCount(
        secondId, WalletEntryKind.seller_refund
      )) === 2 &&
        (await ledgerCount(
          secondId, WalletEntryKind.service_fee_refund
        )) === 1,
      "Full refund creates two seller refunds and one fee refund"
    );

    await changeStatus(secondId, tokenB, "cancelled");

    check(
      (await balance(buyer.id)) === beforeSecond &&
        (await ledgerCount(
          secondId, WalletEntryKind.service_fee_refund
        )) === 1 &&
        (await ledgerCount(
          secondId, WalletEntryKind.seller_refund
        )) === 2,
      "Repeated final cancellation cannot duplicate refunds"
    );

    check(
      (await balance(B.seller.id)) === expectedSellerNet &&
        (await ledgerCount(
          secondId, WalletEntryKind.seller_settlement
        )) === 0,
      "Cancelled order never triggers seller settlement"
    );
  } finally {
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server!.close((error) =>
          error ? reject(error) : resolve()
        );
      });
    }

    await cleanup();
  }

  console.log(
    `\nFinancial integrity tests: ${passed} passed / ${failed} failed\n`
  );

  if (failed) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error("Financial integrity test crashed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
