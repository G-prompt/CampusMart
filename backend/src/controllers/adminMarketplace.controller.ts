
import type { Response } from "express";
import {
  AdminRole,
  MarketplaceCaseStatus,
  MarketplaceTargetType,
  Prisma,
  UserRole,
  VendorAccessStatus,
} from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import type { AuthenticatedAdminRequest } from "../middleware/adminAuth.middleware";
import { priorityLabel } from "../services/marketplacePriority.service";

const statuses = Object.values(MarketplaceCaseStatus);
const targets = Object.values(MarketplaceTargetType);

const CAN_MODERATE = new Set<AdminRole>([
  AdminRole.super_admin,
  AdminRole.marketplace_moderator,
  AdminRole.customer_support,
  AdminRole.disputes,
]);

const canModerate = (role: AdminRole) => CAN_MODERATE.has(role);
const pageSize = 25;

const numberPage = (value: unknown) =>
  Math.max(1, Math.min(100000, Math.floor(Number(value) || 1)));

/**
 * Restore the access a seller had before an ACCOUNT suspension.
 *
 * Never promote an unverified seller to active. If verification was
 * revoked during the suspension, return the seller to pending review.
 *
 * A newer restriction applied while the account was suspended
 * must not be overwritten by restoration.
 */
function statusAfterAccountRestoration(user: {
  studentVerificationStatus: string;
  moderationSellerAccessBeforeSuspension: VendorAccessStatus | null;
  vendorProfile: {
    accessStatus: VendorAccessStatus;
    verified: boolean;
  } | null;
}): VendorAccessStatus | null {
  const profile = user.vendorProfile;
  if (!profile) return null;

  // Preserve a restriction applied independently during suspension.
  if (profile.accessStatus !== VendorAccessStatus.suspended) {
    return profile.accessStatus;
  }

  const previous = user.moderationSellerAccessBeforeSuspension;

  if (previous === VendorAccessStatus.active) {
    if (
      !profile.verified ||
      user.studentVerificationStatus !== "verified"
    ) {
      return VendorAccessStatus.pending_review;
    }
  }

  return previous ?? VendorAccessStatus.pending_review;
}

export async function listMarketplaceCases(
  req: AuthenticatedAdminRequest,
  res: Response
) {
  if (!req.admin || !canModerate(req.admin.role)) {
    return res.status(403).json({ success: false });
  }

  const status = String(req.query.status || "");
  const targetType = String(req.query.targetType || "");
  const universityId = String(req.query.universityId || "").trim();
  const page = numberPage(req.query.page);

  const where: Prisma.MarketplaceCaseWhereInput = {
    ...(statuses.includes(status as MarketplaceCaseStatus)
      ? { status: status as MarketplaceCaseStatus }
      : {}),
    ...(targets.includes(targetType as MarketplaceTargetType)
      ? { targetType: targetType as MarketplaceTargetType }
      : {}),
    ...(universityId ? { universityId } : {}),
  };

  try {
    const [cases, total, universities] = await Promise.all([
      prisma.marketplaceCase.findMany({
        where,
        orderBy: [
          { priorityScore: "desc" },
          { lastReportedAt: "desc" },
          { id: "desc" },
        ],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          targetId: true,
          targetType: true,
          universityId: true,
          highestSeverity: true,
          priorityScore: true,
          reportCount: true,
          status: true,
          lastReportedAt: true,
          createdAt: true,
          resolutionNote: true,
        },
      }),
      prisma.marketplaceCase.count({ where }),
      prisma.university.findMany({
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
    ]);

    const userIds = cases
      .filter((c) => c.targetType === "user")
      .map((c) => c.targetId);

    const productIds = cases
      .filter((c) => c.targetType === "product")
      .map((c) => Number(c.targetId))
      .filter(Number.isSafeInteger);

    const orderIds = cases
      .filter((c) => c.targetType === "order")
      .map((c) => c.targetId);

    const [users, products, orders] = await Promise.all([
      prisma.user.findMany({
        where: { id: { in: userIds } },
        select: {
          id: true,
          name: true,
          role: true,
          accountSuspendedAt: true,
          accountFlaggedAt: true,
          vendorProfile: {
            select: {
              businessName: true,
              accessStatus: true,
            },
          },
        },
      }),
      prisma.product.findMany({
        where: { id: { in: productIds } },
        select: {
          id: true,
          title: true,
          isArchived: true,
          moderationHiddenAt: true,
        },
      }),
      prisma.order.findMany({
        where: { id: { in: orderIds } },
        select: { id: true, status: true },
      }),
    ]);

    const name = new Map(
      users.map((u) => [
        u.id,
        `${u.vendorProfile?.businessName || u.name}${
          u.accountSuspendedAt ? " · suspended" : ""
        }`,
      ])
    );

    const productName = new Map(
      products.map((p) => [
        String(p.id),
        `${p.title}${p.moderationHiddenAt ? " · hidden" : ""}`,
      ])
    );

    const orderName = new Map(
      orders.map((o) => [
        o.id,
        `Order ${o.id.slice(0, 8)} · ${o.status}`,
      ])
    );

    return res.json({
      success: true,
      cases: cases.map((c) => ({
        ...c,
        priority: priorityLabel(c.priorityScore),
        targetLabel:
          c.targetType === "user"
            ? name.get(c.targetId)
            : c.targetType === "product"
              ? productName.get(c.targetId)
              : orderName.get(c.targetId),
      })),
      total,
      page,
      pageSize,
      universities,
    });
  } catch (error) {
    console.error("Marketplace cases error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to load cases.",
    });
  }
}

