import { Router } from "express";
import { AdminRole } from "../generated/prisma/client";
import { requireAdmin, requireAdminRole } from "../middleware/adminAuth.middleware";
import { getAdminAnalytics } from "../controllers/adminAnalytics.controller";

const router = Router();
router.get("/", requireAdmin, requireAdminRole(AdminRole.super_admin), getAdminAnalytics);
export default router;
