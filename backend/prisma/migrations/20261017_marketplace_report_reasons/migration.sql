-- Additional report categories; existing reports and severity values are preserved.
ALTER TYPE "MarketplaceReportCategory" ADD VALUE IF NOT EXISTS 'impersonation';
ALTER TYPE "MarketplaceReportCategory" ADD VALUE IF NOT EXISTS 'privacy_violation';
ALTER TYPE "MarketplaceReportCategory" ADD VALUE IF NOT EXISTS 'payment_dispute';
ALTER TYPE "MarketplaceReportCategory" ADD VALUE IF NOT EXISTS 'unsafe_meetup';
