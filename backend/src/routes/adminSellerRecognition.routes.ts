import { Router } from "express";
import { AdminRole } from "../generated/prisma/client";
import { requireAdmin, requireAdminRole } from "../middleware/adminAuth.middleware";
import { listSellerRecognition, setSellerBadge } from "../controllers/adminSellerRecognition.controller";
const router = Router();
router.get("/", requireAdmin, requireAdminRole(AdminRole.super_admin, AdminRole.marketplace_moderator), listSellerRecognition);
router.patch("/:vendorId/badges/:kind", requireAdmin, requireAdminRole(AdminRole.super_admin), setSellerBadge);
export default router;
