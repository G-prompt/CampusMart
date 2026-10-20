
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { testUserToken } from "./helpers/testUserToken";
import app from "../src/app";

import {
  PaymentStatus,
  PickupPointType,
  StudentVerificationStatus,
  UserRole,
  VendorAccessStatus,
} from "../src/generated/prisma/client";
import { prisma } from "../src/lib/prisma";

const secret = process.env.JWT_SECRET;
if (!secret) throw new Error("JWT_SECRET is not set.");

const suffix = `${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
const users: string[] = [];
const products: number[] = [];
const orders: string[] = [];
const universities: string[] = [];
let passed = 0;
let failed = 0;

function check(value: unknown, label: string) {
  if (value) {
    passed++;
    console.log(`PASS ${passed + failed}: ${label}`);
  } else {
    failed++;
    console.error(`FAIL ${passed + failed}: ${label}`);
  }
}

async function cleanup() {
  if (orders.length) {
    await prisma.walletHold.deleteMany({ where: { orderId: { in: orders } } });
    await prisma.walletEntry.deleteMany({ where: { orderId: { in: orders } } });
    await prisma.order.deleteMany({ where: { id: { in: orders } } });
  }
  if (products.length) await prisma.product.deleteMany({ where: { id: { in: products } } });
  if (users.length) {
    await prisma.walletEntry.deleteMany({ where: { userId: { in: users } } });
    await prisma.wallet.deleteMany({ where: { userId: { in: users } } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
  }
  if (universities.length) await prisma.university.deleteMany({ where: { id: { in: universities } } });
}

async function main() {
  let server: ReturnType<typeof app.listen> | null = null;
  try {
    async function university(name: string) {
      const row = await prisma.university.create({
        data: { name: `Checkout QA ${name} ${suffix}`, shortName: "CQA", slug: `checkout-qa-${name}-${suffix}`, country: "Nigeria", state: "Rivers", city: "Port Harcourt", active: true },
      });
      universities.push(row.id);
      return row;
    }

    const schoolA = await university("a");
    const schoolB = await university("b");

    const buyer = await prisma.user.create({
      data: { name: "Checkout QA Buyer", email: `campus-buyer-${suffix}@example.com`, passwordHash: "test-hash", phone: "08123456789", universityId: schoolA.id, role: UserRole.client },
    });
    users.push(buyer.id);

    async function seller(name: string, schoolId: string) {
      const row = await prisma.user.create({
        data: {
          name, email: `${name.toLowerCase().replace(/\s/g, "-")}-${suffix}@example.com`, passwordHash: "test-hash", role: UserRole.vendor, universityId: schoolId, phone: "08123456789",
          matricNumber: `QA-${suffix}-${name.slice(-1)}`,
          studentVerificationStatus: StudentVerificationStatus.verified,
          studentVerifiedAt: new Date(),
          vendorProfile: { create: { businessName: `${name} Store`, businessDescription: "Test store", pickupLocation: "Test library entrance", accessStatus: VendorAccessStatus.active } },
        },
      });
      users.push(row.id);
      return row;
    }

    const vendorA = await seller("Vendor A", schoolA.id);
    const vendorB = await seller("Vendor B", schoolA.id);
    const vendorC = await seller("Vendor C", schoolB.id);

    async function product(vendorId: string, label: string) {
      const row = await prisma.product.create({
        data: { slug: `pickup-qa-${label}-${suffix}`, title: `Pickup QA ${label}`, vendorId, category: "Electronics", description: "Temporary test item", price: 2000, rating: 0, sizes: [], colors: [], images: [] },
      });
      products.push(row.id);
      return row;
    }
    const productA = await product(vendorA.id, "a");
    const productB = await product(vendorB.id, "b");
    const productC = await product(vendorC.id, "c");

    // Development-only seed for an isolated test buyer. No payment provider is used.
    await prisma.wallet.create({ data: { userId: buyer.id, balance: 10000 } });
    await prisma.walletEntry.create({ data: { userId: buyer.id, reference: `test-credit:${suffix}`, kind: "development_funding", amount: 10000 } });

    server = await new Promise<ReturnType<typeof app.listen>>((resolve, reject) => {
      const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
      instance.once("error", reject);
    });
    const address = server.address();
    if (!address || typeof address === "string") throw Error("No local test server port");
    const base = `http://127.0.0.1:${address.port}`;
    const buyerToken = testUserToken(buyer);

    async function request(url: string, body?: unknown) {
      const response = await fetch(base + url, {
        method: body ? "POST" : "GET",
        headers: { Authorization: `Bearer ${buyerToken}`, ...(body ? { "Content-Type": "application/json" } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
      const result = await response.json();
      return { status: response.status, data: result as any };
    }

    const sellerPoints = await request(`/api/vendor/storefront/${vendorA.id}/pickup-points`);
    check(sellerPoints.status === 200 && sellerPoints.data.universityId === schoolA.id, "Public pickup metadata identifies seller university");

    const goodKey = randomUUID();
    const goodPayload = {
      items: [{ productId: productA.id, quantity: 1 }, { productId: productB.id, quantity: 1 }],
      pickupMode: "shared_campus",
      campusMeetupLocation: "Computer Science Department, main entrance",
      checkoutKey: goodKey,
    };

    const placed = await request("/api/orders", goodPayload);
    if (placed.data?.order?.id) orders.push(placed.data.order.id);
    check(placed.status === 201 && placed.data?.order?.paymentStatus === PaymentStatus.paid, "Shared campus checkout pays wallet and creates order");

    const chosen = placed.data?.order?.vendorPickupSelections ?? [];
    check(chosen.length === 2 && chosen.every((p: any) => p.type === PickupPointType.campus && p.label === "On campus" && p.detail === goodPayload.campusMeetupLocation && p.pickupPointId === null), "Each seller gets its own frozen campus meetup snapshot");

    const afterPaid = await prisma.wallet.findUnique({ where: { userId: buyer.id } });
    check(afterPaid?.balance === 5900 && placed.data?.order?.total === 4100, "Total including single ₦100 fee is deducted exactly once");

    const holds = orders.length ? await prisma.walletHold.findMany({ where: { orderId: orders[0] } }) : [];
    check(holds.length === 2 && holds.every((h) => h.amount === 2000 && h.status === "held"), "Each seller's proceeds remain held independently");

    const replay = await request("/api/orders", goodPayload);
    const afterReplay = await prisma.wallet.findUnique({ where: { userId: buyer.id } });
    check(replay.status === 200 && replay.data?.order?.id === placed.data?.order?.id && afterReplay?.balance === 5900, "Retry with same checkout key does not charge buyer twice");

    const bad = await request("/api/orders", {
      items: [{ productId: productA.id, quantity: 1 }, { productId: productC.id, quantity: 1 }],
      pickupMode: "shared_campus", campusMeetupLocation: "Central campus gate", checkoutKey: randomUUID(),
    });
    const afterBad = await prisma.wallet.findUnique({ where: { userId: buyer.id } });
    check(bad.status === 400 && afterBad?.balance === 5900, "Cross-university shared meetup rejected without wallet deduction");

    const empty = await request("/api/orders", {
      items: [{ productId: productA.id, quantity: 1 }], pickupMode: "shared_campus", campusMeetupLocation: "Hi", checkoutKey: randomUUID(),
    });
    check(empty.status === 400 && empty.data?.code === "INVALID_CAMPUS_MEETUP", "Unclear meetup location is rejected");

    const conflict = await request("/api/orders", {
      items: [{ productId: productA.id, quantity: 1 }], pickupMode: "shared_campus", campusMeetupLocation: "Campus library entrance",
      pickupSelections: [{ vendorId: vendorA.id, pickupPointId: "fake" }], checkoutKey: randomUUID(),
    });
    check(conflict.status === 400 && conflict.data?.code === "PICKUP_MODE_CONFLICT", "Cannot combine shared and seller-specific pickup modes");

    const legacy = await request("/api/orders", {
      items: [{ productId: productA.id, quantity: 1 }], pickupLocation: "Arbitrary off-campus meeting", checkoutKey: randomUUID(),
    });
    check(legacy.status === 400 && legacy.data?.code === "LEGACY_PICKUP_UNSUPPORTED", "Legacy global pickup cannot bypass seller pickup validation");

    const point = await prisma.vendorPickupPoint.create({
      data: { vendorId: vendorA.id, type: PickupPointType.faculty_building, label: "Engineering Hall", detail: "West entrance", isActive: true },
    });
    const selected = await request("/api/orders", {
      items: [{ productId: productA.id, quantity: 1 }], pickupMode: "seller_points",
      pickupSelections: [{ vendorId: vendorA.id, pickupPointId: point.id }], checkoutKey: randomUUID(),
    });
    if (selected.data?.order?.id) orders.push(selected.data.order.id);
    check(selected.status === 201 && selected.data?.order?.paymentStatus === PaymentStatus.paid,
      "Seller pickup-point checkout remains supported");
    check(selected.data?.order?.vendorPickupSelections?.[0]?.pickupPointId === point.id &&
      selected.data?.order?.vendorPickupSelections?.[0]?.label === "Engineering Hall",
      "Seller-specific pickup is saved as an order snapshot");
    const finalBalance = await prisma.wallet.findUnique({ where: { userId: buyer.id } });
    check(finalBalance?.balance === 3800, "Only successful checkouts debit wallet");

    console.log(`\nShared campus checkout tests: ${passed} passed / ${failed} failed\n`);
    if (failed) process.exitCode = 1;
  } finally {
    if (server) await new Promise<void>((resolve, reject) => server!.close((error) => error ? reject(error) : resolve()));
    await cleanup();
  }
}

main()
  .catch((error) => { console.error("Shared campus checkout test failed:", error); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
