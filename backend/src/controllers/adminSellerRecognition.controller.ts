import type { Response } from "express";
import { AdminRole, Prisma, SellerBadgeKind, PaymentStatus, UserRole, VendorAccessStatus } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import type { AuthenticatedAdminRequest } from "../middleware/adminAuth.middleware";

const KINDS = Object.values(SellerBadgeKind);
type Metrics = {
  vendorId: string; name: string; universityId: string | null; universityName: string | null;
  businessName: string; sales30: number; buyers30: number; sales90: number; buyers90: number;
  ratingCount: number; averageRating: number | null;
};
const RULES: Record<SellerBadgeKind, { sales: number; buyers: number; days: number; reviews: number; rating: number }> = {
  rising_star: { sales: 10, buyers: 5, days: 30, reviews: 0, rating: 0 },
  campus_favourite: { sales: 30, buyers: 15, days: 90, reviews: 5, rating: 4 },
  top_seller: { sales: 75, buyers: 30, days: 90, reviews: 10, rating: 4 },
};
const pageSize = 20;
const pageNumber = (raw: unknown) => Math.min(100000, Math.max(1, Math.floor(Number(raw) || 1)));

function qualifies(kind: SellerBadgeKind, m: Metrics): boolean {
  const rule = RULES[kind];
  const sales = rule.days === 30 ? m.sales30 : m.sales90;
  const buyers = rule.days === 30 ? m.buyers30 : m.buyers90;
  return sales >= rule.sales && buyers >= rule.buyers && m.ratingCount >= rule.reviews &&
    (rule.rating === 0 || (m.averageRating !== null && m.averageRating >= rule.rating));
}

async function performanceRows(options: { universityId?: string; q?: string; vendorId?: string; vendorIds?: string[]; kind?: SellerBadgeKind; page?: number; take?: number }): Promise<{ rows: Metrics[]; total: number }> {
  if (options.vendorIds && options.vendorIds.length === 0) return { rows: [], total: 0 };
  const take = Math.min(100, Math.max(1, options.take ?? pageSize));
  const offset = ((options.page ?? 1) - 1) * take;
  const rule = options.kind ? RULES[options.kind] : null;
  const minSales = rule?.sales ?? 0;
  const minBuyers = rule?.buyers ?? 0;
  const minReviews = rule?.reviews ?? 0;
  const minRating = rule?.rating ?? 0;
  const since30 = new Date(Date.now() - 30 * 86400000);
  const since90 = new Date(Date.now() - 90 * 86400000);
  // One grouped query, not an N+1 query per seller. No order submissions or unpaid orders are counted.
  const rows = await prisma.$queryRaw<Array<{
    vendorId: string; name: string; universityId: string | null; universityName: string | null;
    businessName: string; sales30: number; buyers30: number; sales90: number; buyers90: number;
    ratingCount: number; averageRating: number | null; totalMatches: number;
  }>>(Prisma.sql`
    WITH sales AS (
      SELECT f."vendorId",
        COUNT(*) FILTER (WHERE f."verifiedAt" >= ${since30})::integer AS "sales30",
        COUNT(DISTINCT o."buyerId") FILTER (WHERE f."verifiedAt" >= ${since30})::integer AS "buyers30",
        COUNT(*)::integer AS "sales90",
        COUNT(DISTINCT o."buyerId")::integer AS "buyers90"
      FROM "OrderVendorFulfillment" f
      JOIN "Order" o ON o.id = f."orderId"
      WHERE f."verifiedAt" >= ${since90} AND o."paymentStatus" = 'paid'
      GROUP BY f."vendorId"
    ), ratings AS (
      SELECT p."vendorId", COUNT(r.id)::integer AS "ratingCount", AVG(r.rating)::double precision AS "averageRating"
      FROM "ProductReview" r JOIN "Product" p ON p.id = r."productId"
      GROUP BY p."vendorId"
    )
    SELECT u.id AS "vendorId", u.name, u."universityId", uni.name AS "universityName",
      vp."businessName", s."sales30", s."buyers30", s."sales90", s."buyers90",
      COALESCE(r."ratingCount",0)::integer AS "ratingCount", r."averageRating",
      COUNT(*) OVER ()::integer AS "totalMatches"
    FROM sales s JOIN "User" u ON u.id = s."vendorId"
    JOIN "VendorProfile" vp ON vp."userId" = u.id
    LEFT JOIN "University" uni ON uni.id = u."universityId"
    LEFT JOIN ratings r ON r."vendorId" = u.id
    WHERE u.role = 'vendor' AND u."studentVerificationStatus" = 'verified'
      AND vp."accessStatus" = 'active' AND u."accountSuspendedAt" IS NULL
      ${options.universityId ? Prisma.sql`AND u."universityId" = ${options.universityId}` : Prisma.empty}
      ${options.q ? Prisma.sql`AND (u.name ILIKE ${`%${options.q}%`} OR vp."businessName" ILIKE ${`%${options.q}%`})` : Prisma.empty}
      ${options.vendorId ? Prisma.sql`AND u.id = ${options.vendorId}` : Prisma.empty}
      ${options.vendorIds ? Prisma.sql`AND u.id IN (${Prisma.join(options.vendorIds)})` : Prisma.empty}
      ${rule ? Prisma.sql`AND ${rule.days === 30 ? Prisma.sql`s."sales30"` : Prisma.sql`s."sales90"`} >= ${minSales}
        AND ${rule.days === 30 ? Prisma.sql`s."buyers30"` : Prisma.sql`s."buyers90"`} >= ${minBuyers}
        AND COALESCE(r."ratingCount",0) >= ${minReviews}
        AND (${minRating} = 0 OR r."averageRating" >= ${minRating})` : Prisma.empty}
    ORDER BY s."sales90" DESC, s."buyers90" DESC, u.id ASC
    LIMIT ${take} OFFSET ${offset}
  `);
  return { total: Number(rows[0]?.totalMatches ?? 0), rows: rows.map(r => ({ ...r,
    sales30: Number(r.sales30), buyers30: Number(r.buyers30),
    sales90: Number(r.sales90), buyers90: Number(r.buyers90), ratingCount: Number(r.ratingCount),
    averageRating: r.averageRating === null ? null : Number(r.averageRating) })) };
}

