import Link from "next/link";
import Image from "next/image";

const footerLinks = [
  { href: "/marketplace/services", label: "Services" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/help", label: "Help" },
  { href: "/contact", label: "Contact" },
];

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-slate-200 bg-white py-10">
      <div className="main-container grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <div className="flex items-center gap-3">
            <Image
              src="/campusmart-logo.jpg"
              alt=""
              width={40}
              height={40}
              className="h-10 w-10 rounded-xl object-cover"
            />
            <p className="text-base font-black text-slate-950">
              Campus<span className="text-accent-400">Mart</span>
            </p>
          </div>
          <p className="mt-3 max-w-md text-sm leading-7 text-slate-600">A student-first marketplace for buying, selling, and managing transactions around campus life with a calm, dependable experience.</p>
        </div>
        <div className="flex items-center lg:justify-end">
          <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
            {footerLinks.map((item) => (
              <Link key={item.href} href={item.href} className="text-sm text-slate-600 transition hover:text-brand-900">{item.label}</Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
