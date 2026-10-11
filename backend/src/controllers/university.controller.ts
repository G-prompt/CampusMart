import { Request, Response } from "express";

import type { AuthenticatedAdminRequest } from "../middleware/adminAuth.middleware";

import {
  UniversityVerificationMethod,
  UniversityVerificationSourceType,
} from "../generated/prisma/client";

import { prisma } from "../lib/prisma";

function cleanRequiredText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function cleanOptionalText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const cleaned = value.trim();

  return cleaned.length > 0 ? cleaned : null;
}

function createSlug(value: string): string {
  return value
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

function isVerificationMethod(
  value: unknown
): value is UniversityVerificationMethod {
  return Object.values(UniversityVerificationMethod).includes(
    value as UniversityVerificationMethod
  );
}

function isVerificationSource(
  value: unknown
): value is UniversityVerificationSourceType {
  return Object.values(UniversityVerificationSourceType).includes(
    value as UniversityVerificationSourceType
  );
}

function validateMatricPattern(pattern: string): boolean {
  try {
    /*
     * Match the same behaviour used by the
     * student-side matric validation.
     */
    new RegExp(`^(?:${pattern})$`);

    return true;
  } catch {
    return false;
  }
}

type VerificationConfiguration = {
  primaryVerificationSource: UniversityVerificationSourceType;

  fallbackVerificationSource: UniversityVerificationSourceType;

  manualReviewEnabled: boolean;
};

function disabledVerificationConfiguration(): VerificationConfiguration {
  return {
    primaryVerificationSource: UniversityVerificationSourceType.none,

    fallbackVerificationSource: UniversityVerificationSourceType.none,

    manualReviewEnabled: false,
  };
}

/*
 * -------------------------------------------------------
 * LEGACY COMPATIBILITY
 * -------------------------------------------------------
 *
 * CampusMart previously stored one verificationMethod:
 *
 * none
 * manual
 * database
 * api
 *
 * During the migration period we still accept that field
 * from the existing Admin frontend.
 *
 * It is translated into the new architecture here.
 */
function configurationFromLegacyMethod(
  method: UniversityVerificationMethod
): VerificationConfiguration {
  switch (method) {
    case UniversityVerificationMethod.manual:
      return {
        primaryVerificationSource: UniversityVerificationSourceType.none,

        fallbackVerificationSource: UniversityVerificationSourceType.none,

        manualReviewEnabled: true,
      };

    case UniversityVerificationMethod.api:
      return {
        primaryVerificationSource:
          UniversityVerificationSourceType.university_api,

        fallbackVerificationSource: UniversityVerificationSourceType.none,

        manualReviewEnabled: false,
      };

    case UniversityVerificationMethod.database:
      return {
        primaryVerificationSource:
          UniversityVerificationSourceType.university_database,

        fallbackVerificationSource: UniversityVerificationSourceType.none,

        manualReviewEnabled: false,
      };

    case UniversityVerificationMethod.none:
    default:
      return disabledVerificationConfiguration();
  }
}

/*
 * Keep the legacy database field synchronized while the
 * current customer/frontend code still expects it.
 *
 * roster_import deliberately has no old equivalent.
 */
function legacyMethodFromConfiguration(
  configuration: VerificationConfiguration
): UniversityVerificationMethod {
  if (
    configuration.primaryVerificationSource ===
      UniversityVerificationSourceType.university_api ||
    configuration.fallbackVerificationSource ===
      UniversityVerificationSourceType.university_api
  ) {
    return UniversityVerificationMethod.api;
  }

  if (
    configuration.primaryVerificationSource ===
      UniversityVerificationSourceType.university_database ||
    configuration.fallbackVerificationSource ===
      UniversityVerificationSourceType.university_database
  ) {
    return UniversityVerificationMethod.database;
  }

  if (configuration.manualReviewEnabled) {
    return UniversityVerificationMethod.manual;
  }

  return UniversityVerificationMethod.none;
}

function hasNewVerificationConfiguration(
  body: Record<string, unknown>
): boolean {
  return (
    body.primaryVerificationSource !== undefined ||
    body.fallbackVerificationSource !== undefined ||
    body.manualReviewEnabled !== undefined
  );
}

/*
 * -------------------------------------------------------
 * SOURCE-AWARE CONFIGURATION VALIDATION
 * -------------------------------------------------------
 */
function validateVerificationConfiguration(
  studentVerificationEnabled: boolean,
  configuration: VerificationConfiguration
): {
  code: string;

  message: string;
} | null {
  if (!studentVerificationEnabled) {
    return null;
  }

  const hasPrimary =
    configuration.primaryVerificationSource !==
    UniversityVerificationSourceType.none;

  const hasFallback =
    configuration.fallbackVerificationSource !==
    UniversityVerificationSourceType.none;

  /*
   * A fallback source makes no sense without a primary
   * source to fall back from.
   */
  if (hasFallback && !hasPrimary) {
    return {
      code: "FALLBACK_SOURCE_REQUIRES_PRIMARY",

      message:
        "Choose a primary verification source before configuring a fallback source.",
    };
  }

  /*
   * Do not configure the same source twice.
   */
  if (
    hasPrimary &&
    configuration.primaryVerificationSource ===
      configuration.fallbackVerificationSource
  ) {
    return {
      code: "DUPLICATE_VERIFICATION_SOURCE",

      message: "Primary and fallback verification sources must be different.",
    };
  }

  /*
   * If student verification is enabled, CampusMart needs
   * at least one real verification path.
   */
  if (!hasPrimary && !hasFallback && !configuration.manualReviewEnabled) {
    return {
      code: "VERIFICATION_PATH_REQUIRED",

      message:
        "Enable manual review or configure an available automated verification source before enabling student verification.",
    };
  }

  /*
   * IMPORTANT:
   *
   * We have created the source-aware architecture, but we
   * do NOT yet have a confirmed working:
   *
   * - university API integration
   * - direct university database integration
   * - roster-import verification engine
   *
   * Therefore those sources may exist in the schema and UI,
   * but must not be activated yet.
   *
   * We will relax this rule source-by-source as each real
   * provider becomes operational.
   */
  if (hasPrimary || hasFallback) {
    return {
      code: "AUTOMATED_VERIFICATION_SOURCE_NOT_READY",

      message:
        "Automated university verification cannot be enabled until the selected source has a real configured and tested integration.",
    };
  }

  return null;
}

/*
 * Parses the new fields from an Admin request while
 * preserving unchanged existing values.
 */
function readNewVerificationConfiguration(
  body: Record<string, unknown>,

  current: VerificationConfiguration
): {
  configuration?: VerificationConfiguration;

  error?: {
    code: string;

    message: string;
  };
} {
  if (
    body.primaryVerificationSource !== undefined &&
    !isVerificationSource(body.primaryVerificationSource)
  ) {
    return {
      error: {
        code: "INVALID_PRIMARY_VERIFICATION_SOURCE",

        message: "Select a valid primary verification source.",
      },
    };
  }

  if (
    body.fallbackVerificationSource !== undefined &&
    !isVerificationSource(body.fallbackVerificationSource)
  ) {
    return {
      error: {
        code: "INVALID_FALLBACK_VERIFICATION_SOURCE",

        message: "Select a valid fallback verification source.",
      },
    };
  }

  if (
    body.manualReviewEnabled !== undefined &&
    !isBoolean(body.manualReviewEnabled)
  ) {
    return {
      error: {
        code: "INVALID_MANUAL_REVIEW_STATE",

        message: "Manual review enabled state must be true or false.",
      },
    };
  }

  return {
    configuration: {
      primaryVerificationSource:
        body.primaryVerificationSource !== undefined
          ? body.primaryVerificationSource
          : current.primaryVerificationSource,

      fallbackVerificationSource:
        body.fallbackVerificationSource !== undefined
          ? body.fallbackVerificationSource
          : current.fallbackVerificationSource,

      manualReviewEnabled:
        body.manualReviewEnabled !== undefined
          ? body.manualReviewEnabled
          : current.manualReviewEnabled,
    },
  };
}

/*
 * -------------------------------------------------------
 * PUBLIC UNIVERSITY DIRECTORY
 * -------------------------------------------------------
 *
 * Used by signup and customer-facing CampusMart UI.
 *
 * IMPORTANT:
 *
 * Internal source configuration and matricPattern remain
 * private.
 *
 * verificationMethod remains temporarily because the
 * current signup/account frontend still understands it.
 */
export const getUniversities = async (req: Request, res: Response) => {
  try {
    const universities = await prisma.university.findMany({
      where: {
        active: true,
      },

      orderBy: [
        {
          state: "asc",
        },

        {
          name: "asc",
        },
      ],

      select: {
        id: true,

        name: true,

        shortName: true,

        slug: true,

        country: true,

        state: true,

        city: true,

        logoUrl: true,

        studentVerificationEnabled: true,

        verificationMethod: true,

        matricValidationEnabled: true,

        matricFormatHint: true,

        /*
         * Do NOT expose:
         *
         * matricPattern
         * primaryVerificationSource
         * fallbackVerificationSource
         *
         * through the public university directory.
         */
      },
    });

    return res.status(200).json({
      success: true,

      universities,
    });
  } catch (error) {
    console.error("Get universities error:", error);

    return res.status(500).json({
      success: false,

      message: "Unable to load universities.",
    });
  }
};

/*
 * -------------------------------------------------------
 * ADMIN UNIVERSITY DIRECTORY
 * -------------------------------------------------------
 */
export const getAdminUniversities = async (
  req: AuthenticatedAdminRequest,

  res: Response
) => {
  try {
    if (!req.admin) {
      return res.status(401).json({
        success: false,

        message: "Admin authentication required.",
      });
    }

    const universities = await prisma.university.findMany({
      orderBy: [
        {
          active: "desc",
        },

        {
          state: "asc",
        },

        {
          name: "asc",
        },
      ],

      select: {
        id: true,

        name: true,

        shortName: true,

        slug: true,

        country: true,

        state: true,

        city: true,

        logoUrl: true,

        active: true,

        studentVerificationEnabled: true,

        /*
         * Legacy field.
         */
        verificationMethod: true,

        /*
         * New source-aware architecture.
         */
        primaryVerificationSource: true,

        fallbackVerificationSource: true,

        manualReviewEnabled: true,

        matricValidationEnabled: true,

        matricPattern: true,

        matricFormatHint: true,

        createdAt: true,

        updatedAt: true,

        _count: {
          select: {
            users: true,
          },
        },
      },
    });

    return res.status(200).json({
      success: true,

      count: universities.length,

      universities: universities.map((university) => ({
        id: university.id,

        name: university.name,

        shortName: university.shortName,

        slug: university.slug,

        country: university.country,

        state: university.state,

        city: university.city,

        logoUrl: university.logoUrl,

        active: university.active,

        studentVerificationEnabled: university.studentVerificationEnabled,

        verificationMethod: university.verificationMethod,

        primaryVerificationSource: university.primaryVerificationSource,

        fallbackVerificationSource: university.fallbackVerificationSource,

        manualReviewEnabled: university.manualReviewEnabled,

        matricValidationEnabled: university.matricValidationEnabled,

        matricPattern: university.matricPattern,

        matricFormatHint: university.matricFormatHint,

        userCount: university._count.users,

        createdAt: university.createdAt,

        updatedAt: university.updatedAt,
      })),
    });
  } catch (error) {
    console.error("Get Admin universities error:", error);

    return res.status(500).json({
      success: false,

      message: "Unable to load university management data.",
    });
  }
};

/*
 * -------------------------------------------------------
 * ADMIN UNIVERSITY DETAIL
 * -------------------------------------------------------
 */
export const getAdminUniversityById = async (
  req: AuthenticatedAdminRequest,

  res: Response
) => {
  try {
    if (!req.admin) {
      return res.status(401).json({
        success: false,

        message: "Admin authentication required.",
      });
    }

    const universityId = String(req.params.universityId || "").trim();

    if (!universityId) {
      return res.status(400).json({
        success: false,

        code: "UNIVERSITY_ID_REQUIRED",

        message: "University ID is required.",
      });
    }

    const university = await prisma.university.findUnique({
      where: {
        id: universityId,
      },

      select: {
        id: true,

        name: true,

        shortName: true,

        slug: true,

        country: true,

        state: true,

        city: true,

        logoUrl: true,

        active: true,

        studentVerificationEnabled: true,

        verificationMethod: true,

        primaryVerificationSource: true,

        fallbackVerificationSource: true,

        manualReviewEnabled: true,

        matricValidationEnabled: true,

        matricPattern: true,

        matricFormatHint: true,

        createdAt: true,

        updatedAt: true,

        _count: {
          select: {
            users: true,
          },
        },
      },
    });

    if (!university) {
      return res.status(404).json({
        success: false,

        code: "UNIVERSITY_NOT_FOUND",

        message: "University not found.",
      });
    }

    return res.status(200).json({
      success: true,

      university: {
        id: university.id,

        name: university.name,

        shortName: university.shortName,

        slug: university.slug,

        country: university.country,

        state: university.state,

        city: university.city,

        logoUrl: university.logoUrl,

        active: university.active,

        studentVerificationEnabled: university.studentVerificationEnabled,

        verificationMethod: university.verificationMethod,

        primaryVerificationSource: university.primaryVerificationSource,

        fallbackVerificationSource: university.fallbackVerificationSource,

        manualReviewEnabled: university.manualReviewEnabled,

        matricValidationEnabled: university.matricValidationEnabled,

        matricPattern: university.matricPattern,

        matricFormatHint: university.matricFormatHint,

        userCount: university._count.users,

        createdAt: university.createdAt,

        updatedAt: university.updatedAt,
      },
    });
  } catch (error) {
    console.error("Get Admin university error:", error);

    return res.status(500).json({
      success: false,

      message: "Unable to load this university.",
    });
  }
};

/*
 * -------------------------------------------------------
 * CREATE UNIVERSITY
 * -------------------------------------------------------
 */
export const createUniversity = async (
  req: AuthenticatedAdminRequest,

  res: Response
) => {
  try {
    if (!req.admin) {
      return res.status(401).json({
        success: false,

        message: "Admin authentication required.",
      });
    }

    /*
     * ---------------------------------------------------
     * BASIC UNIVERSITY INFORMATION
     * ---------------------------------------------------
     */

    const name = cleanRequiredText(req.body.name);

    const shortName = cleanRequiredText(req.body.shortName).toUpperCase();

    const country = cleanRequiredText(req.body.country) || "Nigeria";

    const state = cleanRequiredText(req.body.state);

    const city = cleanRequiredText(req.body.city);

    const logoUrl = cleanOptionalText(req.body.logoUrl);

    const suppliedSlug = cleanOptionalText(req.body.slug);

    const slug = createSlug(suppliedSlug || name);

    if (!name || !shortName || !state || !city) {
      return res.status(400).json({
        success: false,

        code: "UNIVERSITY_DETAILS_REQUIRED",

        message: "University name, short name, state, and city are required.",
      });
    }

    if (!slug) {
      return res.status(400).json({
        success: false,

        code: "INVALID_UNIVERSITY_SLUG",

        message: "A valid university slug could not be created.",
      });
    }

    /*
     * ---------------------------------------------------
     * UNIVERSITY ACTIVE STATE
     * ---------------------------------------------------
     */

    const active =
      req.body.active !== undefined
        ? isBoolean(req.body.active)
          ? req.body.active
          : null
        : true;

    if (active === null) {
      return res.status(400).json({
        success: false,

        code: "INVALID_ACTIVE_STATE",

        message: "University active state must be true or false.",
      });
    }

    /*
     * ---------------------------------------------------
     * STUDENT VERIFICATION
     * ---------------------------------------------------
     */

    const studentVerificationEnabled =
      req.body.studentVerificationEnabled !== undefined
        ? isBoolean(req.body.studentVerificationEnabled)
          ? req.body.studentVerificationEnabled
          : null
        : false;

    if (studentVerificationEnabled === null) {
      return res.status(400).json({
        success: false,

        code: "INVALID_VERIFICATION_STATE",

        message: "Student verification enabled state must be true or false.",
      });
    }

    let verificationConfiguration = disabledVerificationConfiguration();

    /*
     * Prefer the new source-aware fields whenever they are
     * supplied.
     *
     * Otherwise accept verificationMethod temporarily for
     * the existing frontend.
     */
    if (hasNewVerificationConfiguration(req.body)) {
      const parsed = readNewVerificationConfiguration(
        req.body,

        disabledVerificationConfiguration()
      );

      if (parsed.error) {
        return res.status(400).json({
          success: false,

          ...parsed.error,
        });
      }

      verificationConfiguration = parsed.configuration!;
    } else if (req.body.verificationMethod !== undefined) {
      if (!isVerificationMethod(req.body.verificationMethod)) {
        return res.status(400).json({
          success: false,

          code: "INVALID_VERIFICATION_METHOD",

          message: "Select a valid university verification method.",
        });
      }

      verificationConfiguration = configurationFromLegacyMethod(
        req.body.verificationMethod
      );
    }

    /*
     * Disabled student verification means all verification
     * paths are disabled too.
     */
    if (!studentVerificationEnabled) {
      verificationConfiguration = disabledVerificationConfiguration();
    }

    const verificationError = validateVerificationConfiguration(
      studentVerificationEnabled,

      verificationConfiguration
    );

    if (verificationError) {
      return res.status(400).json({
        success: false,

        ...verificationError,
      });
    }

    /*
     * Keep the old field synchronized until we completely
     * remove it later.
     */
    const verificationMethod = legacyMethodFromConfiguration(
      verificationConfiguration
    );

    /*
     * ---------------------------------------------------
     * MATRIC FORMAT VALIDATION
     * ---------------------------------------------------
     */

    const matricValidationEnabled =
      req.body.matricValidationEnabled !== undefined
        ? isBoolean(req.body.matricValidationEnabled)
          ? req.body.matricValidationEnabled
          : null
        : false;

    if (matricValidationEnabled === null) {
      return res.status(400).json({
        success: false,

        code: "INVALID_MATRIC_VALIDATION_STATE",

        message: "Matric validation enabled state must be true or false.",
      });
    }

    const matricPattern = cleanOptionalText(req.body.matricPattern);

    const matricFormatHint = cleanOptionalText(req.body.matricFormatHint);

    if (matricValidationEnabled && !matricPattern) {
      return res.status(400).json({
        success: false,

        code: "MATRIC_PATTERN_REQUIRED",

        message:
          "A matric validation pattern is required when matric validation is enabled.",
      });
    }

    if (matricPattern && !validateMatricPattern(matricPattern)) {
      return res.status(400).json({
        success: false,

        code: "INVALID_MATRIC_PATTERN",

        message: "The matric validation pattern is not a valid regular expression.",
      });
    }

    /*
     * ---------------------------------------------------
     * DUPLICATE SLUG
     * ---------------------------------------------------
     */

    const existingSlug = await prisma.university.findUnique({
      where: {
        slug,
      },

      select: {
        id: true,
      },
    });

    if (existingSlug) {
      return res.status(409).json({
        success: false,

        code: "UNIVERSITY_SLUG_EXISTS",

        message: "A university with this slug already exists.",
      });
    }

    /*
     * ---------------------------------------------------
     * CREATE
     * ---------------------------------------------------
     */

    const university = await prisma.university.create({
      data: {
        name,

        shortName,

        slug,

        country,

        state,

        city,

        logoUrl,

        active,

        studentVerificationEnabled,

        verificationMethod,

        primaryVerificationSource:
          verificationConfiguration.primaryVerificationSource,

        fallbackVerificationSource:
          verificationConfiguration.fallbackVerificationSource,

        manualReviewEnabled: verificationConfiguration.manualReviewEnabled,

        matricValidationEnabled,

        matricPattern: matricValidationEnabled ? matricPattern : null,

        matricFormatHint: matricValidationEnabled ? matricFormatHint : null,
      },

      select: {
        id: true,

        name: true,

        shortName: true,

        slug: true,

        country: true,

        state: true,

        city: true,

        logoUrl: true,

        active: true,

        studentVerificationEnabled: true,

        verificationMethod: true,

        primaryVerificationSource: true,

        fallbackVerificationSource: true,

        manualReviewEnabled: true,

        matricValidationEnabled: true,

        matricPattern: true,

        matricFormatHint: true,

        createdAt: true,

        updatedAt: true,
      },
    });

    return res.status(201).json({
      success: true,

      message: "University created successfully.",

      university,
    });
  } catch (error) {
    console.error("Create university error:", error);

    return res.status(500).json({
      success: false,

      message: "Unable to create this university.",
    });
  }
};

/*
 * -------------------------------------------------------
 * UPDATE UNIVERSITY
 * -------------------------------------------------------
 */
export const updateUniversity = async (
  req: AuthenticatedAdminRequest,

  res: Response
) => {
  try {
    if (!req.admin) {
      return res.status(401).json({
        success: false,

        message: "Admin authentication required.",
      });
    }

    const universityId = String(req.params.universityId || "").trim();

    if (!universityId) {
      return res.status(400).json({
        success: false,

        code: "UNIVERSITY_ID_REQUIRED",

        message: "University ID is required.",
      });
    }

    const existing = await prisma.university.findUnique({
      where: {
        id: universityId,
      },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,

        code: "UNIVERSITY_NOT_FOUND",

        message: "University not found.",
      });
    }

    /*
     * ---------------------------------------------------
     * BASIC UNIVERSITY INFORMATION
     * ---------------------------------------------------
     */

    const name =
      req.body.name !== undefined
        ? cleanRequiredText(req.body.name)
        : existing.name;

    const shortName =
      req.body.shortName !== undefined
        ? cleanRequiredText(req.body.shortName).toUpperCase()
        : existing.shortName;

    const country =
      req.body.country !== undefined
        ? cleanRequiredText(req.body.country)
        : existing.country;

    const state =
      req.body.state !== undefined
        ? cleanRequiredText(req.body.state)
        : existing.state;

    const city =
      req.body.city !== undefined
        ? cleanRequiredText(req.body.city)
        : existing.city;

    if (!name || !shortName || !country || !state || !city) {
      return res.status(400).json({
        success: false,

        code: "UNIVERSITY_DETAILS_REQUIRED",

        message:
          "University name, short name, country, state, and city cannot be empty.",
      });
    }

    const logoUrl =
      req.body.logoUrl !== undefined
        ? cleanOptionalText(req.body.logoUrl)
        : existing.logoUrl;

    /*
     * ---------------------------------------------------
     * ACTIVE STATE
     * ---------------------------------------------------
     */

    const active =
      req.body.active !== undefined
        ? isBoolean(req.body.active)
          ? req.body.active
          : null
        : existing.active;

    if (active === null) {
      return res.status(400).json({
        success: false,

        code: "INVALID_ACTIVE_STATE",

        message: "University active state must be true or false.",
      });
    }

    /*
     * ---------------------------------------------------
     * SLUG
     * ---------------------------------------------------
     */

    let slug = existing.slug;

    if (req.body.slug !== undefined) {
      slug = createSlug(cleanRequiredText(req.body.slug));

      if (!slug) {
        return res.status(400).json({
          success: false,

          code: "INVALID_UNIVERSITY_SLUG",

          message: "Enter a valid university slug.",
        });
      }
    }

    if (slug !== existing.slug) {
      const duplicateSlug = await prisma.university.findFirst({
        where: {
          slug,

          id: {
            not: existing.id,
          },
        },

        select: {
          id: true,
        },
      });

      if (duplicateSlug) {
        return res.status(409).json({
          success: false,

          code: "UNIVERSITY_SLUG_EXISTS",

          message: "Another university already uses this slug.",
        });
      }
    }

    /*
     * ---------------------------------------------------
     * STUDENT VERIFICATION ENABLED
     * ---------------------------------------------------
     */

    const studentVerificationEnabled =
      req.body.studentVerificationEnabled !== undefined
        ? isBoolean(req.body.studentVerificationEnabled)
          ? req.body.studentVerificationEnabled
          : null
        : existing.studentVerificationEnabled;

    if (studentVerificationEnabled === null) {
      return res.status(400).json({
        success: false,

        code: "INVALID_VERIFICATION_STATE",

        message: "Student verification enabled state must be true or false.",
      });
    }

    /*
     * Start with the university's current source-aware
     * configuration.
     */
    let verificationConfiguration: VerificationConfiguration = {
      primaryVerificationSource: existing.primaryVerificationSource,

      fallbackVerificationSource: existing.fallbackVerificationSource,

      manualReviewEnabled: existing.manualReviewEnabled,
    };

    /*
     * New source-aware request takes priority.
     */
    if (hasNewVerificationConfiguration(req.body)) {
      const parsed = readNewVerificationConfiguration(
        req.body,

        verificationConfiguration
      );

      if (parsed.error) {
        return res.status(400).json({
          success: false,

          ...parsed.error,
        });
      }

      verificationConfiguration = parsed.configuration!;
    } else if (req.body.verificationMethod !== undefined) {
      /*
       * Existing Admin frontend compatibility.
       */
      if (!isVerificationMethod(req.body.verificationMethod)) {
        return res.status(400).json({
          success: false,

          code: "INVALID_VERIFICATION_METHOD",

          message: "Select a valid university verification method.",
        });
      }

      verificationConfiguration = configurationFromLegacyMethod(
        req.body.verificationMethod
      );
    }

    /*
     * Turning student verification off clears every
     * verification path.
     */
    if (!studentVerificationEnabled) {
      verificationConfiguration = disabledVerificationConfiguration();
    }

    const verificationError = validateVerificationConfiguration(
      studentVerificationEnabled,

      verificationConfiguration
    );

    if (verificationError) {
      return res.status(400).json({
        success: false,

        ...verificationError,
      });
    }

    const verificationMethod = legacyMethodFromConfiguration(
      verificationConfiguration
    );

    /*
     * ---------------------------------------------------
     * MATRIC VALIDATION
     * ---------------------------------------------------
     */

    const matricValidationEnabled =
      req.body.matricValidationEnabled !== undefined
        ? isBoolean(req.body.matricValidationEnabled)
          ? req.body.matricValidationEnabled
          : null
        : existing.matricValidationEnabled;

    if (matricValidationEnabled === null) {
      return res.status(400).json({
        success: false,

        code: "INVALID_MATRIC_VALIDATION_STATE",

        message: "Matric validation enabled state must be true or false.",
      });
    }

    const matricPattern =
      req.body.matricPattern !== undefined
        ? cleanOptionalText(req.body.matricPattern)
        : existing.matricPattern;

    const matricFormatHint =
      req.body.matricFormatHint !== undefined
        ? cleanOptionalText(req.body.matricFormatHint)
        : existing.matricFormatHint;

    if (matricValidationEnabled && !matricPattern) {
      return res.status(400).json({
        success: false,

        code: "MATRIC_PATTERN_REQUIRED",

        message:
          "A matric validation pattern is required when matric validation is enabled.",
      });
    }

    if (matricPattern && !validateMatricPattern(matricPattern)) {
      return res.status(400).json({
        success: false,

        code: "INVALID_MATRIC_PATTERN",

        message: "The matric validation pattern is not a valid regular expression.",
      });
    }

    /*
     * ---------------------------------------------------
     * UPDATE
     * ---------------------------------------------------
     */

    const university = await prisma.university.update({
      where: {
        id: existing.id,
      },

      data: {
        name,

        shortName,

        slug,

        country,

        state,

        city,

        logoUrl,

        active,

        studentVerificationEnabled,

        /*
         * Legacy compatibility.
         */
        verificationMethod,

        /*
         * New source-aware architecture.
         */
        primaryVerificationSource:
          verificationConfiguration.primaryVerificationSource,

        fallbackVerificationSource:
          verificationConfiguration.fallbackVerificationSource,

        manualReviewEnabled: verificationConfiguration.manualReviewEnabled,

        matricValidationEnabled,

        matricPattern: matricValidationEnabled ? matricPattern : null,

        matricFormatHint: matricValidationEnabled ? matricFormatHint : null,
      },

      select: {
        id: true,

        name: true,

        shortName: true,

        slug: true,

        country: true,

        state: true,

        city: true,

        logoUrl: true,

        active: true,

        studentVerificationEnabled: true,

        verificationMethod: true,

        primaryVerificationSource: true,

        fallbackVerificationSource: true,

        manualReviewEnabled: true,

        matricValidationEnabled: true,

        matricPattern: true,

        matricFormatHint: true,

        createdAt: true,

        updatedAt: true,

        _count: {
          select: {
            users: true,
          },
        },
      },
    });

    return res.status(200).json({
      success: true,

      message: "University updated successfully.",

      university: {
        id: university.id,

        name: university.name,

        shortName: university.shortName,

        slug: university.slug,

        country: university.country,

        state: university.state,

        city: university.city,

        logoUrl: university.logoUrl,

        active: university.active,

        studentVerificationEnabled: university.studentVerificationEnabled,

        verificationMethod: university.verificationMethod,

        primaryVerificationSource: university.primaryVerificationSource,

        fallbackVerificationSource: university.fallbackVerificationSource,

        manualReviewEnabled: university.manualReviewEnabled,

        matricValidationEnabled: university.matricValidationEnabled,

        matricPattern: university.matricPattern,

        matricFormatHint: university.matricFormatHint,

        userCount: university._count.users,

        createdAt: university.createdAt,

        updatedAt: university.updatedAt,
      },
    });
  } catch (error) {
    console.error("Update university error:", error);

    return res.status(500).json({
      success: false,

      message: "Unable to update this university.",
    });
  }
};

