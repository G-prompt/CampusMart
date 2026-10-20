import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import { submitMarketplaceReport, getMarketplaceReportTarget } from "../controllers/marketplaceReports.controller";
const router = Router();
router.get("/target", requireAuth, getMarketplaceReportTarget);
router.post("/", requireAuth, submitMarketplaceReport);
export default router;
