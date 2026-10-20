import {
  Router,
} from "express";

import {
  getNotifications,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
} from "../controllers/notification.controller";

import {
  requireAuth,
} from "../middleware/auth.middleware";

const router =
  Router();

router.get(
  "/",
  requireAuth,
  getNotifications
);

router.get(
  "/unread-count",
  requireAuth,
  getUnreadNotificationCount
);

router.post(
  "/read-all",
  requireAuth,
  markAllNotificationsRead
);

router.post(
  "/:id/read",
  requireAuth,
  markNotificationRead
);

export default router;