export async function listSellerRecognition(req: AuthenticatedAdminRequest, res: Response) {
  if (!req.admin) return res.status(401).json({ success: false });
  const kind = String(req.query.kind || "rising_star") as SellerBadgeKind;
  const mode = String(req.query.mode || "candidates");
  const universityId = String(req.query.universityId || "").trim();
  const q = String(req.query.q || "").trim().slice(0, 80);
  const page = pageNumber(req.query.page);
  if (mode !== "awarded" && !KINDS.includes(kind)) return res.status(400).json({ success: false, message: "Unknown badge category." });
  try {
    const universities = await prisma.university.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
    if (mode === "awarded") {
      const where: Prisma.SellerBadgeAwardWhereInput = { active: true,
        vendor: {
          ...(universityId ? { universityId } : {}),
          ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { vendorProfile: { is: { businessName: { contains: q, mode: "insensitive" } } } }] } : {}),
        },
      };
      const [awards, total] = await Promise.all([
        prisma.sellerBadgeAward.findMany({ where, orderBy: [{ grantedAt: "desc" }, { id: "desc" }],
          skip: (page - 1) * pageSize, take: pageSize,
          select: { id: true, kind: true, grantedAt: true, reason: true,
            vendor: { select: { id: true, name: true, universityId: true,
              university: { select: { name: true } }, vendorProfile: { select: { businessName: true } } } } } }),
        prisma.sellerBadgeAward.count({ where }),
      ]);
      const { rows: metrics } = await performanceRows({ vendorIds: awards.map(a => a.vendor.id), take: 100 });
      const lookup = new Map(metrics.map(m => [m.vendorId, m]));
      return res.json({ success: true, mode, sellers: awards.map(a => ({ ...a.vendor, ...lookup.get(a.vendor.id),
        businessName: a.vendor.vendorProfile?.businessName || a.vendor.name, universityName: a.vendor.university?.name || null,
        badge: a.kind, grantedAt: a.grantedAt, reason: a.reason,
        eligibleNow: lookup.has(a.vendor.id) && qualifies(a.kind, lookup.get(a.vendor.id)!) })),
        total, page, pageSize, universities, rules: RULES });
    }
    const { rows: slice, total } = await performanceRows({ universityId, q, kind, page });
    const badges = await prisma.sellerBadgeAward.findMany({ where: { vendorId: { in: slice.map(s => s.vendorId) }, kind, active: true }, select: { vendorId: true } });
    const existing = new Set(badges.map(b => b.vendorId));
    return res.json({ success: true, mode, kind, sellers: slice.map(m => ({ ...m, id: m.vendorId,
      eligibleNow: true, alreadyAwarded: existing.has(m.vendorId), checkedAt: new Date().toISOString() })),
      total, page, pageSize, universities, rules: RULES,
      note: "Performance includes development and test records until live payment reconciliation is operational. No badges are automatically granted." });
  } catch (error) {
    console.error("Seller recognition list error:", error);
    return res.status(500).json({ success: false, message: "Unable to load recognition candidates." });
  }
}

