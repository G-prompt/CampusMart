"use client";
import AdminShell from "@/components/admin/AdminShell";
import { AnalyticsWorkspace } from "@/components/admin/AdminAnalytics";

export default function AnalyticsPage() {
  return <AdminShell title="Analytics & Reports"><AnalyticsWorkspace /></AdminShell>;
}
