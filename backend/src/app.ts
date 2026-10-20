import express from "express";
import cors from "cors";

import "./lib/supabaseAdmin";

import {
  prisma,
} from "./lib/prisma";

import authRoutes from "./routes/auth.routes";
import productRoutes from "./routes/product.routes";
import orderRoutes from "./routes/order.routes";
import walletCheckoutRoutes from "./routes/walletCheckout.routes";
import universityRoutes from "./routes/university.routes";
import verificationRoutes from "./routes/verification.routes";
import vendorRoutes from "./routes/vendor.routes";
import messageRoutes from "./routes/message.routes";
import notificationRoutes from "./routes/notification.routes";

import adminAuthRoutes from "./routes/adminAuth.routes";
import adminVerificationRoutes from "./routes/adminVerification.routes";
import adminUniversityRoutes from "./routes/adminUniversity.routes";
import adminAuditRoutes from "./routes/adminAudit.routes";
import adminAnalyticsRoutes from "./routes/adminAnalytics.routes";
import adminSellerRecognitionRoutes from "./routes/adminSellerRecognition.routes";
import adminMarketplaceRoutes from "./routes/adminMarketplace.routes";
import marketplaceReportsRoutes from "./routes/marketplaceReports.routes";

const app =
  express();

app.use(
  cors({
    origin: (origin, callback) => {
      const production = [
        "https://campusmart-sigma.vercel.app",
      ];
      const local = ["http://localhost:3000", "http://127.0.0.1:3000"];
      // Only development builds permit a private-network phone preview.
      const privateNetwork = /^http:\/\/(?:192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}):3000$/;
      if (
        !origin || production.includes(origin) || local.includes(origin) ||
        (process.env.NODE_ENV !== "production" && privateNetwork.test(origin))
      ) {
        callback(null, true);
      } else {
        callback(new Error("Origin not permitted by CampusMart CORS"));
      }
    },

    credentials:
      true,

    methods: [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS",
    ],

    allowedHeaders: [
      "Content-Type",
      "Authorization",
    ],
  })
);

app.use(
  express.json()
);

app.use(
  "/api/auth",
  authRoutes
);

app.use(
  "/api/products",
  productRoutes
);

app.use(
  "/api/orders",
  orderRoutes
);

app.use("/api/wallet",walletCheckoutRoutes);

app.use(
  "/api/universities",
  universityRoutes
);

app.use(
  "/api/verification",
  verificationRoutes
);

app.use(
  "/api/vendor",
  vendorRoutes
);

app.use(
  "/api/messages",
  messageRoutes
);

app.use(
  "/api/notifications",
  notificationRoutes
);

app.use(
  "/api/admin/auth",
  adminAuthRoutes
);

app.use(
  "/api/admin/verification",
  adminVerificationRoutes
);

app.use(
  "/api/admin/universities",
  adminUniversityRoutes
);

app.use("/api/admin/audit", adminAuditRoutes);
app.use("/api/admin/analytics", adminAnalyticsRoutes);
app.use("/api/admin/seller-recognition", adminSellerRecognitionRoutes);
app.use("/api/admin/marketplace", adminMarketplaceRoutes);
app.use("/api/marketplace/reports", marketplaceReportsRoutes);

app.get(
  "/",
  (
    _req,
    res
  ) => {
    res.json({
      success:
        true,

      message:
        "CampusMart backend is running",
    });
  }
);

app.get(
  "/api/health",
  (
    _req,
    res
  ) => {
    res.json({
      success:
        true,

      status:
        "healthy",
    });
  }
);

app.get(
  "/api/health/database",
  async (
    _req,
    res
  ) => {
    try {
      const [
        userCount,
        productCount,
        orderCount,
        universityCount,
        adminCount,
      ] =
        await Promise.all([
          prisma.user.count(),
          prisma.product.count(),
          prisma.order.count(),
          prisma.university.count(),
          prisma.admin.count(),
        ]);

      return res.json({
        success:
          true,

        status:
          "database connected",

        users:
          userCount,

        products:
          productCount,

        orders:
          orderCount,

        universities:
          universityCount,

        admins:
          adminCount,
      });
    } catch (
      error
    ) {
      console.error(
        "Database health check failed:",
        error
      );

      return res
        .status(500)
        .json({
          success:
            false,

          status:
            "database connection failed",
        });
    }
  }
);

export default app;