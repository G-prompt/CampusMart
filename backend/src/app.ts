import express from "express";
import cors from "cors";

import { prisma } from "./lib/prisma";

import authRoutes from "./routes/auth.routes";
import productRoutes from "./routes/product.routes";
import orderRoutes from "./routes/order.routes";

const app =
  express();

app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "https://campusmart-sigma.vercel.app",
    ],

    credentials: true,
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
      ] =
        await Promise.all([
          prisma.user.count(),
          prisma.product.count(),
          prisma.order.count(),
        ]);

      res.json({
        success: true,

        status:
          "database connected",

        users:
          userCount,

        products:
          productCount,

        orders:
          orderCount,
      });
    } catch (error) {
      console.error(
        "Database health check failed:",
        error
      );

      res.status(500).json({
        success: false,

        status:
          "database connection failed",
      });
    }
  }
);

export default app;