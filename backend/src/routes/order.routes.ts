import {
  Router,
} from "express";

import {
  createOrder,
  getBuyerFulfillmentCodes,
  getMyOrders,
  getOrderById,
  getVendorOrders,
  updateVendorOrderStatus,
  verifyVendorFulfillmentCode,
} from "../controllers/order.controller";

import {
  requireAuth,
  requireVendorAccount,
  requireVendorOrderFulfillment,
} from "../middleware/auth.middleware";

const router =
  Router();

/*
 * =======================================================
 * BUYER
 * =======================================================
 */

/*
 * Create a new order.
 */
router.post(
  "/",
  requireAuth,
  createOrder
);

/*
 * Buyer's complete order history.
 */
router.get(
  "/mine",
  requireAuth,
  getMyOrders
);

/*
 * Buyer-only access to fulfilment codes for one order.
 *
 * Ownership is checked inside the controller.
 *
 * IMPORTANT:
 * Keep this route above "/:id".
 */
router.get(
  "/:id/fulfillment-codes",
  requireAuth,
  getBuyerFulfillmentCodes
);

/*
 * =======================================================
 * SELLER
 * =======================================================
 */

/*
 * Historical seller orders remain readable by vendor
 * accounts even if current selling eligibility changes.
 */
router.get(
  "/vendor",
  requireAuth,
  requireVendorAccount,
  getVendorOrders
);

/*
 * Existing order transitions:
 *
 * pending   -> confirmed
 * pending   -> cancelled
 * confirmed -> cancelled
 *
 * Direct completion is deliberately rejected by the
 * controller.
 */
router.patch(
  "/vendor/:id/status",
  requireAuth,
  requireVendorOrderFulfillment,
  updateVendorOrderStatus
);

/*
 * Complete an existing confirmed seller portion using
 * the private 4-digit code supplied by the buyer.
 *
 * The same existing-order fulfilment middleware applies:
 *
 * active         -> allowed
 * pending_review -> allowed
 * restricted     -> blocked
 * suspended      -> blocked
 */
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
 *
 * Keep this last because "/:id" is intentionally broad.
 */
router.get(
  "/:id",
  requireAuth,
  getOrderById
);

export default router;