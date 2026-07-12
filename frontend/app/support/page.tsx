import PageShell from "@/components/common/PageShell";

const supportItems = [
    { title: "Account verification", description: "Get help with student identity checks and profile approval." },
    { title: "Wallet support", description: "Resolve transfer, payout, or fee questions quickly." },
    { title: "Order issues", description: "Track disputes, refunds and delivery concerns." },
];

export default function Page() {
    return (
        <PageShell title="Support" description="Find help for verification, wallet, orders and everything you need as a campus seller or buyer.">
            <div className="grid gap-5 md:grid-cols-3">
                {supportItems.map((item) => (
                    <div key={item.title} className="site-card p-6">
                        <h2 className="text-xl font-semibold text-slate-950">{item.title}</h2>
                        <p className="mt-3 text-sm leading-7 text-slate-600">{item.description}</p>
                    </div>
                ))}
            </div>
        </PageShell>
    );
}