export async function getMarketplaceCase(
  req: AuthenticatedAdminRequest,
  res: Response
) {
  if (!req.admin || !canModerate(req.admin.role)) {
    return res.status(403).json({ success: false });
  }

  try {
    const found = await prisma.marketplaceCase.findUnique({
      where: { id: String(req.params.id || "") },
      include: {
        reports: {
          orderBy: { createdAt: "desc" },
          take: 100,
          select: {
            id: true,
            category: true,
            severity: true,
            details: true,
            createdAt: true,
            reporter: {
              select: { id: true, name: true },
            },
          },
        },
      },
    });

    if (!found) {
      return res.status(404).json({
        success: false,
        message: "Case not found.",
      });
    }

    let targetLabel: string | null = null;

    if (found.targetType === MarketplaceTargetType.user) {
      const user = await prisma.user.findUnique({
        where: { id: found.targetId },
        select: {
          name: true,
          vendorProfile: {
            select: { businessName: true },
          },
        },
      });

      targetLabel =
        user?.vendorProfile?.businessName || user?.name || null;
    } else if (
      found.targetType === MarketplaceTargetType.product
    ) {
      const id = Number(found.targetId);

      const product = Number.isSafeInteger(id)
        ? await prisma.product.findUnique({
            where: { id },
            select: { title: true },
          })
        : null;

      targetLabel = product?.title || null;
    } else {
      targetLabel =
        `Order #${found.targetId.slice(0, 8).toUpperCase()}`;
    }

    return res.json({
      success: true,
      case: {
        ...found,
        targetLabel,
        priority: priorityLabel(found.priorityScore),
      },
    });
  } catch (error) {
    console.error("Marketplace case details error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to load case.",
    });
  }
}

export async function updateMarketplaceCase(
  req: AuthenticatedAdminRequest,
  res: Response
) {
  if (!req.admin || !canModerate(req.admin.role)) {
    return res.status(403).json({ success: false });
  }

  const status = String(req.body?.status || "") as MarketplaceCaseStatus;
  const reason = String(req.body?.reason || "").trim();

  if (
    !statuses.includes(status) ||
    reason.length < 15 ||
    reason.length > 2000
  ) {
    return res.status(400).json({
      success: false,
      message:
        "Choose a valid status and enter a reason (15-2000 characters).",
    });
  }

  if (req.body?.confirm !== "CONFIRM") {
    return res.status(400).json({
      success: false,
      message: "Explicit confirmation required.",
    });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const before = await tx.marketplaceCase.findUnique({
        where: { id: String(req.params.id || "") },
      });

      if (!before) return null;

      const after = await tx.marketplaceCase.update({
        where: { id: before.id },
        data: { status, resolutionNote: reason },
      });

      await tx.adminAuditLog.create({
        data: {
          actorAdminId: req.admin!.id,
          action: "marketplace_case_status_changed",
          targetType: "marketplace_case",
          targetId: before.id,
          reason,
          beforeState: JSON.stringify({ status: before.status }),
          afterState: JSON.stringify({ status }),
        },
      });

      return after;
    });

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Case not found.",
      });
    }

    return res.json({ success: true, case: result });
  } catch (error) {
    console.error("Marketplace case status change error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to update case.",
    });
  }
}

