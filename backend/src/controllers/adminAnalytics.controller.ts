import type { Response } from "express";
import { prisma } from "../lib/prisma";
import type { AuthenticatedAdminRequest } from "../middleware/adminAuth.middleware";
import {
  VerificationAppealStatus,
} from "../generated/prisma/client";

type CountByDay = { day: Date | string; count: bigint | number };
type AccountByDay = {
  day: Date | string;
  buyers: bigint | number;
  sellers: bigint | number;
};
type UniversityRow = {
  id: string;
  name: string;
  shortName: string;
  users: bigint | number;
  sellers: bigint | number;
  activeListings: bigint | number;
  buyerOrders: bigint | number;
};
type ReviewSummary = {
  approved: bigint | number;
  rejected: bigint | number;
  averageReviewHours: number | null;
};

function count(value: bigint | number | null | undefined): number {
  return Number(value ?? 0);
}

function dayKey(value: Date | string): string {
  // PostgreSQL date fields may be parsed into Date objects by the adapter.
  return typeof value === "string"
    ? value.slice(0, 10)
    : value.toISOString().slice(0, 10);
}

function utcStart(date: Date): Date {
  return new Date(Date.UTC(
    date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()
  ));
}

/**
 * GET /api/admin/analytics?days=7|30|90
 * Route requires an authenticated, active Super Admin.
 * Aggregates only; never returns buyer identifiers, phone numbers,
 * verification documents, wallet balances or transaction details.
 */
