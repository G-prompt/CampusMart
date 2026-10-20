
import {
  Router,
  type NextFunction,
  type Request,
  type Response,
} from "express";

import {
  createOrder,
} from "../controllers/orderCreation.controller";

import {
  getBuyerFulfillmentCodes,
  getMyOrders,
  getOrderById,
  getVendorOrders,
  verifyVendorFulfillmentCode,
} from "../controllers/order.controller";

import {
  getOrderTimings,
  updateVendorOrderStatusWithTiming,
} from "../controllers/orderTiming.controller";

import { markOrderReady } from "../controllers/orderReady.controller";

import {
  getOrderPickupSelections,
} from "../controllers/orderPickup.controller";

import {
  requireAuth,
  requireVendorAccount,
  requireVendorOrderFulfillment,
} from "../middleware/auth.middleware";

const router = Router();

/*
 * =======================================================
 * LEGACY PICKUP SLOT
 * =======================================================
 *
 * Historical values remain in the database.
 * New orders no longer accept the old preferredSlot.
 */

const discardLegacyPreferredSlot = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  if (
    req.body &&
    typeof req.body === "object"
  ) {
    delete req.body.preferredSlot;
  }

  next();
};

/*
 * =======================================================
 * BUYER
 * =======================================================
 */

router.post(
  "/",
  requireAuth,
  discardLegacyPreferredSlot,
  createOrder
);

router.get(
  "/timings",
  requireAuth,
  getOrderTimings
);

router.get(
  "/mine",
  requireAuth,
  getMyOrders
);

router.get(
  "/:id/fulfillment-codes",
  requireAuth,
  getBuyerFulfillmentCodes
);

/*
 * =======================================================
 * PICKUP SELECTIONS
 * =======================================================
 */

router.get(
  "/:id/pickup-selections",
  requireAuth,
  getOrderPickupSelections
);

/*
 * =======================================================
 * SELLER
 * =======================================================
 */

router.get(
  "/vendor",
  requireAuth,
  requireVendorAccount,
  getVendorOrders
);

router.patch(
  "/vendor/:id/status",
  requireAuth,
  requireVendorOrderFulfillment,
  updateVendorOrderStatusWithTiming
);

router.post("/vendor/:id/ready", requireAuth, requireVendorOrderFulfillment, markOrderReady);

router.post(
  "/vendor/:id/fulfillment",
  requireAuth,
  requireVendorOrderFulfillment,
  verifyVendorFulfillmentCode
);

/*
 * =======================================================
 * INDIVIDUAL ORDER
 * =======================================================
 */

router.get(
  "/:id",
  requireAuth,
  getOrderById
);

export default router;
