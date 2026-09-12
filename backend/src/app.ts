import { prisma } from "./lib/prisma";
import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.routes";

const app = express();

app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "https://campusmart-sigma.vercel.app",
    ],
    credentials: true,
  })
);

app.use(express.json());

app.use("/api/auth", authRoutes);

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "CampusMart backend is running"
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    status: "healthy"
  });
});

app.get("/api/health/database", async (req, res) => {
  try {
    const userCount = await prisma.user.count();

    res.json({
      success: true,
      status: "database connected",
      users: userCount,
    });
  } catch (error) {
    console.error("Database health check failed:", error);

    res.status(500).json({
      success: false,
      status: "database connection failed",
    });
  }
});

export default app;