const MOD_ACTIONS = [
  "flag",
  "clear_flag",
  "restrict_selling",
  "suspend_selling",
  "restore_selling",
  "suspend_account",
  "restore_account",
  "hide_listing",
  "restore_listing",
] as const;

type Action = (typeof MOD_ACTIONS)[number];

export async function moderateMarketplaceTarget(
  req: AuthenticatedAdminRequest,
  res: Response
) {
  const admin = req.admin;

  if (!admin || !canModerate(admin.role)) {
    return res.status(403).json({ success: false });
  }

  const action = String(req.body?.action || "") as Action;
  const reason = String(req.body?.reason || "").trim();

  if (
    !MOD_ACTIONS.includes(action) ||
    reason.length < 15 ||
    reason.length > 2000 ||
    req.body?.confirm !== "CONFIRM"
  ) {
    return res.status(400).json({
      success: false,
      message:
        "Action, explicit confirmation and reason (15-2000 characters) are required.",
    });
  }

  if (
    [
      "suspend_account",
      "restore_account",
      "suspend_selling",
      "restore_selling",
    ].includes(action) &&
    admin.role !== AdminRole.super_admin
  ) {
    return res.status(403).json({
      success: false,
      message:
        "Super Admin approval required for suspensions and restorations.",
    });
  }

  try {
    const outcome = await prisma.$transaction(async (tx) => {
      const target = await tx.marketplaceCase.findUnique({
        where: { id: String(req.params.id || "") },
      });

      if (!target) {
        return { code: 404, message: "Case not found." };
      }

      let before: Record<string, unknown>;
      let after: Record<string, unknown>;

      if (
        [
          "flag",
          "clear_flag",
          "restrict_selling",
          "suspend_selling",
          "restore_selling",
          "suspend_account",
          "restore_account",
        ].includes(action)
      ) {
        if (target.targetType !== MarketplaceTargetType.user) {
          return {
            code: 400,
            message: "This action requires a user report.",
          };
        }

        const user = await tx.user.findUnique({
          where: { id: target.targetId },
          select: {
            id: true,
            role: true,
            studentVerificationStatus: true,
            accountSuspendedAt: true,
            accountFlaggedAt: true,
            moderationSellerAccessBeforeSuspension: true,
            vendorProfile: {
              select: {
                id: true,
                accessStatus: true,
                verified: true,
              },
            },
          },
        });

        if (!user) {
          return {
            code: 404,
            message: "User no longer exists.",
          };
        }

        before = {
          accountSuspended: Boolean(user.accountSuspendedAt),
          accountFlagged: Boolean(user.accountFlaggedAt),
          sellerAccess: user.vendorProfile?.accessStatus || null,
        };

        if (action === "flag" && user.accountFlaggedAt) {
          return {
            code: 409,
            message: "Account is already flagged.",
          };
        }

        if (action === "clear_flag" && !user.accountFlaggedAt) {
          return {
            code: 409,
            message: "Account is not currently flagged.",
          };
        }

        if (action === "flag" || action === "clear_flag") {
          await tx.user.update({
            where: { id: user.id },
            data: {
              accountFlaggedAt:
                action === "flag" ? new Date() : null,
              accountFlagReason:
                action === "flag" ? reason : null,
            },
          });
        }

        if (
          [
            "restrict_selling",
            "suspend_selling",
            "suspend_account",
          ].includes(action)
        ) {
          const [sellerOpenItems, buyerOpenOrders] =
            await Promise.all([
              tx.orderItem.count({
                where: {
                  vendorId: user.id,
                  status: { in: ["pending", "confirmed"] },
                },
              }),
              action === "suspend_account"
                ? tx.order.count({
                    where: {
                      buyerId: user.id,
                      status: {
                        in: ["pending", "confirmed"],
                      },
                    },
                  })
                : Promise.resolve(0),
            ]);

          if (
            (sellerOpenItems > 0 || buyerOpenOrders > 0) &&
            req.body?.acknowledgeOpenOrders !== true
          ) {
            return {
              code: 409,
              message:
                `This user has ${sellerOpenItems} open seller items ` +
                `and ${buyerOpenOrders} open buyer orders. ` +
                "Acknowledge the impact on ongoing orders before continuing.",
            };
          }
        }

        if (
          action === "restore_account" &&
          !user.accountSuspendedAt
        ) {
          return {
            code: 409,
            message: "Account is not suspended.",
          };
        }

        if (
          action === "suspend_account" &&
          user.accountSuspendedAt
        ) {
          return {
            code: 409,
            message: "Account is already suspended.",
          };
        }

        if (
          ["restrict_selling", "suspend_selling"].includes(action) &&
          user.accountSuspendedAt
        ) {
          return {
            code: 409,
            message:
              "Account is suspended. Use the account action instead.",
          };
        }

        if (
          action === "restore_selling" &&
          user.accountSuspendedAt
        ) {
          return {
            code: 409,
            message:
              "Restore the account before adjusting seller access.",
          };
        }

        if (
          [
            "restrict_selling",
            "suspend_selling",
            "restore_selling",
          ].includes(action) &&
          (!user.vendorProfile || user.role !== UserRole.vendor)
        ) {
          return {
            code: 409,
            message: "This account is not a seller.",
          };
        }

        if (
          (action === "restrict_selling" &&
            user.vendorProfile?.accessStatus ===
              VendorAccessStatus.restricted) ||
          (action === "suspend_selling" &&
            user.vendorProfile?.accessStatus ===
              VendorAccessStatus.suspended)
        ) {
          return {
            code: 409,
            message: "Seller already has this access status.",
          };
        }

        if (
          action === "restore_selling" &&
          user.vendorProfile &&
          user.vendorProfile.accessStatus !==
            VendorAccessStatus.restricted &&
          user.vendorProfile.accessStatus !==
            VendorAccessStatus.suspended
        ) {
          return {
            code: 409,
            message:
              "Seller does not have an Admin restriction to restore.",
          };
        }

        if (
          action === "restrict_selling" ||
          action === "suspend_selling"
        ) {
          await tx.vendorProfile.update({
            where: { id: user.vendorProfile!.id },
            data: {
              accessStatus:
                action === "restrict_selling"
                  ? VendorAccessStatus.restricted
                  : VendorAccessStatus.suspended,
            },
          });
        }

        if (action === "restore_selling") {
          // Seller-only restoration remains pending_review until
          // its separate eligibility workflow is verified.
          await tx.vendorProfile.update({
            where: { id: user.vendorProfile!.id },
            data: {
              accessStatus: VendorAccessStatus.pending_review,
            },
          });
        }

        let accountRestoredSellerStatus:
          | VendorAccessStatus
          | null = null;

        if (
          action === "suspend_account" ||
          action === "restore_account"
        ) {
          if (action === "restore_account") {
            accountRestoredSellerStatus =
              statusAfterAccountRestoration(user);
          }

          await tx.user.update({
            where: { id: user.id },
            data: {
              accountSuspendedAt:
                action === "suspend_account" ? new Date() : null,
              accountSuspensionReason:
                action === "suspend_account" ? reason : null,
              moderationSellerAccessBeforeSuspension:
                action === "suspend_account"
                  ? user.vendorProfile?.accessStatus || null
                  : null,
            },
          });

          if (user.vendorProfile) {
            await tx.vendorProfile.update({
              where: { id: user.vendorProfile.id },
              data: {
                accessStatus:
                  action === "suspend_account"
                    ? VendorAccessStatus.suspended
                    : accountRestoredSellerStatus ??
                      VendorAccessStatus.pending_review,
              },
            });
          }
        }

        after = {
          accountFlagged:
            action === "flag"
              ? true
              : action === "clear_flag"
                ? false
                : before.accountFlagged,
          accountSuspended:
            action === "suspend_account"
              ? true
              : action === "restore_account"
                ? false
                : before.accountSuspended,
          sellerAccess:
            action === "restrict_selling"
              ? VendorAccessStatus.restricted
              : action === "suspend_selling" ||
                  action === "suspend_account"
                ? VendorAccessStatus.suspended
                : action === "restore_selling"
                  ? VendorAccessStatus.pending_review
                  : action === "restore_account"
                    ? accountRestoredSellerStatus
                    : before.sellerAccess,
        };
      } else {
        if (target.targetType !== MarketplaceTargetType.product) {
          return {
            code: 400,
            message: "This action requires a listing report.",
          };
        }

        const productId = Number(target.targetId);

        if (!Number.isSafeInteger(productId)) {
          return {
            code: 400,
            message: "Invalid listing ID.",
          };
        }

        const product = await tx.product.findUnique({
          where: { id: productId },
          select: {
            id: true,
            isArchived: true,
            moderationHiddenAt: true,
          },
        });

        if (!product) {
          return {
            code: 404,
            message: "Listing not found.",
          };
        }

        before = {
          isArchived: product.isArchived,
          moderationHidden: Boolean(product.moderationHiddenAt),
        };

        if (action === "hide_listing") {
          if (product.isArchived) {
            return {
              code: 409,
              message: "This listing is already archived or hidden.",
            };
          }

          await tx.product.update({
            where: { id: productId },
            data: {
              isArchived: true,
              moderationHiddenAt: new Date(),
              moderationHiddenReason: reason,
              archivedAt: new Date(),
            },
          });
        } else if (action === "restore_listing") {
          if (!product.moderationHiddenAt) {
            return {
              code: 409,
              message:
                "Only listings hidden by moderation can be restored here.",
            };
          }

          await tx.product.update({
            where: { id: productId },
            data: {
              isArchived: false,
              moderationHiddenAt: null,
              moderationHiddenReason: null,
              archivedAt: null,
            },
          });
        } else {
          return {
            code: 400,
            message: "Invalid listing action.",
          };
        }

        after = {
          isArchived: action === "hide_listing",
          moderationHidden: action === "hide_listing",
        };
      }

      await tx.marketplaceCase.update({
        where: { id: target.id },
        data: {
          status: MarketplaceCaseStatus.action_taken,
          resolutionNote: reason,
        },
      });

      await tx.adminAuditLog.create({
        data: {
          actorAdminId: admin.id,
          action: `marketplace_${action}`,
          targetType: target.targetType,
          targetId: target.targetId,
          reason,
          beforeState: JSON.stringify(before),
          afterState: JSON.stringify(after),
        },
      });

      return {
        code: 200,
        message: "Moderation action recorded.",
        action,
      };
    });

    return res.status(outcome.code).json({
      success: outcome.code === 200,
      ...outcome,
    });
  } catch (error) {
    console.error("Marketplace moderation error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to apply moderation action.",
    });
  }
}

