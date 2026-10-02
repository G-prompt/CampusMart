import { Request, Response } from "express";

import { prisma } from "../lib/prisma";

export const getUniversities = async (
  req: Request,
  res: Response
) => {
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

        // IMPORTANT:
        // matricPattern is deliberately NOT returned.
        // The real validation rule stays on the backend.
      },
    });

    return res.status(200).json({
      success: true,
      universities,
    });
  } catch (error) {
    console.error(
      "Get universities error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to load universities.",
    });
  }
};