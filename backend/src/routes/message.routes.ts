import { Router } from "express";

import {
  getMessagingConversation,
  getMessagingInbox,
  getMessagingUnreadCount,
  markMessagingConversationRead,
  sendMessagingMessage,
  startMessagingConversation,
} from "../controllers/message.controller";

import {
  requireAuth,
} from "../middleware/auth.middleware";

const router =
  Router();

/*
 * =======================================================
 * CAMPUSMART MESSAGING ROUTES
 * =======================================================
 *
 * All messaging routes require authentication.
 *
 * Individual conversation membership and messaging
 * restrictions are enforced deeper in the messaging
 * service/controller layer.
 */

/*
 * -------------------------------------------------------
 * INBOX
 * -------------------------------------------------------
 *
 * Returns all conversations belonging to the current user
 * as either:
 *
 * - buyer
 * - vendor
 */
router.get(
  "/conversations",
  requireAuth,
  getMessagingInbox
);

/*
 * -------------------------------------------------------
 * UNREAD COUNT
 * -------------------------------------------------------
 *
 * Keep this ABOVE any dynamic conversation route.
 *
 * Used later for:
 *
 * - navbar badge
 * - account menu
 * - notification indicators
 */
router.get(
  "/unread-count",
  requireAuth,
  getMessagingUnreadCount
);

/*
 * -------------------------------------------------------
 * START CONVERSATION
 * -------------------------------------------------------
 *
 * Supported contexts:
 *
 * general
 * listing
 * order
 *
 * A first message is required.
 */
router.post(
  "/conversations",
  requireAuth,
  startMessagingConversation
);

/*
 * -------------------------------------------------------
 * GET ONE CONVERSATION
 * -------------------------------------------------------
 */
router.get(
  "/conversations/:conversationId",
  requireAuth,
  getMessagingConversation
);

/*
 * -------------------------------------------------------
 * SEND MESSAGE
 * -------------------------------------------------------
 */
router.post(
  "/conversations/:conversationId/messages",
  requireAuth,
  sendMessagingMessage
);

/*
 * -------------------------------------------------------
 * MARK READ
 * -------------------------------------------------------
 *
 * Reading remains available even when the user is
 * temporarily restricted from sending.
 */
router.post(
  "/conversations/:conversationId/read",
  requireAuth,
  markMessagingConversationRead
);

export default router;