export async function listMarketplaceSellers(
  req: AuthenticatedAdminRequest,
  res: Response
) {
  if (!req.admin || !canModerate(req.admin.role)) {
    return res.status(403).json({ success: false });
  }

  const q = String(req.query.q || "").trim().slice(0, 100);
  const universityId = String(req.query.universityId || "").trim();
  const page = numberPage(req.query.page);

  const where: Prisma.UserWhereInput = {
    role: UserRole.vendor,
    ...(universityId ? { universityId } : {}),
    ...(q
      ? {
          OR: [
            {
              name: {
                contains: q,
                mode: "insensitive",
              },
            },
            {
              vendorProfile: {
                is: {
                  businessName: {
                    contains: q,
                    mode: "insensitive",
                  },
                },
              },
            },
          ],
        }
      : {}),
  };

  try {
    const [sellers, total] = await Promise.all([
      prisma.user.findMany({
        where,
        take: pageSize,
        skip: (page - 1) * pageSize,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: {
          id: true,
          name: true,
          createdAt: true,
          studentVerificationStatus: true,
          accountSuspendedAt: true,
          accountFlaggedAt: true,
          university: {
            select: { name: true },
          },
          vendorProfile: {
            select: {
              businessName: true,
              accessStatus: true,
              verified: true,
            },
          },
          sellerBadges: {
            where: { active: true },
            select: { kind: true },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    return res.json({
      success: true,
      sellers,
      total,
      page,
      pageSize,
    });
  } catch (error) {
    console.error("Admin sellers error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to load sellers.",
    });
  }
}

export async function listMarketplaceListings(
  req: AuthenticatedAdminRequest,
  res: Response
) {
  if (!req.admin || !canModerate(req.admin.role)) {
    return res.status(403).json({ success: false });
  }

  const page = numberPage(req.query.page);
  const q = String(req.query.q || "").trim().slice(0, 100);

  try {
    const where: Prisma.ProductWhereInput = q
      ? {
          title: {
            contains: q,
            mode: "insensitive",
          },
        }
      : {};

    const [listings, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: pageSize,
        skip: (page - 1) * pageSize,
        select: {
          id: true,
          title: true,
          category: true,
          price: true,
          isArchived: true,
          moderationHiddenAt: true,
          vendor: {
            select: {
              id: true,
              name: true,
              vendorProfile: {
                select: { businessName: true },
              },
            },
          },
        },
      }),
      prisma.product.count({ where }),
    ]);

    return res.json({
      success: true,
      listings,
      total,
      page,
      pageSize,
    });
  } catch (error) {
    console.error("Admin listings error:", error);
    return res.status(500).json({
      success: false,
      message: "Unable to load listings.",
    });
  }
}
