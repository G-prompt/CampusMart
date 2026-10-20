import { MarketplaceSeverity, MarketplaceReportCategory } from "../generated/prisma/client";

export const severityWeight: Record<MarketplaceSeverity, number> = {
  low: 10, medium: 35, high: 65, critical: 90,
};
export function maximumSeverity(a: MarketplaceSeverity, b: MarketplaceSeverity): MarketplaceSeverity {
  return severityWeight[a] >= severityWeight[b] ? a : b;
}
export function casePriority(severity: MarketplaceSeverity, distinctReporters: number): number {
  // A single credible urgent report outranks a pile of minor complaints.
  return Math.min(100, severityWeight[severity] + Math.min(25, Math.max(0, distinctReporters - 1) * 3));
}
export function priorityLabel(score: number): "critical" | "high" | "medium" | "low" {
  if (score >= 90) return "critical";
  if (score >= 65) return "high";
  if (score >= 35) return "medium";
  return "low";
}


/** Assigned by CampusMart, never by the person submitting a report.
 * Reports are triage signals, not verified findings. Admins review context.
 */
export const reportSeverity: Record<MarketplaceReportCategory, MarketplaceSeverity> = {
  suspected_fraud: MarketplaceSeverity.high,
  non_delivery: MarketplaceSeverity.medium,
  misleading_listing: MarketplaceSeverity.medium,
  harassment: MarketplaceSeverity.high,
  prohibited_item: MarketplaceSeverity.high,
  impersonation: MarketplaceSeverity.high,
  privacy_violation: MarketplaceSeverity.high,
  payment_dispute: MarketplaceSeverity.medium,
  unsafe_meetup: MarketplaceSeverity.critical,
  other: MarketplaceSeverity.medium,
};
export const severityForCategory = (category: MarketplaceReportCategory): MarketplaceSeverity => reportSeverity[category];
