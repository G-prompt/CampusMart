"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:5000";

const ADMIN_TOKEN_KEY =
  "campusmart-admin-token";

type AdminProfile = {
  id: string;
  name: string;
  email: string;
  role: string;
};

export default function AdminLoginPage() {
  const router =
    useRouter();

  const [
    email,
    setEmail,
  ] =
    useState("");

  const [
    password,
    setPassword,
  ] =
    useState("");

  const [
    loading,
    setLoading,
  ] =
    useState(false);

  const [
    checkingSession,
    setCheckingSession,
  ] =
    useState(true);

  const [
    error,
    setError,
  ] =
    useState("");

  useEffect(() => {
    let cancelled =
      false;

    const checkExistingSession =
      async () => {
        const token =
          sessionStorage.getItem(
            ADMIN_TOKEN_KEY
          );

        if (!token) {
          setCheckingSession(
            false
          );

          return;
        }

        try {
          const response =
            await fetch(
              `${API_URL}/api/admin/auth/me`,
              {
                headers: {
                  Authorization:
                    `Bearer ${token}`,
                },

                cache:
                  "no-store",
              }
            );

          const data =
            await response.json();

          if (
            response.ok &&
            data.success &&
            data.admin
          ) {
            if (!cancelled) {
              router.replace(
                "/admin"
              );
            }

            return;
          }

          sessionStorage.removeItem(
            ADMIN_TOKEN_KEY
          );
        } catch (
          sessionError
        ) {
          console.error(
            "Admin session check failed:",
            sessionError
          );

          sessionStorage.removeItem(
            ADMIN_TOKEN_KEY
          );
        } finally {
          if (!cancelled) {
            setCheckingSession(
              false
            );
          }
        }
      };

    void checkExistingSession();

    return () => {
      cancelled =
        true;
    };
  }, [
    router,
  ]);

  const handleSubmit =
    async (
      event:
        FormEvent<HTMLFormElement>
    ) => {
      event.preventDefault();

      if (loading) {
        return;
      }

      setError("");
      setLoading(
        true
      );

      try {
        const response =
          await fetch(
            `${API_URL}/api/admin/auth/login`,
            {
              method:
                "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body:
                JSON.stringify({
                  email:
                    email.trim(),

                  password,
                }),
            }
          );

        const data =
          await response.json();

        if (
          !response.ok ||
          !data.success ||
          !data.token
        ) {
          setError(
            data.message ||
              "Unable to sign in."
          );

          return;
        }

        const admin =
          data.admin as
            | AdminProfile
            | undefined;

        if (!admin) {
          setError(
            "Admin account information was not returned."
          );

          return;
        }

        sessionStorage.setItem(
          ADMIN_TOKEN_KEY,
          data.token
        );

        router.replace(
          "/admin"
        );
      } catch (
        loginError
      ) {
        console.error(
          "Admin login failed:",
          loginError
        );

        setError(
          "Unable to connect to CampusMart Admin. Check that the backend is running."
        );
      } finally {
        setLoading(
          false
        );
      }
    };

  if (
    checkingSession
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6">
        <div className="text-center">
          <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-white/20 border-t-white" />

          <p className="mt-4 text-sm font-semibold text-slate-300">
            Checking Admin
            session...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto grid min-h-screen max-w-7xl lg:grid-cols-[1.05fr_0.95fr]">
        <section className="hidden flex-col justify-between border-r border-white/10 p-12 lg:flex">
          <div>
            <div className="inline-flex items-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold">
              CampusMart Admin
            </div>

            <div className="mt-20 max-w-xl">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-amber-400">
                Operations
              </p>

              <h1 className="mt-5 text-5xl font-semibold leading-[1.05] tracking-tight">
                Trust, safety
                and marketplace
                operations.
              </h1>

              <p className="mt-6 max-w-lg text-base leading-8 text-slate-400">
                Review student
                verification,
                manage
                universities,
                moderate the
                marketplace and
                operate CampusMart
                from one secure
                workspace.
              </p>
            </div>
          </div>

          <div className="text-sm text-slate-500">
            Authorised CampusMart
            staff only.
          </div>
        </section>

        <section className="flex items-center justify-center px-6 py-12 sm:px-10 lg:px-14">
          <div className="w-full max-w-md">
            <div className="lg:hidden">
              <div className="inline-flex items-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold">
                CampusMart Admin
              </div>
            </div>

            <div className="mt-10 lg:mt-0">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-400">
                Secure access
              </p>

              <h2 className="mt-4 text-3xl font-semibold tracking-tight">
                Sign in to Admin
              </h2>

              <p className="mt-3 text-sm leading-6 text-slate-400">
                Use your
                CampusMart Admin
                account. Normal
                buyer and seller
                accounts cannot
                access this area.
              </p>
            </div>

            <form
              onSubmit={
                handleSubmit
              }
              className="mt-8 space-y-5"
            >
              <label className="block">
                <span className="text-sm font-semibold text-slate-200">
                  Admin email
                </span>

                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(
                    event
                  ) =>
                    setEmail(
                      event.target
                        .value
                    )
                  }
                  placeholder="admin@campusmart..."
                  className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-amber-400 focus:bg-white/[0.09]"
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-slate-200">
                  Password
                </span>

                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={
                    password
                  }
                  onChange={(
                    event
                  ) =>
                    setPassword(
                      event.target
                        .value
                    )
                  }
                  placeholder="Enter your password"
                  className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-amber-400 focus:bg-white/[0.09]"
                />
              </label>

              {error ? (
                <div
                  role="alert"
                  className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-semibold leading-6 text-red-200"
                >
                  {error}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={
                  loading
                }
                className="w-full rounded-xl bg-amber-400 px-5 py-3.5 text-sm font-bold text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading
                  ? "Signing in..."
                  : "Sign in"}
              </button>
            </form>

            <div className="mt-8 border-t border-white/10 pt-6">
              <p className="text-xs leading-5 text-slate-500">
                Admin access is
                separate from your
                normal CampusMart
                account session.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}