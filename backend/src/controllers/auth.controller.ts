import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import type { AuthenticatedRequest } from "../middleware/auth.middleware";
import { prisma } from "../lib/prisma";
import { UserRole } from "../generated/prisma/client";

function cleanOptionalText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const cleaned = value.trim();

  return cleaned.length > 0 ? cleaned : null;
}

export const register = async (
  req: Request,
  res: Response
) => {
  try {
    const {
      name,
      email,
      password,
      role = "client",

      campus,
      phone,
      bio,

      businessName,
      businessDescription,
      pickupLocation,
    } = req.body;

    // -------------------------
    // Basic required fields
    // -------------------------

    if (!name || !email || !password || !campus) {
      return res.status(400).json({
        success: false,
        message:
          "Name, campus, email and password are required.",
      });
    }

    const cleanName = String(name).trim();

    const cleanEmail = String(email)
      .trim()
      .toLowerCase();

    const cleanCampus = String(campus).trim();

    const cleanPhone = cleanOptionalText(phone);

    const cleanBio = cleanOptionalText(bio);

    // -------------------------
    // Validation
    // -------------------------

    if (cleanName.length < 2) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid name.",
      });
    }

    if (cleanCampus.length < 2) {
      return res.status(400).json({
        success: false,
        message: "Please enter your campus or school.",
      });
    }

    if (!cleanEmail.includes("@")) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address.",
      });
    }

    if (
      typeof password !== "string" ||
      password.length < 8
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Password must be at least 8 characters long.",
      });
    }

    if (!["client", "vendor"].includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid account role.",
      });
    }

    const userRole =
      role === "vendor"
        ? UserRole.vendor
        : UserRole.client;

    // -------------------------
    // Vendor-only validation
    // -------------------------

    const cleanBusinessName =
      cleanOptionalText(businessName);

    const cleanBusinessDescription =
      cleanOptionalText(businessDescription);

    const cleanPickupLocation =
      cleanOptionalText(pickupLocation);

    if (userRole === UserRole.vendor) {
      if (!cleanPhone) {
        return res.status(400).json({
          success: false,
          message:
            "Phone number is required for vendor accounts.",
        });
      }

      if (!cleanBusinessName) {
        return res.status(400).json({
          success: false,
          message:
            "Shop or business name is required.",
        });
      }

      if (!cleanBusinessDescription) {
        return res.status(400).json({
          success: false,
          message:
            "Please describe what you sell.",
        });
      }

      if (!cleanPickupLocation) {
        return res.status(400).json({
          success: false,
          message:
            "Pickup location is required.",
        });
      }
    }

    // -------------------------
    // Prevent duplicate email
    // -------------------------

    const existingUser =
      await prisma.user.findUnique({
        where: {
          email: cleanEmail,
        },
      });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message:
          "An account with this email already exists.",
      });
    }

    // -------------------------
    // Hash password
    // -------------------------

    const passwordHash = await bcrypt.hash(
      password,
      12
    );

    // -------------------------
    // Create account
    // -------------------------

    const user = await prisma.user.create({
      data: {
        name: cleanName,
        email: cleanEmail,
        passwordHash,
        role: userRole,

        campus: cleanCampus,
        phone: cleanPhone,

        bio:
          userRole === UserRole.client
            ? cleanBio
            : null,

        vendorProfile:
          userRole === UserRole.vendor &&
          cleanBusinessName &&
          cleanBusinessDescription &&
          cleanPickupLocation
            ? {
                create: {
                  businessName:
                    cleanBusinessName,

                  businessDescription:
                    cleanBusinessDescription,

                  pickupLocation:
                    cleanPickupLocation,
                },
              }
            : undefined,
      },

      include: {
        vendorProfile: true,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Account created successfully.",

      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,

        campus: user.campus,
        phone: user.phone,
        bio: user.bio,

        vendorProfile:
          user.vendorProfile,

        createdAt:
          user.createdAt,
      },
    });
  } catch (error) {
    console.error(
      "Registration error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Something went wrong while creating the account.",
    });
  }
};

export const login = async (
  req: Request,
  res: Response
) => {
  try {
    const {
      email,
      password,
    } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message:
          "Email and password are required.",
      });
    }

    const cleanEmail = String(email)
      .trim()
      .toLowerCase();

    const user =
      await prisma.user.findUnique({
        where: {
          email: cleanEmail,
        },

        include: {
          vendorProfile: true,
        },
      });

    if (!user) {
      return res.status(401).json({
        success: false,
        message:
          "Invalid email or password.",
      });
    }

    const passwordMatches =
      await bcrypt.compare(
        password,
        user.passwordHash
      );

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message:
          "Invalid email or password.",
      });
    }

    const jwtSecret =
      process.env.JWT_SECRET;

    if (!jwtSecret) {
      throw new Error(
        "JWT_SECRET is not set"
      );
    }

    const token = jwt.sign(
      {
        userId: user.id,
        role: user.role,
      },
      jwtSecret,
      {
        expiresIn: "7d",
      }
    );

    return res.status(200).json({
      success: true,
      message: "Login successful.",

      token,

      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,

        campus: user.campus,
        phone: user.phone,
        bio: user.bio,

        vendorProfile:
          user.vendorProfile,

        createdAt:
          user.createdAt,
      },
    });
  } catch (error) {
    console.error(
      "Login error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Something went wrong while logging in.",
    });
  }
};

export const getMe = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message:
          "Authentication required.",
      });
    }

    const user =
      await prisma.user.findUnique({
        where: {
          id: req.user.id,
        },

        include: {
          vendorProfile: true,
        },
      });

    if (!user) {
      return res.status(404).json({
        success: false,
        message:
          "User account not found.",
      });
    }

    return res.status(200).json({
      success: true,

      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,

        campus: user.campus,
        phone: user.phone,
        bio: user.bio,

        vendorProfile:
          user.vendorProfile,

        createdAt:
          user.createdAt,
      },
    });
  } catch (error) {
    console.error(
      "Get current user error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to load account.",
    });
  }
};