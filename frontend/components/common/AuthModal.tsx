"use client";

import { FormEvent, useEffect, useState } from "react";
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
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (authOpen) setMode(authMode);
  }, [authOpen, authMode]);

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
      setName("");
      setEmail("");
      setPassword("");
    }
  }, [authOpen]);

  if (!authOpen) return null;

const handleSubmit = async (
  event: FormEvent
) => {
  event.preventDefault();

  setError("");
  setLoading(true);

  try {
    const result =
      mode === "login"
        ? await login(
            email,
            password
          )
        : await register({
            name,
            email,
            password,
            role: roleHint,
          });

    if (!result.success) {
      setError(
        result.message ||
          "Something went wrong."
      );
    }
  } finally {
    setLoading(false);
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
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-1.5 w-full rounded-[10px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-black focus:bg-white focus:ring-2 focus:ring-accent-200"
                placeholder="••••••••"
              />
            </label>

            {error ? (
  <p
    className="rounded-[10px] bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
    role="alert"
  >
    {error}
  </p>
) : null}

            <button
  type="submit"
  disabled={loading}
  className="!mt-6 inline-flex w-full items-center justify-center rounded-[10px] bg-accent-400 px-5 py-3 text-base font-bold text-black transition hover:bg-accent-500 disabled:cursor-not-allowed disabled:opacity-60"
>
  {loading
    ? mode === "login"
      ? "Signing in..."
      : "Creating account..."
    : mode === "login"
    ? "Sign in"
    : "Create account"}
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