/*
 * -------------------------------------------------------
 * ACTIVATE / DEACTIVATE UNIVERSITY
 * -------------------------------------------------------
 *
 * Universities are deliberately not hard-deleted.
 */
export const setUniversityActiveState = async (
  req: AuthenticatedAdminRequest,

  res: Response
) => {
  try {
    if (!req.admin) {
      return res.status(401).json({
        success: false,

        message: "Admin authentication required.",
      });
    }

    const universityId = String(req.params.universityId || "").trim();

    if (!universityId) {
      return res.status(400).json({
        success: false,

        code: "UNIVERSITY_ID_REQUIRED",

        message: "University ID is required.",
      });
    }

    if (!isBoolean(req.body.active)) {
      return res.status(400).json({
        success: false,

        code: "ACTIVE_STATE_REQUIRED",

        message: "Provide the university active state as true or false.",
      });
    }

    const existing = await prisma.university.findUnique({
      where: {
        id: universityId,
      },

      select: {
        id: true,

        name: true,

        active: true,
      },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,

        code: "UNIVERSITY_NOT_FOUND",

        message: "University not found.",
      });
    }

    /*
     * Repeating the same state is harmless.
     */
    if (existing.active === req.body.active) {
      return res.status(200).json({
        success: true,

        message: existing.active
          ? "This university is already active."
          : "This university is already inactive.",

        university: existing,
      });
    }

    const university = await prisma.university.update({
      where: {
        id: universityId,
      },

      data: {
        active: req.body.active,
      },

      select: {
        id: true,

        name: true,

        shortName: true,

        slug: true,

        active: true,

        updatedAt: true,
      },
    });

    return res.status(200).json({
      success: true,

      message: university.active
        ? "University activated successfully."
        : "University deactivated successfully.",

      university,
    });
  } catch (error) {
    console.error("Set university active state error:", error);

    return res.status(500).json({
      success: false,

      message: "Unable to update the university status.",
    });
  }
};