export async function getAdminAnalytics(
  req: AuthenticatedAdminRequest,
  res: Response
) {
  const allTime = req.query.days === "all";
  const requestedDays = allTime ? 0 : Number(req.query.days ?? 30);
  if (!allTime && ![7, 30, 90].includes(requestedDays)) {
    return res.status(400).json({
      success: false,
      code: "INVALID_ANALYTICS_PERIOD",
      message: "Choose 7, 30, 90 days or all time.",
    });
  }

  const until = new Date(utcStart(new Date()).getTime() + 86400000);
  // Real all-time range starts with first recorded activity, rather than a fake fixed date.
  const oldest = allTime ? await Promise.all([
    prisma.user.findFirst({orderBy:{createdAt:"asc"},select:{createdAt:true}}),
    prisma.order.findFirst({orderBy:{createdAt:"asc"},select:{createdAt:true}}),
  ]) : [];
  const oldestAt = allTime && oldest.length
    ? Math.min(...oldest.map(row=>row?.createdAt?.getTime() || Date.now()))
    : Date.now();
  const allTimeSince = utcStart(new Date(oldestAt));
  const since = allTime ? allTimeSince : new Date(until.getTime() - requestedDays * 86400000);
  const days = Math.ceil((until.getTime()-since.getTime()) / 86400000);

  try {
    const [
      totalUsers, activeListings, universities, activeUniversities,
      totalOrders, ordersPlaced, verifiedHandoffs, totalVendors,
      accountsDaily, ordersDaily, handoffsDaily,
      universityRows, categories,
      pendingCases, underReviewCases, studentActionCases,
      resolvedReviews,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.product.count({ where: { isArchived: false } }),
      prisma.university.count(),
      prisma.university.count({ where: { active: true } }),
      prisma.order.count(),
      prisma.order.count({ where: { createdAt: { gte: since, lt: until } } }),
      prisma.orderVendorFulfillment.count({
        where: { verifiedAt: { gte: since, lt: until } },
      }),
      prisma.user.count({ where: { role: "vendor" } }),
      prisma.$queryRaw<AccountByDay[]>`
        SELECT DATE_TRUNC('day', "createdAt")::date AS day,
               COUNT(*) FILTER (WHERE "role" = 'client')::int AS buyers,
               COUNT(*) FILTER (WHERE "role" = 'vendor')::int AS sellers
        FROM "User"
        WHERE "createdAt" >= ${since} AND "createdAt" < ${until}
        GROUP BY 1 ORDER BY 1
      `,
      prisma.$queryRaw<CountByDay[]>`
        SELECT DATE_TRUNC('day', "createdAt")::date AS day,
               COUNT(*)::int AS count
        FROM "Order"
        WHERE "createdAt" >= ${since} AND "createdAt" < ${until}
        GROUP BY 1 ORDER BY 1
      `,
      prisma.$queryRaw<CountByDay[]>`
        SELECT DATE_TRUNC('day', "verifiedAt")::date AS day,
               COUNT(*)::int AS count
        FROM "OrderVendorFulfillment"
        WHERE "verifiedAt" >= ${since} AND "verifiedAt" < ${until}
        GROUP BY 1 ORDER BY 1
      `,
      prisma.$queryRaw<UniversityRow[]>`
        SELECT u.id, u.name, u."shortName",
          (SELECT COUNT(*)::int FROM "User" x WHERE x."universityId" = u.id) AS users,
          (SELECT COUNT(*)::int FROM "User" x WHERE x."universityId" = u.id AND x.role = 'vendor') AS sellers,
          (SELECT COUNT(*)::int FROM "Product" p JOIN "User" v ON p."vendorId" = v.id
            WHERE v."universityId" = u.id AND p."isArchived" = false) AS "activeListings",
          (SELECT COUNT(*)::int FROM "Order" o JOIN "User" b ON o."buyerId" = b.id
            WHERE b."universityId" = u.id AND o."createdAt" >= ${since} AND o."createdAt" < ${until}) AS "buyerOrders"
        FROM "University" u
        ORDER BY users DESC, u.name ASC
      `,
      prisma.product.groupBy({
        by: ["category"], where: { isArchived: false },
        _count: { _all: true }, orderBy: { _count: { category: "desc" } }, take: 8,
      }),
      prisma.verificationAppeal.count({ where: { status: VerificationAppealStatus.pending } }),
      prisma.verificationAppeal.count({ where: { status: VerificationAppealStatus.under_review } }),
      prisma.verificationAppeal.count({ where: { status: VerificationAppealStatus.more_information_required } }),
      prisma.$queryRaw<ReviewSummary[]>`
        SELECT
          COUNT(*) FILTER (WHERE status = 'approved')::int AS approved,
          COUNT(*) FILTER (WHERE status = 'rejected')::int AS rejected,
          AVG(EXTRACT(EPOCH FROM ("reviewedAt" - "submittedAt")) / 3600.0)::float8 AS "averageReviewHours"
        FROM "VerificationAppeal"
        WHERE "reviewedAt" >= ${since} AND "reviewedAt" < ${until}
          AND status IN ('approved', 'rejected')
      `,
    ]);

    const accountsMap = new Map(accountsDaily.map(row => [dayKey(row.day), row]));
    const ordersMap = new Map(ordersDaily.map(row => [dayKey(row.day), row]));
    const handoffsMap = new Map(handoffsDaily.map(row => [dayKey(row.day), row]));

    const daily = Array.from({ length: days }, (_, index) => {
      const date = new Date(since.getTime() + index * 86400000)
        .toISOString().slice(0, 10);
      const accounts = accountsMap.get(date);
      return {
        date,
        newBuyerAccounts: count(accounts?.buyers),
        newSellerAccounts: count(accounts?.sellers),
        ordersPlaced: count(ordersMap.get(date)?.count),
        verifiedHandoffs: count(handoffsMap.get(date)?.count),
      };
    });

    const reviewed = resolvedReviews[0];
    const approved = count(reviewed?.approved);
    const rejected = count(reviewed?.rejected);
    const newAccounts = daily.reduce(
      (total, day) => total + day.newBuyerAccounts + day.newSellerAccounts, 0
    );

    return res.status(200).json({
      success: true,
      period: {
        days: allTime ? 0 : days,
        from: since.toISOString().slice(0, 10),
        through: new Date(until.getTime() - 86400000).toISOString().slice(0, 10),
        timezone: "UTC",
      },
      summary: {
        totalUsers,
        totalVendors,
        newAccounts,
        activeListings,
        universities,
        activeUniversities,
        totalOrders,
        ordersPlaced,
        verifiedHandoffs,
        openVerificationCases: pendingCases + underReviewCases + studentActionCases,
        verificationApprovalRate: approved + rejected
          ? Math.round((approved / (approved + rejected)) * 1000) / 10
          : null,
        averageReviewHours: reviewed?.averageReviewHours == null
          ? null : Math.round(Number(reviewed.averageReviewHours) * 10) / 10,
      },
      daily,
      verification: {
        pending: pendingCases,
        underReview: underReviewCases,
        studentAction: studentActionCases,
        approvedInPeriod: approved,
        rejectedInPeriod: rejected,
      },
      universities: universityRows.map(row => ({
        id: row.id, name: row.name, shortName: row.shortName,
        users: count(row.users), sellers: count(row.sellers),
        activeListings: count(row.activeListings), buyerOrders: count(row.buyerOrders),
      })),
      categories: categories.map(category => ({
        name: category.category, activeListings: category._count._all,
      })),
      caveat:
        "Operational counts include seeded and test records where present. " +
        "Orders placed are not payments received. Verified handoffs count seller portions, " +
        "not necessarily entire multi-seller orders. No financial revenue is inferred.",
    });
  } catch (error) {
    console.error("Admin analytics error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to load marketplace analytics.",
    });
  }
}
