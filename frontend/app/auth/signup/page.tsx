"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import PageShell from "@/components/common/PageShell";

type Role = "vendor" | "client";

export default function Page() {
  const [role, setRole] = useState<Role>("client");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [university, setUniversity] = useState("");
  const [faculty, setFaculty] = useState("");
  const [department, setDepartment] = useState("");
  const [proof, setProof] = useState("");
  const [nin, setNin] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const router = useRouter();

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const user = { name, role, email, phone, university, faculty, department, proof, nin };
    localStorage.setItem("campusmart-user", JSON.stringify(user));
    localStorage.setItem("campusmart-auth", "true");
    setMessage(`Account created for ${name}. You can now browse campus deals.`);
    router.push("/dashboard");
  };

  return (
    <PageShell title="Sign up" description="Create a mock CampusMart account and start exploring as a student buyer or vendor.">
      <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="site-card p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-700">Start your campus journey</p>
          <h2 className="mt-3 text-2xl font-semibold text-slate-950">Pick the role that fits you best</h2>
          <div className="mt-6 space-y-3">
            {[
              { value: "client", title: "Client", description: "Shop for books, gadgets, and campus essentials." },
              { value: "vendor", title: "Vendor", description: "Sell your products and grow your student business." },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setRole(option.value as Role)}
                className={`w-full rounded-2xl border p-4 text-left transition ${role === option.value ? "border-brand-600 bg-brand-50" : "border-slate-200 bg-white"}`}
              >
                <p className="font-semibold text-slate-950">{option.title}</p>
                <p className="mt-1 text-sm text-slate-600">{option.description}</p>
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="site-card p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-700">Create account</p>
          <h2 className="mt-3 text-2xl font-semibold text-slate-950">Join CampusMart</h2>
          <div className="mt-6 space-y-4">
            <label className="block text-sm font-medium text-slate-700">
              Full name
              <input type="text" required value={name} onChange={(event) => setName(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-brand-600" placeholder="Amina Yusuf" />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Email
              <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-brand-600" placeholder="amina@campusmart.com" />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Phone number
              <input type="tel" required value={phone} onChange={(event) => setPhone(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-brand-600" placeholder="08012345678" />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              University
              <input type="text" required value={university} onChange={(event) => setUniversity(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-brand-600" placeholder="University of Lagos" />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Faculty
              <input type="text" required value={faculty} onChange={(event) => setFaculty(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-brand-600" placeholder="Engineering" />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Department
              <input type="text" required value={department} onChange={(event) => setDepartment(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-brand-600" placeholder="Computer Engineering" />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Proof of student status
              <input type="text" required value={proof} onChange={(event) => setProof(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-brand-600" placeholder="Student ID / admission letter" />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              NIN
              <input type="text" required value={nin} onChange={(event) => setNin(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-brand-600" placeholder="12345678901" />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Password
              <input type="password" required value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-brand-600" placeholder="Create a secure password" />
            </label>
          </div>

          <button type="submit" className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-brand-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-700">Create {role} account</button>
          {message ? <p className="mt-4 text-sm text-emerald-700">{message}</p> : null}
        </form>
      </div>
    </PageShell>
  );
}
