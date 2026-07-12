import Link from "next/link";

const footerLinks = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/help", label: "Help" },
  { href: "/contact", label: "Contact" },
];

export default function Footer() {
  return (
    <footer className="border-t border-slate-200/80 bg-slate-50/80 py-12">
      <div className="main-container grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <p className="text-base font-semibold text-slate-950">CampusMart</p>
          <p className="mt-3 max-w-md text-sm leading-7 text-slate-600">A student-first marketplace for buying, selling, and managing transactions around campus life with a calm, dependable experience.</p>
        </div>
        <div className="rounded-[1.5rem] border border-slate-200 bg-white/80 p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">Quick links</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {footerLinks.map((item) => (
              <Link key={item.href} href={item.href} className="text-sm text-slate-600 transition hover:text-brand-900">{item.label}</Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
