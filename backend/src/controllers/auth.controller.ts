import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import type { AuthenticatedRequest } from "../middleware/auth.middleware";

import { prisma } from "../lib/prisma";

import {
  StudentVerificationSource,
  StudentVerificationStatus,
  UserRole,
  VendorAccessStatus,
  VerificationAppealStatus,
} from "../generated/prisma/client";

import {
  normalizeMatricNumber,
  validateMatricNumber,
} from "../lib/studentVerification";

function cleanOptionalText(
  value: unknown
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const cleaned = value.trim();

  return cleaned.length > 0
    ? cleaned
    : null;
}

function cleanRequiredText(
  value: unknown
): string {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function buildPublicUser(
  user: any
) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,

    campus:
      user.campus,

    phone:
      user.phone,

    bio:
      user.bio,

    universityId:
      user.universityId,

    university:
      user.university
        ? {
            id:
              user.university.id,

            name:
              user.university.name,

            shortName:
              user.university.shortName,

            slug:
              user.university.slug,

            country:
              user.university.country,

            state:
              user.university.state,

            city:
              user.university.city,

            studentVerificationEnabled:
              user.university
                .studentVerificationEnabled,

            verificationMethod:
              user.university
                .verificationMethod,

            matricValidationEnabled:
              user.university
                .matricValidationEnabled,

            matricFormatHint:
              user.university
                .matricFormatHint,
          }
        : null,

    matricNumber:
      user.matricNumber,

    studentVerificationStatus:
      user.studentVerificationStatus,

    studentVerificationSource:
      user.studentVerificationSource,

    studentVerifiedAt:
      user.studentVerifiedAt,

    fallbackUniversityName:
      user.fallbackUniversityName,

    fallbackState:
      user.fallbackState,

    fallbackCity:
      user.fallbackCity,

    vendorProfile:
      user.vendorProfile,

    createdAt:
      user.createdAt,
  };
}

