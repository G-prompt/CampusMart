-- Whether an authorised importer attested to an official current-student-only roster.
ALTER TABLE "UniversityRosterImport"
ADD COLUMN "currentStudentsOnlyDeclared" BOOLEAN NOT NULL DEFAULT false;

-- Non-destructive notification for students whose previously unlisted university joins the platform.
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'university_available';
