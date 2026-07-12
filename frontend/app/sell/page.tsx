import PageShell from "@/components/common/PageShell";

const benefits = [
    "Verified student identity for trusted selling",
    "Easy listing flow for books, gadgets, fashion and services",
    "Protected wallet payouts and fast settlement",
];

export default function Page() {
    return (
        <PageShell title="Sell on CampusMart" description="Start your student vendor journey with a verified campus marketplace account.">
            <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="site-card p-6">
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-700">Why sell here</p>
                    <h2 className="mt-3 text-2xl font-semibold text-slate-950">Reach buyers who already trust campus commerce</h2>
                    <ul className="mt-5 space-y-3 text-sm leading-7 text-slate-600">
                        {benefits.map((benefit) => (
                            <li key={benefit} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">{benefit}</li>
                        ))}
                    </ul>
                </div>
                <div className="site-card p-6">
                    <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-700">Start now</p>
                    <a href="/auth/signup" className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-brand-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-700">Create vendor account</a>
                    <p className="mt-4 text-sm leading-7 text-slate-600">Your registration can include full name, contact details, university, faculty, department, student proof, NIN and more.</p>
                </div>
            </div>
        </PageShell>
    );
}
