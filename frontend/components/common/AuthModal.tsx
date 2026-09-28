"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";

import {
  Role,
  useAuth,
} from "./AuthContext";

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
      className="h-5 w-5"
    >
      <path
        strokeLinecap="round"
        d="m6 6 12 12M18 6 6 18"
      />
    </svg>
  );
}

export default function AuthModal() {
  const {
    authOpen,
    authMode,
    closeAuth,
    roleHint,
    login,
    register,
  } = useAuth();

  const [
    mode,
    setMode,
  ] = useState<
    "login" | "register"
  >(authMode);

  const [
    selectedRole,
    setSelectedRole,
  ] =
    useState<Role>(
      roleHint
    );

  const [
    name,
    setName,
  ] = useState("");

  const [
    campus,
    setCampus,
  ] = useState("");

  const [
    countryCode,
    setCountryCode,
  ] = useState("+234");

  const [
    phone,
    setPhone,
  ] = useState("");

  const [
    bio,
    setBio,
  ] = useState("");

  const [
    businessName,
    setBusinessName,
  ] = useState("");

  const [
    businessDescription,
    setBusinessDescription,
  ] = useState("");

  const [
    pickupLocation,
    setPickupLocation,
  ] = useState("");

  const [
    email,
    setEmail,
  ] = useState("");

  const [
    password,
    setPassword,
  ] = useState("");

  const [
    showPassword,
    setShowPassword,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(false);

  useEffect(() => {
    if (!authOpen) {
      return;
    }

    setMode(authMode);
    setSelectedRole(
      roleHint
    );
  }, [
    authOpen,
    authMode,
    roleHint,
  ]);

  useEffect(() => {
    if (!authOpen) {
      return;
    }

    const closeOnEscape = (
      event: KeyboardEvent
    ) => {
      if (
        event.key ===
        "Escape"
      ) {
        closeAuth();
      }
    };

    document.body.style.overflow =
      "hidden";

    window.addEventListener(
      "keydown",
      closeOnEscape
    );

    return () => {
      document.body.style.overflow =
        "";

      window.removeEventListener(
        "keydown",
        closeOnEscape
      );
    };
  }, [
    authOpen,
    closeAuth,
  ]);

  useEffect(() => {
    if (authOpen) {
      return;
    }

    setName("");
    setCampus("");
    setCountryCode(
      "+234"
    );
    setPhone("");
    setBio("");

    setBusinessName(
      ""
    );

    setBusinessDescription(
      ""
    );

    setPickupLocation(
      ""
    );

    setEmail("");
    setPassword("");

    setShowPassword(
      false
    );

    setError("");
    setLoading(false);
  }, [authOpen]);

  const switchRole = (
    role: Role
  ) => {
    setSelectedRole(
      role
    );

    setError("");
  };

  const switchMode = () => {
    setMode(
      mode === "login"
        ? "register"
        : "login"
    );

    setError("");
    setPassword("");
    setShowPassword(
      false
    );
  };

  const handleSubmit =
    async (
      event: FormEvent<HTMLFormElement>
    ) => {
      event.preventDefault();

      if (loading) {
        return;
      }

      setError("");
      setLoading(true);

      try {
        if (
          mode ===
          "login"
        ) {
          const result =
            await login(
              email,
              password
            );

          if (
            !result.success
          ) {
            setError(
              result.message ||
                "Unable to sign in."
            );
          }

          return;
        }

        const cleanPhone =
          phone.replace(
            /\D/g,
            ""
          );

        const fullPhone =
          cleanPhone
            ? `${countryCode}${cleanPhone.replace(
                /^0+/,
                ""
              )}`
            : "";

        const result =
          await register({
            name,
            email,
            password,

            role:
              selectedRole,

            campus,

            phone:
              fullPhone,

            bio:
              selectedRole ===
              "client"
                ? bio
                : "",

            businessName:
              selectedRole ===
              "vendor"
                ? businessName
                : "",

            businessDescription:
              selectedRole ===
              "vendor"
                ? businessDescription
                : "",

            pickupLocation:
              selectedRole ===
              "vendor"
                ? pickupLocation
                : "",
          });

        if (
          !result.success
        ) {
          setError(
            result.message ||
              "Unable to create your account."
          );
        }
      } finally {
        setLoading(false);
      }
    };

  if (!authOpen) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[999] flex items-start justify-center overflow-y-auto overscroll-contain px-4 py-8 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={
        mode === "login"
          ? "Sign in"
          : "Create account"
      }
    >
      <button
        type="button"
        onClick={
          closeAuth
        }
        aria-label="Close"
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm animate-[fadeIn_0.15s_ease-out]"
      />

      <div className="relative my-auto max-h-[calc(100dvh-4rem)] w-full max-w-md overflow-y-auto overscroll-contain rounded-2xl bg-white shadow-2xl animate-[modalIn_0.18s_ease-out]">
        <button
          type="button"
          onClick={
            closeAuth
          }
          className="absolute right-4 top-4 z-10 inline-flex h-9 w-9 items-center justify-center rounded-[10px] text-slate-500 transition hover:bg-slate-100 hover:text-black"
          aria-label="Close dialog"
        >
          <CloseIcon />
        </button>

        <div className="p-7 sm:p-9">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-black">
            CampusMart
          </p>

          <h2 className="mt-2 pr-10 text-2xl font-bold tracking-tight text-black sm:text-3xl">
            {mode ===
            "login"
              ? "Welcome back"
              : "Create your account"}
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-600">
            {mode ===
            "login"
              ? "Sign in to continue buying and selling on campus."
              : "Join students buying and selling around your campus."}
          </p>

          {mode ===
          "register" ? (
            <fieldset className="mt-5 grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
              <legend className="sr-only">
                Account type
              </legend>

              <button
                type="button"
                onClick={() =>
                  switchRole(
                    "client"
                  )
                }
                aria-pressed={
                  selectedRole ===
                  "client"
                }
                className={`rounded-lg px-3 py-2.5 text-sm font-bold transition ${
                  selectedRole ===
                  "client"
                    ? "bg-white text-black shadow-sm"
                    : "text-slate-500 hover:text-black"
                }`}
              >
                Client / buyer
              </button>

              <button
                type="button"
                onClick={() =>
                  switchRole(
                    "vendor"
                  )
                }
                aria-pressed={
                  selectedRole ===
                  "vendor"
                }
                className={`rounded-lg px-3 py-2.5 text-sm font-bold transition ${
                  selectedRole ===
                  "vendor"
                    ? "bg-white text-black shadow-sm"
                    : "text-slate-500 hover:text-black"
                }`}
              >
                Vendor / seller
              </button>
            </fieldset>
          ) : null}

          <form
            onSubmit={
              handleSubmit
            }
            className="mt-6 space-y-4"
            autoComplete="on"
          >
            {mode ===
            "register" ? (
              <>
                <label className="block text-sm font-semibold text-slate-700">
                  Full name

                  <input
                    type="text"
                    name="name"
                    autoComplete="name"
                    required
                    value={name}
                    onChange={(
                      event
                    ) =>
                      setName(
                        event
                          .target
                          .value
                      )
                    }
                    className="mt-1.5 w-full rounded-[10px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-black focus:bg-white focus:ring-2 focus:ring-accent-200"
                    placeholder="Amina Yusuf"
                  />
                </label>

                <label className="block text-sm font-semibold text-slate-700">
                  Campus or school

                  <input
                    type="text"
                    name="campus"
                    autoComplete="off"
                    required
                    value={
                      campus
                    }
                    onChange={(
                      event
                    ) =>
                      setCampus(
                        event
                          .target
                          .value
                      )
                    }
                    className="mt-1.5 w-full rounded-[10px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-black focus:bg-white focus:ring-2 focus:ring-accent-200"
                    placeholder="Rivers State University"
                  />
                </label>

                <label className="block text-sm font-semibold text-slate-700">
                  Phone number
                  {selectedRole ===
                  "client" ? (
                    <span className="font-normal text-slate-500">
                      {" "}
                      (optional)
                    </span>
                  ) : null}

                  <div className="mt-1.5 flex gap-2">
                    <select
                      name="countryCode"
                      value={
                        countryCode
                      }
                      onChange={(
                        event
                      ) =>
                        setCountryCode(
                          event
                            .target
                            .value
                        )
                      }
                      aria-label="Country calling code"
                      className="w-24 shrink-0 rounded-[10px] border border-slate-200 bg-slate-50 px-2 py-3 text-sm text-slate-900 outline-none focus:border-black"
                    >
                      <option value="+234">
                        +234
                      </option>

                      <option value="+233">
                        +233
                      </option>

                      <option value="+27">
                        +27
                      </option>

                      <option value="+254">
                        +254
                      </option>

                      <option value="+44">
                        +44
                      </option>

                      <option value="+1">
                        +1
                      </option>
                    </select>

                    <input
                      type="tel"
                      name="phone"
                      autoComplete="tel-national"
                      inputMode="numeric"
                      required={
                        selectedRole ===
                        "vendor"
                      }
                      value={
                        phone
                      }
                      onChange={(
                        event
                      ) =>
                        setPhone(
                          event.target.value.replace(
                            /[^0-9]/g,
                            ""
                          )
                        )
                      }
                      className="min-w-0 flex-1 rounded-[10px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-black focus:bg-white focus:ring-2 focus:ring-accent-200"
                      placeholder="902865529"
                    />
                  </div>
                </label>

                {selectedRole ===
                "vendor" ? (
                  <div className="space-y-4 rounded-xl border border-slate-100 bg-slate-50 p-4">
                    <div>
                      <p className="text-sm font-bold text-black">
                        Your shop
                      </p>

                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        Tell students
                        what your
                        business offers
                        and where they
                        can collect
                        purchases.
                      </p>
                    </div>

                    <label className="block text-sm font-semibold text-slate-700">
                      Shop or business
                      name

                      <input
                        type="text"
                        name="businessName"
                        autoComplete="organization"
                        required
                        value={
                          businessName
                        }
                        onChange={(
                          event
                        ) =>
                          setBusinessName(
                            event
                              .target
                              .value
                          )
                        }
                        className="mt-1.5 w-full rounded-[10px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-black focus:ring-2 focus:ring-accent-200"
                        placeholder="Tunde's Tech Store"
                      />
                    </label>

                    <label className="block text-sm font-semibold text-slate-700">
                      What do you sell?

                      <textarea
                        name="businessDescription"
                        autoComplete="off"
                        required
                        rows={3}
                        value={
                          businessDescription
                        }
                        onChange={(
                          event
                        ) =>
                          setBusinessDescription(
                            event
                              .target
                              .value
                          )
                        }
                        className="mt-1.5 w-full resize-y rounded-[10px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-black focus:ring-2 focus:ring-accent-200"
                        placeholder="Phones, accessories, laptop repairs and other tech products."
                      />
                    </label>

                    <label className="block text-sm font-semibold text-slate-700">
                      Pickup location

                      <input
                        type="text"
                        name="pickupLocation"
                        autoComplete="off"
                        required
                        value={
                          pickupLocation
                        }
                        onChange={(
                          event
                        ) =>
                          setPickupLocation(
                            event
                              .target
                              .value
                          )
                        }
                        className="mt-1.5 w-full rounded-[10px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-black focus:ring-2 focus:ring-accent-200"
                        placeholder="Hostel B, Main Campus"
                      />
                    </label>
                  </div>
                ) : (
                  <label className="block text-sm font-semibold text-slate-700">
                    About you
                    <span className="font-normal text-slate-500">
                      {" "}
                      (optional)
                    </span>

                    <textarea
                      name="bio"
                      autoComplete="off"
                      rows={3}
                      value={bio}
                      onChange={(
                        event
                      ) =>
                        setBio(
                          event
                            .target
                            .value
                        )
                      }
                      className="mt-1.5 w-full resize-y rounded-[10px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-black focus:bg-white focus:ring-2 focus:ring-accent-200"
                      placeholder="Tell other students a little about yourself."
                    />
                  </label>
                )}
              </>
            ) : null}

            <label className="block text-sm font-semibold text-slate-700">
              Email

              <input
                type="email"
                name="email"
                autoComplete="email"
                required
                value={
                  email
                }
                onChange={(
                  event
                ) =>
                  setEmail(
                    event
                      .target
                      .value
                  )
                }
                className="mt-1.5 w-full rounded-[10px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-black focus:bg-white focus:ring-2 focus:ring-accent-200"
                placeholder="student@example.com"
              />
            </label>

            <label className="block text-sm font-semibold text-slate-700">
              Password

              <div className="relative mt-1.5">
                <input
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  name="password"
                  autoComplete={
                    mode ===
                    "register"
                      ? "new-password"
                      : "current-password"
                  }
                  required
                  minLength={8}
                  value={
                    password
                  }
                  onChange={(
                    event
                  ) =>
                    setPassword(
                      event
                        .target
                        .value
                    )
                  }
                  className="w-full rounded-[10px] border border-slate-200 bg-slate-50 px-4 py-3 pr-20 text-base text-slate-900 outline-none transition focus:border-accent-400 focus:bg-white"
                  placeholder={
                    mode ===
                    "register"
                      ? "At least 8 characters"
                      : "Your password"
                  }
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowPassword(
                      (
                        visible
                      ) =>
                        !visible
                    )
                  }
                  className="absolute inset-y-0 right-3 my-auto h-fit text-sm font-semibold text-slate-500 transition hover:text-slate-900"
                >
                  {showPassword
                    ? "Hide"
                    : "Show"}
                </button>
              </div>
            </label>

            {error ? (
              <p
                className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-600"
                role="alert"
              >
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={
                loading
              }
              className="!mt-6 inline-flex w-full items-center justify-center rounded-[10px] bg-accent-400 px-5 py-3 text-base font-bold text-black transition hover:bg-accent-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading
                ? mode ===
                  "login"
                  ? "Signing in..."
                  : "Creating account..."
                : mode ===
                  "login"
                  ? "Sign in"
                  : "Create account"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-600">
            {mode ===
            "login"
              ? "New to CampusMart?"
              : "Already have an account?"}{" "}

            <button
              type="button"
              onClick={
                switchMode
              }
              className="font-bold text-black underline decoration-accent-400 decoration-2 underline-offset-2 transition hover:text-slate-700"
            >
              {mode ===
              "login"
                ? "Create an account"
                : "Sign in"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}