"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import PageShell from "@/components/common/PageShell";

type Role = "vendor" | "client";

export default function Page() {
  const [role, setRole] = useState<Role>("client");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const router = useRouter();

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const user = {
      name: email.split("@")[0].replace(/[._-]/g, " "),
      role,
      email,
    };

    localStorage.setItem("campusmart-user", JSON.stringify(user));
    localStorage.setItem("campusmart-auth", "true");
    setMessage(`Welcome back, ${user.name}. You are ready to explore CampusMart.`);
    router.push("/dashboard");
  };

  return (
    <PageShell title="Login" description="Sign in to your CampusMart account. The demo mode lets you test as either a vendor or a student buyer.">
      <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="site-card p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-700">Choose your path</p>
          <h2 className="mt-3 text-2xl font-semibold text-slate-950">Continue as a vendor or a client</h2>
          <div className="mt-6 space-y-3">
            {[
              { value: "client", title: "Client", description: "Shop, save items, and manage your student wallet." },
              { value: "vendor", title: "Vendor", description: "List products, track orders, and receive payouts." },
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
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-700">Demo authentication</p>
          <h2 className="mt-3 text-2xl font-semibold text-slate-950">Welcome back</h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">Use any email and password to test the UI. Your profile will be saved locally so you can continue shopping.</p>

          <div className="mt-6 space-y-4">
            <label className="block text-sm font-medium text-slate-700">
              Email
              <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-brand-600" placeholder="student@campusmart.com" />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Password
              <input type="password" required value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition focus:border-brand-600" placeholder="••••••••" />
            </label>
          </div>

          <button type="submit" className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-brand-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-700">Sign in as {role}</button>
          {message ? <p className="mt-4 text-sm text-emerald-700">{message}</p> : null}
        </form>
      </div>
    </PageShell>
  );
}
