import "dotenv/config";
import jwt from "jsonwebtoken";
import app from "../src/app";
import { AdminRole, OrderStatus, PaymentStatus, UserRole } from "../src/generated/prisma/client";
import { prisma } from "../src/lib/prisma";

const secret = process.env.ADMIN_JWT_SECRET;
if (!secret) throw new Error("ADMIN_JWT_SECRET is not configured.");

const tag = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const adminIds: string[] = [];
const userIds: string[] = [];
let universityId: string | null = null;
let orderId: string | null = null;
let passed = 0, failed = 0;

function check(value: unknown, label: string) {
  value ? passed++ : failed++;
  console.log(`${value ? "PASS" : "FAIL"} ${passed + failed}: ${label}`);
}
function token(id: string, role: AdminRole) {
  return jwt.sign({ adminId: id, role, tokenType: "admin" }, secret!, {
    algorithm: "HS256", issuer: "campusmart-admin",
    audience: "campusmart-admin", expiresIn: "15m",
  });
}

async function main() {
  const superAdmin = await prisma.admin.create({ data: {
    name: "Analytics Super Admin", email: `analytics-super-${tag}@example.com`,
    passwordHash: "test-only", role: AdminRole.super_admin,
  } });
  adminIds.push(superAdmin.id);
  const reviewer = await prisma.admin.create({ data: {
    name: "Analytics Reviewer", email: `analytics-reviewer-${tag}@example.com`,
    passwordHash: "test-only", role: AdminRole.verification_officer,
  } });
  adminIds.push(reviewer.id);

  const server = await new Promise<ReturnType<typeof app.listen>>((resolve, reject) => {
    const instance = app.listen(0, "127.0.0.1", () => resolve(instance));
    instance.once("error", reject);
  });

  try {
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("No HTTP port");
    const base = `http://127.0.0.1:${address.port}`;
    const adminToken = token(superAdmin.id, superAdmin.role);
    const reviewerToken = token(reviewer.id, reviewer.role);

    async function get(path: string, access?: string) {
      const result = await fetch(base + path, {
        headers: access ? { Authorization: `Bearer ${access}` } : {},
      });
      return { status: result.status, body: await result.json() as any };
    }

    check((await get("/api/admin/analytics")).status === 401, "Anonymous analytics blocked");
    check((await get("/api/admin/analytics", reviewerToken)).status === 403, "Non-Super-Admin analytics blocked");
    check((await get("/api/admin/analytics?days=365", adminToken)).status === 400, "Unapproved date window rejected");
    check((await get("/api/admin/analytics?days=0", adminToken)).status === 400, "Zero-day window rejected");

    const initial = await get("/api/admin/analytics?days=7", adminToken);
    check(initial.status === 200 && initial.body.success, "Super Admin receives analytics");
    check(initial.body?.daily?.length === 7, "Seven-day series has exactly seven points");
    check(initial.body?.period?.timezone === "UTC", "Response declares UTC time zone");
    check(
      !JSON.stringify(initial.body).includes("passwordHash") &&
      !JSON.stringify(initial.body).includes("phone") &&
      !JSON.stringify(initial.body).includes("codeCiphertext"),
      "Analytics response excludes private user and fulfilment information"
    );

    const university = await prisma.university.create({ data: {
      name: `Analytics University ${tag}`, shortName: "ANA",
      slug: `analytics-${tag}`, state: "Rivers", city: "Port Harcourt", active: true,
    } });
    universityId = university.id;

    const buyer = await prisma.user.create({ data: {
      name: "Analytics Buyer", email: `analytics-buyer-${tag}@example.com`,
      passwordHash: "test", role: UserRole.client, universityId: university.id,
    } });
    userIds.push(buyer.id);
    const seller = await prisma.user.create({ data: {
      name: "Analytics Seller", email: `analytics-seller-${tag}@example.com`,
      passwordHash: "test", role: UserRole.vendor, universityId: university.id,
    } });
    userIds.push(seller.id);

    const order = await prisma.order.create({ data: {
      buyerId: buyer.id, status: OrderStatus.pending, paymentStatus: PaymentStatus.pending,
      subtotal: 2500, fee: 100, total: 2600,
      items: { create: {
        vendorId: seller.id, productTitle: "Analytics temporary item",
        unitPrice: 2500, quantity: 1, lineTotal: 2500,
      } },
    } });
    orderId = order.id;

    const after = await get("/api/admin/analytics?days=7", adminToken);
    check(after.status === 200 && after.body.summary.newAccounts >= initial.body.summary.newAccounts + 2,
      "New account count includes test buyer and seller");
    check(after.body.summary.ordersPlaced >= initial.body.summary.ordersPlaced + 1,
      "Order placement included even when payment pending (not revenue)");
    check(after.body.universities.some((u: any) => u.id === university.id && u.users === 2 && u.buyerOrders === 1),
      "University comparison uses buyer university without duplicates");
    check(after.body.daily.length === 7 && after.body.daily.every((d: any) => /^\d{4}-\d{2}-\d{2}$/.test(d.date)),
      "Daily series is dense and formatted correctly");
    check(typeof after.body.caveat === "string" && after.body.caveat.includes("test"),
      "Results explicitly warn about test records");

    const ninety = await get("/api/admin/analytics?days=90", adminToken);
    check(ninety.status === 200 && ninety.body.daily.length === 90,
      "Ninety-day analytics supported");

    console.log(`\nAdmin analytics tests: ${passed} passed / ${failed} failed`);
    if (failed) process.exitCode = 1;
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}

main().catch(error => {
  console.error("Admin analytics test crashed:", error);
  process.exitCode = 1;
}).finally(async () => {
  try {
    if (orderId) await prisma.order.deleteMany({ where: { id: orderId } });
    if (userIds.length) await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    if (universityId) await prisma.university.deleteMany({ where: { id: universityId } });
    if (adminIds.length) await prisma.admin.deleteMany({ where: { id: { in: adminIds } } });
  } catch (error) {
    console.error("Analytics test cleanup failed:", error);
    process.exitCode = 1;
  }
  await prisma.$disconnect();
});
