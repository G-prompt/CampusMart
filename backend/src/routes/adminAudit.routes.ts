import { Router } from "express";
import { AdminRole } from "../generated/prisma/client";
import { requireAdmin, requireAdminRole } from "../middleware/adminAuth.middleware";
import { getAdminAudit } from "../controllers/adminAudit.controller";
const router = Router();
router.get("/", requireAdmin, requireAdminRole(AdminRole.super_admin), getAdminAudit);
export default router;
