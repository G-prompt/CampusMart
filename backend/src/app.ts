import express from "express";
import cors from "cors";

import "./lib/supabaseAdmin";

import {
  prisma,
} from "./lib/prisma";

import authRoutes from "./routes/auth.routes";
import productRoutes from "./routes/product.routes";
import orderRoutes from "./routes/order.routes";
import universityRoutes from "./routes/university.routes";
import verificationRoutes from "./routes/verification.routes";
import vendorRoutes from "./routes/vendor.routes";

import adminAuthRoutes from "./routes/adminAuth.routes";
import adminVerificationRoutes from "./routes/adminVerification.routes";
import adminUniversityRoutes from "./routes/adminUniversity.routes";

const app =
  express();

/*
 * --------------------------------------------------
 * Global middleware
 * --------------------------------------------------
 */

app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "https://campusmart-sigma.vercel.app",
    ],

    credentials: true,

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

/*
 * --------------------------------------------------
 * Customer API
 * --------------------------------------------------
 */

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

/*
 * --------------------------------------------------
 * Admin API
 * --------------------------------------------------
 */

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

/*
 * --------------------------------------------------
 * Backend status
 * --------------------------------------------------
 */

app.get(
  "/",
  (
    req,
    res
  ) => {
    res.json({
      success: true,

      message:
        "CampusMart backend is running",
    });
  }
);

/*
 * --------------------------------------------------
 * Health checks
 * --------------------------------------------------
 */

app.get(
  "/api/health",
  (
    req,
    res
  ) => {
    res.json({
      success: true,

      status:
        "healthy",
    });
  }
);

app.get(
  "/api/health/database",
  async (
    req,
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
        success: true,

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
    } catch (error) {
      console.error(
        "Database health check failed:",
        error
      );

      return res.status(500).json({
        success: false,

        status:
          "database connection failed",
      });
    }
  }
);

export default app;