import {
  Router,
} from "express";

import {
  createOrder,
  getMyOrders,
  getOrderById,
  getVendorOrders,
  updateVendorOrderStatus,
} from "../controllers/order.controller";

import {
  requireAuth,
  requireVendor,
} from "../middleware/auth.middleware";

const router =
  Router();

router.post(
  "/",
  requireAuth,
  createOrder
);

router.get(
  "/mine",
  requireAuth,
  getMyOrders
);

router.get(
  "/vendor",
  requireAuth,
  requireVendor,
  getVendorOrders
);

router.patch(
  "/vendor/:id/status",
  requireAuth,
  requireVendor,
  updateVendorOrderStatus
);

router.get(
  "/:id",
  requireAuth,
  getOrderById
);

export default router;