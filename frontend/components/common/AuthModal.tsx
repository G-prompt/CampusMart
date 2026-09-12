"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useAuth } from "./AuthContext";

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" className="h-5 w-5">
      <path strokeLinecap="round" d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}

export default function AuthModal() {
  const { authOpen, authMode, closeAuth, roleHint, login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">(authMode);
  const [selectedRole, setSelectedRole] = useState(roleHint);
  const [countryCode, setCountryCode] = useState("+234");
  const [name, setName] = useState("");
  const [campus, setCampus] = useState("");
  const [phone, setPhone] = useState("");
  const [bio, setBio] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [businessDescription, setBusinessDescription] = useState("");
  const [pickupLocation, setPickupLocation] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (authOpen) {
      setMode(authMode);
      setSelectedRole(roleHint);
    }
  }, [authOpen, authMode, roleHint]);

  useEffect(() => {
    if (!authOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => event.key === "Escape" && closeAuth();
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [authOpen, closeAuth]);

  useEffect(() => {
    if (!authOpen) {
      setCampus("");
      setPhone("");
      setCountryCode("+234");
      setBio("");
      setBusinessName("");
      setBusinessDescription("");
      setPickupLocation("");
      setEmail("");
      setPassword("");
      setShowPassword(false);
      setError("");
    }
  }, [authOpen]);

  if (!authOpen) return null;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("Use at least 6 characters for your password.");
      return;
    }
    if (mode === "login") {
      login(email, password, "client");
    } else {
      register({ name, email, password, role: selectedRole, campus, phone: `${countryCode}${phone.replace(/^0+/, "")}`, bio, businessName, businessDescription, pickupLocation });
    }
  };

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center px-4 py-8" role="dialog" aria-modal="true" aria-label={mode === "login" ? "Sign in" : "Register"}>
      <button
        type="button"
        onClick={closeAuth}
        aria-label="Close"
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm animate-[fadeIn_0.15s_ease-out]"
      />

      <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl animate-[modalIn_0.18s_ease-out]">
        <button
          type="button"
          onClick={closeAuth}
          className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-[10px] text-slate-500 transition hover:bg-slate-100 hover:text-black"
          aria-label="Close dialog"
        >
          <CloseIcon />
        </button>

        <div className="p-7 sm:p-9">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-black">CampusMart</p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-black sm:text-3xl">
            {mode === "login" ? "Welcome back" : "Create your account"}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            {mode === "login" ? "Sign in to continue buying and selling on campus." : "Join students buying and selling around your campus."}
          </p>

          {mode === "register" ? <fieldset className="mt-5 grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
            <legend className="sr-only">Account type</legend>
            {(["client", "vendor"] as const).map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => setSelectedRole(role)}
                className={`rounded-lg px-3 py-2.5 text-sm font-bold capitalize transition ${selectedRole === role ? "bg-white text-black shadow-sm" : "text-slate-500 hover:text-black"}`}
                aria-pressed={selectedRole === role}
              >
                {role === "client" ? "Client / buyer" : "Vendor / seller"}
              </button>
            ))}
          </fieldset> : <p className="mt-5 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">Your account type is saved when you register and cannot be changed while signed in.</p>}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {mode === "register" ? (
              <label className="block text-sm font-semibold text-slate-700">
                Full name
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="mt-1.5 w-full rounded-[10px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-black focus:bg-white focus:ring-2 focus:ring-accent-200"
                  placeholder="Amina Yusuf"
                />
              </label>
            ) : null}

            {mode === "register" ? <>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-semibold text-slate-700">Campus or school<input required value={campus} onChange={(event) => setCampus(event.target.value)} className="mt-1.5 w-full rounded-[10px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-black focus:bg-white" placeholder="University of Lagos" /></label>
                <label className="block text-sm font-semibold text-slate-700">Phone number<div className="mt-1.5 flex gap-2"><select value={countryCode} onChange={(event) => setCountryCode(event.target.value)} aria-label="Country calling code" className="w-[6.5rem] rounded-[10px] border border-slate-200 bg-slate-50 px-2 py-3 text-sm text-slate-900 outline-none focus:border-black focus:bg-white"><option value="+234">NG +234</option><option value="+1">US +1</option><option value="+44">UK +44</option><option value="+27">ZA +27</option><option value="+233">GH +233</option><option value="+254">KE +254</option></select><input required={selectedRole === "vendor"} value={phone} onChange={(event) => setPhone(event.target.value.replace(/[^0-9]/g, ""))} className="min-w-0 flex-1 rounded-[10px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-black focus:bg-white" placeholder="902865529" inputMode="numeric" /></div></label>
              </div>
              {selectedRole === "vendor" ? <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Vendor verification details</p><label className="block text-sm font-semibold text-slate-700">Shop or business name<input required value={businessName} onChange={(event) => setBusinessName(event.target.value)} className="mt-1.5 w-full rounded-[10px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-black" placeholder="Goodluck Audio Store" /></label><label className="block text-sm font-semibold text-slate-700">What do you sell?<textarea required rows={3} value={businessDescription} onChange={(event) => setBusinessDescription(event.target.value)} className="mt-1.5 w-full resize-y rounded-[10px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-black" placeholder="Describe your products or services." /></label><label className="block text-sm font-semibold text-slate-700">Usual campus pickup point<input required value={pickupLocation} onChange={(event) => setPickupLocation(event.target.value)} className="mt-1.5 w-full rounded-[10px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-black" placeholder="Main campus gate" /></label></div> : <label className="block text-sm font-semibold text-slate-700">About you <span className="font-normal text-slate-500">(optional)</span><textarea rows={3} value={bio} onChange={(event) => setBio(event.target.value)} className="mt-1.5 w-full resize-y rounded-[10px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-black focus:bg-white" placeholder="A short introduction for your campus profile." /></label>}
            </> : null}

            <label className="block text-sm font-semibold text-slate-700">
              Email
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-1.5 w-full rounded-[10px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-black focus:bg-white focus:ring-2 focus:ring-accent-200"
                placeholder="student@campusmart.com"
              />
            </label>

            <label className="block text-sm font-semibold text-slate-700">
              Password
              <div className="relative mt-1.5">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-[10px] border border-slate-200 bg-slate-50 px-4 py-3 pr-20 text-sm text-slate-900 outline-none transition focus:border-black focus:bg-white focus:ring-2 focus:ring-accent-200"
                  placeholder="At least 6 characters"
                />
                <button type="button" onClick={() => setShowPassword((visible) => !visible)} className="absolute inset-y-0 right-2 px-2 text-xs font-bold text-slate-500 hover:text-black" aria-label={showPassword ? "Hide password" : "Show password"}>
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </label>

            {error ? <p className="text-sm font-semibold text-red-600" role="alert">{error}</p> : null}

            <button
              type="submit"
              className="!mt-6 inline-flex w-full items-center justify-center rounded-[10px] bg-accent-400 px-5 py-3 text-base font-bold text-black transition hover:bg-accent-500"
            >
              {mode === "login" ? "Sign in" : "Create account"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-600">
            {mode === "login" ? "New to CampusMart?" : "Already have an account?"}{" "}
            <button
              type="button"
              onClick={() => setMode(mode === "login" ? "register" : "login")}
              className="font-bold text-black underline decoration-accent-400 decoration-2 underline-offset-2 transition hover:text-slate-700"
            >
              {mode === "login" ? "Create an account" : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