export async function setSellerBadge(req: AuthenticatedAdminRequest, res: Response) {
  const admin = req.admin;
  if (!admin || admin.role !== AdminRole.super_admin) return res.status(403).json({ success: false, message: "Super Admin required." });
  const vendorId = String(req.params.vendorId || "").trim();
  const kind = String(req.params.kind || "") as SellerBadgeKind;
  const reason = String(req.body?.reason || "").trim();
  const active = req.body?.active;
  if (!KINDS.includes(kind) || typeof active !== "boolean" || reason.length < 15 || reason.length > 2000 || req.body?.confirm !== "CONFIRM") {
    return res.status(400).json({ success: false, message: "Valid action, explicit confirmation and reason (15–2000 characters) required." });
  }
  try {
    if (active) {
      const metrics = (await performanceRows({ vendorId, take: 1 })).rows[0];
      if (!metrics || !qualifies(kind, metrics)) return res.status(409).json({ success: false,
        message: "Seller does not meet the current minimum performance and eligibility criteria." });
    }
    const result = await prisma.$transaction(async tx => {
      const vendor = await tx.user.findUnique({ where: { id: vendorId }, select: { role: true, universityId: true } });
      if (!vendor || vendor.role !== UserRole.vendor || !vendor.universityId) return { error: "Seller not found." };
      const before = await tx.sellerBadgeAward.findUnique({ where: { vendorId_kind: { vendorId, kind } } });
      if (Boolean(before?.active) === active) return { error: `Badge already ${active ? "granted" : "revoked"}.` };
      const after = await tx.sellerBadgeAward.upsert({ where: { vendorId_kind: { vendorId, kind } },
        create: { vendorId, kind, active: true, reason, grantedByAdminId: admin.id },
        update: active ? { active: true, reason, grantedAt: new Date(), grantedByAdminId: admin.id, revokedAt: null, revokedReason: null }
          : { active: false, revokedAt: new Date(), revokedReason: reason },
      });
      await tx.adminAuditLog.create({ data: { actorAdminId: admin.id, action: active ? "seller_badge_granted" : "seller_badge_revoked",
        targetType: "vendor", targetId: vendorId, reason,
        beforeState: JSON.stringify({ badge: kind, active: Boolean(before?.active) }),
        afterState: JSON.stringify({ badge: kind, active: after.active }) } });
      return { badge: after };
    });
    if ("error" in result) return res.status(409).json({ success: false, message: result.error });
    return res.json({ success: true, badge: result.badge });
  } catch (error) {
    console.error("Seller badge update error:", error);
    return res.status(500).json({ success: false, message: "Unable to update badge." });
  }
}
