import PageShell from "@/components/common/PageShell";
import AccountPanel from "@/components/common/AccountPanel";

export default function Page() {
  return <PageShell title="Vendor settings" description="Manage your seller profile and marketplace notifications."><AccountPanel title="Vendor profile and settings" /></PageShell>;
}
