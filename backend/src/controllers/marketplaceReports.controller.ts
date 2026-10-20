import type { Response } from "express";
import { MarketplaceReportCategory, MarketplaceTargetType, MarketplaceCaseStatus } from "../generated/prisma/client";
import { Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import type { AuthenticatedRequest } from "../middleware/auth.middleware";
import { casePriority, maximumSeverity, severityForCategory } from "../services/marketplacePriority.service";

const categoryValues = Object.values(MarketplaceReportCategory);
const targetValues = Object.values(MarketplaceTargetType);

export async function submitMarketplaceReport(req: AuthenticatedRequest, res: Response) {
  if (!req.user) return res.status(401).json({ success: false, message: "Sign in to report a problem." });
  const reporterId = req.user.id;
  const targetType = String(req.body?.targetType || "") as MarketplaceTargetType;
  const targetId = String(req.body?.targetId || "").trim();
  const category = String(req.body?.category || "") as MarketplaceReportCategory;
  // Ignore any user-supplied severity. Server policy assigns the priority.
  const severity = severityForCategory(category);
  const details = String(req.body?.details || "").trim();
  if (!targetValues.includes(targetType) || !targetId || targetId.length > 100 ||
      !categoryValues.includes(category) ||
      details.length < 20 || details.length > 2000) {
    return res.status(400).json({ success: false, message: "Provide a valid target, issue category and description (20–2000 characters)." });
  }
  try {
    // Prevent unbounded submissions; server-enforced, not only a frontend limit.
    const dayAgo = new Date(Date.now() - 86400000);
    const dailyCount = await prisma.marketplaceReport.count({ where: { reporterId, createdAt: { gte: dayAgo } } });
    if (dailyCount >= 5) return res.status(429).json({ success: false, message: "Daily report limit reached. Contact support for urgent safety issues." });

    let universityId: string | null = null;
    if (targetType === MarketplaceTargetType.user) {
      if (targetId === reporterId) return res.status(400).json({ success: false, message: "You cannot report your own account." });
      const user = await prisma.user.findUnique({ where: { id: targetId }, select: { universityId: true } });
      if (!user) return res.status(404).json({ success: false, message: "User not found." });
      universityId = user.universityId;
    } else if (targetType === MarketplaceTargetType.product) {
      const productId = Number(targetId);
      if (!Number.isSafeInteger(productId) || productId <= 0) return res.status(400).json({ success: false, message: "Invalid listing ID." });
      const product = await prisma.product.findUnique({ where: { id: productId }, select: { vendorId: true, vendor: { select: { universityId: true } } } });
      if (!product) return res.status(404).json({ success: false, message: "Listing not found." });
      universityId = product.vendor.universityId;
      if (product.vendorId === reporterId) return res.status(400).json({ success: false, message: "You cannot report your own listing." });
    } else {
      const order = await prisma.order.findUnique({ where: { id: targetId }, select: { buyerId: true, buyer: { select: { universityId: true } }, items: { select: { vendorId: true } } } });
      if (!order) return res.status(404).json({ success: false, message: "Order not found." });
      universityId = order.buyer.universityId;
      if (order.buyerId !== reporterId && !order.items.some(item => item.vendorId === reporterId)) {
        return res.status(403).json({ success: false, message: "Only order participants can report this order." });
      }
    }

    // Serializable retry prevents lost priority/count updates under concurrent reports.
    let result: { id: string } | undefined;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        result = await prisma.$transaction(async tx => {
      const caseRecord = await tx.marketplaceCase.upsert({
        where: { targetType_targetId: { targetType, targetId } },
        create: { targetType, targetId, universityId, highestSeverity: severity, reportCount: 0,
          priorityScore: casePriority(severity, 1) },
        update: {},
      });
      // Unique (caseId, reporterId) prevents repeat-report brigading.
      const report = await tx.marketplaceReport.create({ data: { caseId: caseRecord.id, reporterId, category, severity, details } });
      const total = caseRecord.reportCount + 1;
      const highestSeverity = maximumSeverity(caseRecord.highestSeverity, severity);
      await tx.marketplaceCase.update({ where: { id: caseRecord.id }, data: {
        reportCount: { increment: 1 }, highestSeverity,
        priorityScore: casePriority(highestSeverity, total), lastReportedAt: new Date(),
        ...(caseRecord.status === MarketplaceCaseStatus.closed || caseRecord.status === MarketplaceCaseStatus.dismissed
          ? { status: MarketplaceCaseStatus.open, resolutionNote: null } : {}),
      } });
      return report;
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
        break;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034" && attempt < 2) continue;
        throw error;
      }
    }
    if (!result) throw new Error("Report transaction did not complete.");
    return res.status(201).json({ success: true, reportId: result.id, message: "Report submitted for Admin review." });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return res.status(409).json({ success: false, message: "You've already reported this account, listing or order. Admins can see your report." });
    }
    console.error("Submit marketplace report error:", error);
    return res.status(500).json({ success: false, message: "Unable to submit the report. Please try again." });
  }
}


/** Resolve a linked report target without asking buyers to type internal IDs.
 * Never returns phone, student evidence or private order information.
 */
export async function getMarketplaceReportTarget(req: AuthenticatedRequest, res: Response) {
  if (!req.user) return res.status(401).json({ success: false, message: "Sign in to report a concern." });
  const targetType = String(req.query.targetType || "");
  const targetId = String(req.query.targetId || "").trim();
  if (!targetValues.includes(targetType as MarketplaceTargetType) || !targetId || targetId.length > 100) {
    return res.status(400).json({ success: false, message: "Open the Report link from a listing, seller profile or order." });
  }
  try {
    let targetLabel: string | null = null;
    let secondaryLabel: string | null = null;
    if (targetType === "user") {
      const user = await prisma.user.findUnique({ where: { id: targetId }, select: {
        id: true, name: true, vendorProfile: { select: { businessName: true } },
      } });
      if (!user || user.id === req.user.id) return res.status(404).json({ success: false, message: "This account cannot be reported here." });
      targetLabel = user.vendorProfile?.businessName || user.name;
      secondaryLabel = user.vendorProfile?.businessName ? `Operated by ${user.name}` : "CampusMart account";
    } else if (targetType === "product") {
      const numericId = Number(targetId);
      if (!Number.isSafeInteger(numericId) || numericId <= 0) return res.status(400).json({ success: false, message: "Invalid listing." });
      const product = await prisma.product.findUnique({ where: { id: numericId }, select: {
        title: true, vendorId: true, vendor: { select: { name: true, vendorProfile: { select: { businessName: true } } } },
      } });
      if (!product || product.vendorId === req.user.id) return res.status(404).json({ success: false, message: "This listing cannot be reported here." });
      targetLabel = product.title;
      secondaryLabel = `Seller: ${product.vendor.vendorProfile?.businessName || product.vendor.name}`;
    } else {
      const order = await prisma.order.findUnique({ where: { id: targetId }, select: {
        id: true, buyerId: true, items: { select: { vendorId: true } },
      } });
      if (!order) return res.status(404).json({ success: false, message: "Order not found." });
      if (order.buyerId !== req.user.id && !order.items.some(item => item.vendorId === req.user!.id)) {
        return res.status(403).json({ success: false, message: "Only people involved in this order may report it." });
      }
      targetLabel = `Order #${order.id.slice(0, 8).toUpperCase()}`;
      secondaryLabel = "CampusMart order";
    }
    return res.json({ success: true, targetType, targetId, targetLabel, secondaryLabel });
  } catch (error) {
    console.error("Report context resolution error:", error);
    return res.status(500).json({ success: false, message: "Unable to load report context." });
  }
}
