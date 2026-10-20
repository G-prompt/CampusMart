import {
  Response,
} from "express";

import {
  prisma,
} from "../lib/prisma";

import type {
  AuthenticatedRequest,
} from "../middleware/auth.middleware";

function getLimit(
  value:
    unknown
) {
  const parsed =
    Number(
      value
    );

  if (
    !Number.isInteger(
      parsed
    ) ||
    parsed <=
      0
  ) {
    return 20;
  }

  return Math.min(
    parsed,
    50
  );
}

export const getNotifications =
  async (
    req:
      AuthenticatedRequest,
    res:
      Response
  ) => {
    try {
      if (
        !req.user
      ) {
        return res
          .status(401)
          .json({
            success:
              false,

            message:
              "Authentication required.",
          });
      }

      const limit =
        getLimit(
          req.query?.limit
        );

      const [
        notifications,
        unreadCount,
      ] =
        await Promise.all([
          prisma.notification.findMany({
            where: {
              userId:
                req.user.id,
            },

            orderBy: {
              createdAt:
                "desc",
            },

            take:
              limit,
          }),

          prisma.notification.count({
            where: {
              userId:
                req.user.id,

              readAt:
                null,
            },
          }),
        ]);

      return res
        .status(200)
        .json({
          success:
            true,

          notifications,

          unreadCount,
        });
    } catch (
      error
    ) {
      console.error(
        "Get notifications error:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            "Unable to load notifications.",
        });
    }
  };

export const getUnreadNotificationCount =
  async (
    req:
      AuthenticatedRequest,
    res:
      Response
  ) => {
    try {
      if (
        !req.user
      ) {
        return res
          .status(401)
          .json({
            success:
              false,

            message:
              "Authentication required.",
          });
      }

      const unreadCount =
        await prisma.notification.count({
          where: {
            userId:
              req.user.id,

            readAt:
              null,
          },
        });

      return res
        .status(200)
        .json({
          success:
            true,

          unreadCount,
        });
    } catch (
      error
    ) {
      console.error(
        "Get notification count error:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            "Unable to load notification count.",
        });
    }
  };

export const markNotificationRead =
  async (
    req:
      AuthenticatedRequest,
    res:
      Response
  ) => {
    try {
      if (
        !req.user
      ) {
        return res
          .status(401)
          .json({
            success:
              false,

            message:
              "Authentication required.",
          });
      }

      const notificationId =
        String(
          req.params.id ??
            ""
        ).trim();

      if (
        !notificationId
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Invalid notification ID.",
          });
      }

      const notification =
        await prisma.notification.findFirst({
          where: {
            id:
              notificationId,

            userId:
              req.user.id,
          },
        });

      if (
        !notification
      ) {
        return res
          .status(404)
          .json({
            success:
              false,

            message:
              "Notification not found.",
          });
      }

      const updated =
        notification.readAt
          ? notification
          : await prisma.notification.update({
              where: {
                id:
                  notification.id,
              },

              data: {
                readAt:
                  new Date(),
              },
            });

      return res
        .status(200)
        .json({
          success:
            true,

          notification:
            updated,
        });
    } catch (
      error
    ) {
      console.error(
        "Mark notification read error:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            "Unable to update notification.",
        });
    }
  };

export const markAllNotificationsRead =
  async (
    req:
      AuthenticatedRequest,
    res:
      Response
  ) => {
    try {
      if (
        !req.user
      ) {
        return res
          .status(401)
          .json({
            success:
              false,

            message:
              "Authentication required.",
          });
      }

      const now =
        new Date();

      const result =
        await prisma.notification.updateMany({
          where: {
            userId:
              req.user.id,

            readAt:
              null,
          },

          data: {
            readAt:
              now,
          },
        });

      return res
        .status(200)
        .json({
          success:
            true,

          markedRead:
            result.count,

          readAt:
            now,
        });
    } catch (
      error
    ) {
      console.error(
        "Mark all notifications read error:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          message:
            "Unable to update notifications.",
        });
    }
  };