const userInclude = {
  university: {
    select: {
      id: true,
      name: true,
      shortName: true,
      slug: true,
      country: true,
      state: true,
      city: true,

      studentVerificationEnabled: true,

      verificationMethod: true,

      matricValidationEnabled: true,

      matricFormatHint: true,
    },
  },

  vendorProfile: true,
} as const;

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

      phone,
      bio,

      universityId,
      matricNumber,

      fallbackUniversityName,
      fallbackState,
      fallbackCity,

      businessName,
      businessDescription,
      pickupLocation,
    } = req.body;

    const cleanName =
      cleanRequiredText(
        name
      );

    const cleanEmail =
      cleanRequiredText(
        email
      ).toLowerCase();

    const cleanPhone =
      cleanOptionalText(
        phone
      );

    const cleanBio =
      cleanOptionalText(
        bio
      );

    const cleanUniversityId =
      cleanOptionalText(
        universityId
      );

    const cleanFallbackUniversityName =
      cleanOptionalText(
        fallbackUniversityName
      );

    const cleanFallbackState =
      cleanOptionalText(
        fallbackState
      );

    const cleanFallbackCity =
      cleanOptionalText(
        fallbackCity
      );

    const cleanMatricNumber =
      cleanOptionalText(
        matricNumber
      );

    if (
      !cleanName ||
      !cleanEmail ||
      !password
    ) {
      return res
        .status(400)
        .json({
          success: false,

          message:
            "Name, email and password are required.",
        });
    }

    if (
      cleanName.length < 2
    ) {
      return res
        .status(400)
        .json({
          success: false,

          message:
            "Please enter your full name.",
        });
    }

    if (
      !cleanEmail.includes("@")
    ) {
      return res
        .status(400)
        .json({
          success: false,

          message:
            "Please enter a valid email address.",
        });
    }

    if (
      typeof password !==
        "string" ||
      password.length < 8
    ) {
      return res
        .status(400)
        .json({
          success: false,

          message:
            "Password must be at least 8 characters long.",
        });
    }

    if (
      ![
        "client",
        "vendor",
      ].includes(
        String(role)
      )
    ) {
      return res
        .status(400)
        .json({
          success: false,

          message:
            "Invalid account role.",
        });
    }

    const userRole =
      role === "vendor"
        ? UserRole.vendor
        : UserRole.client;

    const selectedOther =
      !cleanUniversityId ||
      cleanUniversityId
        .toLowerCase() ===
        "other";

    let university:
      | {
          id: string;
          name: string;
          shortName: string;
          slug: string;

          country: string;
          state: string;
          city: string;

          studentVerificationEnabled:
            boolean;

          verificationMethod:
            | "none"
            | "manual"
            | "database"
            | "api";

          matricValidationEnabled:
            boolean;

          matricPattern:
            string | null;

          matricFormatHint:
            string | null;
        }
      | null = null;

    if (!selectedOther) {
      university =
        await prisma.university.findFirst({
          where: {
            id:
              cleanUniversityId!,

            active: true,
          },

          select: {
            id: true,
            name: true,
            shortName: true,
            slug: true,

            country: true,
            state: true,
            city: true,

            studentVerificationEnabled:
              true,

            verificationMethod:
              true,

            matricValidationEnabled:
              true,

            matricPattern:
              true,

            matricFormatHint:
              true,
          },
        });

      if (!university) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "The selected university is not currently available on CampusMart.",
          });
      }
    }

    if (selectedOther) {
      if (
        !cleanFallbackUniversityName ||
        !cleanFallbackState ||
        !cleanFallbackCity
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Enter your university name, state and city or area.",
          });
      }
    }

    let normalizedMatricNumber:
      | string
      | null = null;

    if (
      university &&
      userRole ===
        UserRole.vendor &&
      !cleanMatricNumber
    ) {
      return res
        .status(400)
        .json({
          success:
            false,

          message: `Enter your ${university.shortName} matric number.`,

          code:
            "MATRIC_REQUIRED",

          matricFormatHint:
            university
              .matricFormatHint,
        });
    }

    if (
      university &&
      cleanMatricNumber
    ) {
      const matricResult =
        validateMatricNumber(
          cleanMatricNumber,
          university
        );

      if (
        !matricResult.valid
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              matricResult.message,

            code:
              matricResult.errorCode,

            matricFormatHint:
              matricResult.formatHint,
          });
      }

      normalizedMatricNumber =
        matricResult
          .normalizedMatricNumber;
    }

    if (
      selectedOther &&
      cleanMatricNumber
    ) {
      normalizedMatricNumber =
        normalizeMatricNumber(
          cleanMatricNumber
        );
    }

    const cleanBusinessName =
      cleanOptionalText(
        businessName
      );

    const cleanBusinessDescription =
      cleanOptionalText(
        businessDescription
      );

    const cleanPickupLocation =
      cleanOptionalText(
        pickupLocation
      );

    if (
      userRole ===
      UserRole.vendor
    ) {
      if (!cleanPhone) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Phone number is required for vendor accounts.",
          });
      }

      if (
        !cleanBusinessName
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Shop or business name is required.",
          });
      }

      if (
        !cleanBusinessDescription
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Please describe what you sell.",
          });
      }

      if (
        !cleanPickupLocation
      ) {
        return res
          .status(400)
          .json({
            success:
              false,

            message:
              "Pickup location is required.",
          });
      }
    }

    const existingUser =
      await prisma.user.findUnique({
        where: {
          email:
            cleanEmail,
        },
      });

    if (existingUser) {
      return res
        .status(409)
        .json({
          success: false,

          message:
            "An account with this email already exists.",
        });
    }

    if (
      university &&
      normalizedMatricNumber
    ) {
      const existingStudent =
        await prisma.user.findFirst({
          where: {
            universityId:
              university.id,

            matricNumber:
              normalizedMatricNumber,
          },

          select: {
            id: true,
          },
        });

      if (existingStudent) {
        return res
          .status(409)
          .json({
            success:
              false,

            message:
              "This student record is already associated with a CampusMart account. If you believe this is your record, contact support.",

            code:
              "STUDENT_RECORD_ALREADY_USED",
          });
      }
    }

    const legacyCampus =
      university
        ? university.name
        : cleanFallbackUniversityName!;

    const studentVerificationStatus =
      StudentVerificationStatus.not_started;

    const vendorAccessStatus =
      VendorAccessStatus.pending_review;

    const passwordHash =
      await bcrypt.hash(
        password,
        12
      );

    const user =
      await prisma.user.create({
        data: {
          name:
            cleanName,

          email:
            cleanEmail,

          passwordHash,

          role:
            userRole,

          campus:
            legacyCampus,

          phone:
            cleanPhone,

          bio:
            userRole ===
            UserRole.client
              ? cleanBio
              : null,

          university:
            university
              ? {
                  connect: {
                    id:
                      university.id,
                  },
                }
              : undefined,

          matricNumber:
            normalizedMatricNumber,

          studentVerificationStatus,

          fallbackUniversityName:
            university
              ? null
              : cleanFallbackUniversityName,

          fallbackState:
            university
              ? null
              : cleanFallbackState,

          fallbackCity:
            university
              ? null
              : cleanFallbackCity,

          vendorProfile:
            userRole ===
              UserRole.vendor &&
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

                    accessStatus:
                      vendorAccessStatus,
                  },
                }
              : undefined,
        },

        include:
          userInclude,
      });

    const registrationMessage =
      userRole ===
      UserRole.vendor
        ? university
          ? "Account created successfully. Your student details need to be verified before seller access is activated."
          : "Account created successfully. Your seller access is under review because your university is not currently listed."
        : "Account created successfully.";

    return res
      .status(201)
      .json({
        success: true,

        message:
          registrationMessage,

        user:
          buildPublicUser(
            user
          ),
      });
  } catch (error) {
    console.error(
      "Registration error:",
      error
    );

    return res
      .status(500)
      .json({
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

    if (
      !email ||
      !password
    ) {
      return res
        .status(400)
        .json({
          success: false,

          message:
            "Email and password are required.",
        });
    }

    const cleanEmail =
      String(email)
        .trim()
        .toLowerCase();

    const user =
      await prisma.user.findUnique({
        where: {
          email:
            cleanEmail,
        },

        include:
          userInclude,
      });

    if (!user) {
      return res
        .status(401)
        .json({
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

    if (
      !passwordMatches
    ) {
      return res
        .status(401)
        .json({
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

    const token =
      jwt.sign(
        {
          userId:
            user.id,

          role:
            user.role,
        },
        jwtSecret,
        {
          expiresIn:
            "7d",
        }
      );

    return res
      .status(200)
      .json({
        success: true,

        message:
          "Login successful.",

        token,

        user:
          buildPublicUser(
            user
          ),
      });
  } catch (error) {
    console.error(
      "Login error:",
      error
    );

    return res
      .status(500)
      .json({
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
      return res
        .status(401)
        .json({
          success: false,

          message:
            "Authentication required.",
        });
    }

    const user =
      await prisma.user.findUnique({
        where: {
          id:
            req.user.id,
        },

        include:
          userInclude,
      });

    if (!user) {
      return res
        .status(404)
        .json({
          success: false,

          message:
            "User account not found.",
        });
    }

    return res
      .status(200)
      .json({
        success: true,

        user:
          buildPublicUser(
            user
          ),
      });
  } catch (error) {
    console.error(
      "Get current user error:",
      error
    );

    return res
      .status(500)
      .json({
        success: false,

        message:
          "Unable to load account.",
      });
  }
};

export const updateStudentDetails =
  async (
    req: AuthenticatedRequest,
    res: Response
  ) => {
    try {
      if (!req.user) {
        return res
          .status(401)
          .json({
            success: false,

            message:
              "Authentication required.",
          });
      }

      const {
        universityId,
        matricNumber,

        fallbackUniversityName,
        fallbackState,
        fallbackCity,
      } = req.body;

      const cleanUniversityId =
        cleanOptionalText(
          universityId
        );

      const cleanMatricNumber =
        cleanOptionalText(
          matricNumber
        );

      const cleanFallbackUniversityName =
        cleanOptionalText(
          fallbackUniversityName
        );

      const cleanFallbackState =
        cleanOptionalText(
          fallbackState
        );

      const cleanFallbackCity =
        cleanOptionalText(
          fallbackCity
        );

      const currentUser =
        await prisma.user.findUnique({
          where: {
            id:
              req.user.id,
          },

          include: {
            vendorProfile:
              true,

            verificationAppeals: {
              where: {
                status: {
                  in: [
                    VerificationAppealStatus.pending,
                    VerificationAppealStatus.under_review,
                    VerificationAppealStatus.more_information_required,
                  ],
                },
              },

              select: {
                id: true,
                status: true,
              },

              take: 1,
            },
          },
        });

      if (!currentUser) {
        return res
          .status(404)
          .json({
            success: false,

            message:
              "User account not found.",
          });
      }

      /*
       * Once university identity has been
       * verified, it must not be casually
       * replaced through this endpoint.
       */
      if (
        currentUser
          .studentVerificationStatus ===
        StudentVerificationStatus.verified
      ) {
        return res
          .status(409)
          .json({
            success: false,

            message:
              "Your student identity is already verified. Contact support if your university details have changed.",

            code:
              "STUDENT_ALREADY_VERIFIED",
          });
      }

      /*
       * Do not let the user change the
       * identity data while an appeal is
       * actively being reviewed.
       */
      if (
        currentUser
          .verificationAppeals
          .length > 0
      ) {
        return res
          .status(409)
          .json({
            success: false,

            message:
              "Your university details cannot be changed while a verification appeal is open.",

            code:
              "VERIFICATION_APPEAL_OPEN",
          });
      }

      const selectedOther =
        !cleanUniversityId ||
        cleanUniversityId
          .toLowerCase() ===
          "other";

      let university:
        | {
            id: string;
            name: string;
            shortName: string;

            country: string;
            state: string;
            city: string;

            matricValidationEnabled:
              boolean;

            matricPattern:
              string | null;

            matricFormatHint:
              string | null;
          }
        | null = null;

      if (!selectedOther) {
        university =
          await prisma.university.findFirst({
            where: {
              id:
                cleanUniversityId!,

              active:
                true,
            },

            select: {
              id: true,
              name: true,
              shortName: true,

              country: true,
              state: true,
              city: true,

              matricValidationEnabled:
                true,

              matricPattern:
                true,

              matricFormatHint:
                true,
            },
          });

        if (!university) {
          return res
            .status(400)
            .json({
              success: false,

              message:
                "The selected university is not currently available on CampusMart.",

              code:
                "UNIVERSITY_NOT_AVAILABLE",
            });
        }
      }

      if (selectedOther) {
        if (
          !cleanFallbackUniversityName ||
          !cleanFallbackState ||
          !cleanFallbackCity
        ) {
          return res
            .status(400)
            .json({
              success: false,

              message:
                "Enter your university name, state and city or area.",

              code:
                "FALLBACK_UNIVERSITY_DETAILS_REQUIRED",
            });
        }
      }

      /*
       * Sellers at listed universities
       * must provide a matric number.
       *
       * Buyers may still leave it blank
       * until they choose to verify.
       */
      if (
        university &&
        currentUser.role ===
          UserRole.vendor &&
        !cleanMatricNumber
      ) {
        return res
          .status(400)
          .json({
            success: false,

            message: `Enter your ${university.shortName} matric number.`,

            code:
              "MATRIC_REQUIRED",

            matricFormatHint:
              university
                .matricFormatHint,
          });
      }

      let normalizedMatricNumber:
        | string
        | null = null;

      if (
        university &&
        cleanMatricNumber
      ) {
        const matricResult =
          validateMatricNumber(
            cleanMatricNumber,
            university
          );

        if (
          !matricResult.valid
        ) {
          return res
            .status(400)
            .json({
              success: false,

              message:
                matricResult.message,

              code:
                matricResult.errorCode,

              matricFormatHint:
                matricResult.formatHint,
            });
        }

        normalizedMatricNumber =
          matricResult
            .normalizedMatricNumber;
      }

      if (
        selectedOther &&
        cleanMatricNumber
      ) {
        normalizedMatricNumber =
          normalizeMatricNumber(
            cleanMatricNumber
          );
      }

      /*
       * Prevent one university student
       * record being connected to two
       * CampusMart accounts.
       */
      if (
        university &&
        normalizedMatricNumber
      ) {
        const duplicateStudent =
          await prisma.user.findFirst({
            where: {
              id: {
                not:
                  currentUser.id,
              },

              universityId:
                university.id,

              matricNumber:
                normalizedMatricNumber,
            },

            select: {
              id: true,
            },
          });

        if (duplicateStudent) {
          return res
            .status(409)
            .json({
              success: false,

              message:
                "This student record is already associated with a CampusMart account. If you believe this is your record, contact support.",

              code:
                "STUDENT_RECORD_ALREADY_USED",
            });
        }
      }

      const legacyCampus =
        university
          ? university.name
          : cleanFallbackUniversityName!;

      await prisma.$transaction(
        async (
          transaction
        ) => {
          await transaction.user.update({
            where: {
              id:
                currentUser.id,
            },

            data: {
              universityId:
                university
                  ? university.id
                  : null,

              matricNumber:
                normalizedMatricNumber,

              campus:
                legacyCampus,

              fallbackUniversityName:
                university
                  ? null
                  : cleanFallbackUniversityName,

              fallbackState:
                university
                  ? null
                  : cleanFallbackState,

              fallbackCity:
                university
                  ? null
                  : cleanFallbackCity,

              /*
               * Filling in identity data
               * does NOT verify it.
               */
              studentVerificationStatus:
                StudentVerificationStatus.not_started,

              studentVerificationSource:
                StudentVerificationSource.none,

              studentVerifiedAt:
                null,
            },
          });

          /*
           * Existing legacy vendors may
           * previously have been active.
           *
           * Once they join the new student
           * identity system they must be
           * verified before seller access
           * continues.
           */
          if (
            currentUser.role ===
              UserRole.vendor &&
            currentUser.vendorProfile
          ) {
            await transaction.vendorProfile.update({
              where: {
                userId:
                  currentUser.id,
              },

              data: {
                accessStatus:
                  VendorAccessStatus.pending_review,
              },
            });
          }
        }
      );

      const updatedUser =
        await prisma.user.findUnique({
          where: {
            id:
              currentUser.id,
          },

          include:
            userInclude,
        });

      if (!updatedUser) {
        return res
          .status(404)
          .json({
            success: false,

            message:
              "User account not found after updating student details.",
          });
      }

      return res
        .status(200)
        .json({
          success: true,

          message:
            currentUser.role ===
            UserRole.vendor
              ? "Your student details have been saved. Your seller access will remain pending until your student identity is verified."
              : "Your student details have been saved.",

          user:
            buildPublicUser(
              updatedUser
            ),
        });
    } catch (error) {
      console.error(
        "Update student details error:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,

          message:
            "Unable to update your student details.",
        });
    }
  };