import PageShell from "@/components/common/PageShell";
import AccountPanel from "@/components/common/AccountPanel";

export default function Page() {
  return <PageShell title="Buyer profile" description="Manage your account details and preferences."><AccountPanel title="Client profile" /></PageShell>;
}
