-- CreateEnum
CREATE TYPE "UniversityRosterImportStatus" AS ENUM ('processing', 'active', 'archived', 'failed');

-- CreateTable
CREATE TABLE "UniversityRosterImport" (
    "id" TEXT NOT NULL,
    "universityId" TEXT NOT NULL,
    "importedByAdminId" TEXT,
    "academicSession" TEXT NOT NULL,
    "sourceIssuer" TEXT NOT NULL,
    "sourceReference" TEXT,
    "originalFileName" TEXT NOT NULL,
    "fileSha256" TEXT,
    "status" "UniversityRosterImportStatus" NOT NULL DEFAULT 'processing',
    "validFrom" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "recordCount" INTEGER NOT NULL DEFAULT 0,
    "activeRecordCount" INTEGER NOT NULL DEFAULT 0,
    "inactiveRecordCount" INTEGER NOT NULL DEFAULT 0,
    "rejectedRowCount" INTEGER NOT NULL DEFAULT 0,
    "failureReason" TEXT,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activatedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UniversityRosterImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UniversityRosterRecord" (
    "id" TEXT NOT NULL,
    "rosterImportId" TEXT NOT NULL,
    "matricNumber" TEXT NOT NULL,
    "normalizedMatricNumber" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "normalizedFullName" TEXT NOT NULL,
    "studentStatus" TEXT NOT NULL,
    "isActiveStudent" BOOLEAN NOT NULL,
    "institutionalEmail" TEXT,
    "sourceRowNumber" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UniversityRosterRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UniversityRosterImport_universityId_idx" ON "UniversityRosterImport"("universityId");

-- CreateIndex
CREATE INDEX "UniversityRosterImport_universityId_status_idx" ON "UniversityRosterImport"("universityId", "status");

-- CreateIndex
CREATE INDEX "UniversityRosterImport_universityId_expiresAt_idx" ON "UniversityRosterImport"("universityId", "expiresAt");

-- CreateIndex
CREATE INDEX "UniversityRosterImport_importedByAdminId_idx" ON "UniversityRosterImport"("importedByAdminId");

-- CreateIndex
CREATE INDEX "UniversityRosterImport_status_idx" ON "UniversityRosterImport"("status");

-- CreateIndex
CREATE INDEX "UniversityRosterImport_importedAt_idx" ON "UniversityRosterImport"("importedAt");

-- CreateIndex
CREATE INDEX "UniversityRosterRecord_rosterImportId_idx" ON "UniversityRosterRecord"("rosterImportId");

-- CreateIndex
CREATE INDEX "UniversityRosterRecord_normalizedMatricNumber_idx" ON "UniversityRosterRecord"("normalizedMatricNumber");

-- CreateIndex
CREATE INDEX "UniversityRosterRecord_normalizedFullName_idx" ON "UniversityRosterRecord"("normalizedFullName");

-- CreateIndex
CREATE INDEX "UniversityRosterRecord_isActiveStudent_idx" ON "UniversityRosterRecord"("isActiveStudent");

-- CreateIndex
CREATE INDEX "UniversityRosterRecord_institutionalEmail_idx" ON "UniversityRosterRecord"("institutionalEmail");

-- CreateIndex
CREATE UNIQUE INDEX "UniversityRosterRecord_rosterImportId_normalizedMatricNumbe_key" ON "UniversityRosterRecord"("rosterImportId", "normalizedMatricNumber");

-- AddForeignKey
ALTER TABLE "UniversityRosterImport" ADD CONSTRAINT "UniversityRosterImport_universityId_fkey" FOREIGN KEY ("universityId") REFERENCES "University"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UniversityRosterImport" ADD CONSTRAINT "UniversityRosterImport_importedByAdminId_fkey" FOREIGN KEY ("importedByAdminId") REFERENCES "Admin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UniversityRosterRecord" ADD CONSTRAINT "UniversityRosterRecord_rosterImportId_fkey" FOREIGN KEY ("rosterImportId") REFERENCES "UniversityRosterImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
