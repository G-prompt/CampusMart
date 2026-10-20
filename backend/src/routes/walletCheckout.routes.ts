import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware";
import { checkoutWallet } from "../controllers/walletCheckout.controller";
const router=Router();
router.get("/checkout",requireAuth,checkoutWallet);
export default router;
