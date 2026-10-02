import "dotenv/config";

import { prisma } from "../src/lib/prisma";

const universities = [
  {
    name: "Rivers State University",
    shortName: "RSU",
    slug: "rivers-state-university",
    country: "Nigeria",
    state: "Rivers",
    city: "Port Harcourt",
    active: true,
    studentVerificationEnabled: false,
    verificationMethod: "none" as const,
  },
  {
    name: "University of Port Harcourt",
    shortName: "UNIPORT",
    slug: "university-of-port-harcourt",
    country: "Nigeria",
    state: "Rivers",
    city: "Port Harcourt",
    active: true,
    studentVerificationEnabled: false,
    verificationMethod: "none" as const,
  },
  {
    name: "Ignatius Ajuru University of Education",
    shortName: "IAUE",
    slug: "ignatius-ajuru-university-of-education",
    country: "Nigeria",
    state: "Rivers",
    city: "Port Harcourt",
    active: true,
    studentVerificationEnabled: false,
    verificationMethod: "none" as const,
  },
  {
    name: "PAMO University of Medical Sciences",
    shortName: "PAMO",
    slug: "pamo-university-of-medical-sciences",
    country: "Nigeria",
    state: "Rivers",
    city: "Port Harcourt",
    active: true,
    studentVerificationEnabled: false,
    verificationMethod: "none" as const,
  },
  {
    name: "University of Uyo",
    shortName: "UNIUYO",
    slug: "university-of-uyo",
    country: "Nigeria",
    state: "Akwa Ibom",
    city: "Uyo",
    active: true,
    studentVerificationEnabled: false,
    verificationMethod: "none" as const,
  },
];

async function main() {
  for (const university of universities) {
    await prisma.university.upsert({
      where: {
        slug: university.slug,
      },
      update: {
        name: university.name,
        shortName: university.shortName,
        country: university.country,
        state: university.state,
        city: university.city,
        active: university.active,
        studentVerificationEnabled:
          university.studentVerificationEnabled,
        verificationMethod:
          university.verificationMethod,
      },
      create: university,
    });
  }

  console.log(
    `Seeded ${universities.length} universities.`
  );
}

main()
  .catch((error) => {
    console.error(
      "University seed failed:",
      error
    );

    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });