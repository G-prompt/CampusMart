import PageShell from "@/components/common/PageShell";
import AccountPanel from "@/components/common/AccountPanel";

export default function Page() {
  return <PageShell title="Your account" description="Manage your profile, account type, and personal preferences."><AccountPanel /></PageShell>;
}
