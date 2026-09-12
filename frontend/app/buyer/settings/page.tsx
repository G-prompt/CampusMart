import PageShell from "@/components/common/PageShell";
import AccountPanel from "@/components/common/AccountPanel";

export default function Page() {
  return <PageShell title="Client settings" description="Customize notifications and keep your account preferences current."><AccountPanel title="Client settings" /></PageShell>;
}
