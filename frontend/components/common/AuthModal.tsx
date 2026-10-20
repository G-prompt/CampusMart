"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import { formatNigerianNationalInput, toNigeriaE164 } from "@/lib/phone";
import { NIGERIA_LOCATIONS, NIGERIAN_STATES } from "@/lib/nigeriaLocations";
import { institutionSearchScore, institutionDisplayCode } from "@/lib/institutionSearch";

import {
  Role,
  UniversitySummary,
  useAuth,
} from "./AuthContext";

const API_URL =
  process.env
    .NEXT_PUBLIC_API_URL ||
  "http://localhost:5000";

const OTHER_UNIVERSITY =
  "other";
const NOT_A_STUDENT = "not_student";


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
    universities,
    setUniversities,
  ] = useState<
    UniversitySummary[]
  >([]);

  const [
    universitiesLoading,
    setUniversitiesLoading,
  ] = useState(false);

  const [
    universitiesError,
    setUniversitiesError,
  ] = useState("");

  const [
    universityChoice,
    setUniversityChoice,
  ] = useState("");
  const [universityStateFilter, setUniversityStateFilter] = useState("");
  const [universitySearch, setUniversitySearch] = useState("");
  const [showUniversitySuggestions, setShowUniversitySuggestions] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);

  // Institution aliases are search-only; the selected ID is always the
  // canonical record returned by the backend. The state filter is preferred,
  // but a cross-state result can be selected when the search has no local hit.
  const filteredUniversities = useMemo(() => {
    const query = universitySearch.trim();
    return universities
      .filter((university) =>
        (!universityStateFilter ||
          university.state.trim().toLowerCase() === universityStateFilter.toLowerCase()) &&
        institutionSearchScore(university, query) !== null
      )
      .sort((a, b) => {
        const difference =
          (institutionSearchScore(a, query) ?? 9) -
          (institutionSearchScore(b, query) ?? 9);
        // Featured placement changes discovery order, not eligibility.
        const aFeatured = Boolean((a as UniversitySummary & { featuredInSignup?: boolean }).featuredInSignup);
        const bFeatured = Boolean((b as UniversitySummary & { featuredInSignup?: boolean }).featuredInSignup);
        return difference || Number(bFeatured) - Number(aFeatured) || a.name.localeCompare(b.name);
      });
  }, [universities, universityStateFilter, universitySearch]);

  const elsewhereSuggestions = useMemo(() => {
    const query = universitySearch.trim();
    if (!universityStateFilter || query.length < 2 || filteredUniversities.length) {
      return [];
    }
    return universities
      .filter((university) =>
        university.state.toLowerCase() !== universityStateFilter.toLowerCase() &&
        institutionSearchScore(university, query) !== null
      )
      .sort((a, b) =>
        (institutionSearchScore(a, query) ?? 9) -
          (institutionSearchScore(b, query) ?? 9) ||
        a.name.localeCompare(b.name)
      )
      .slice(0, 5);
  }, [universities, universityStateFilter, universitySearch, filteredUniversities]);

  const visibleSuggestions = filteredUniversities.slice(0, 8);
  const keyboardSuggestions = visibleSuggestions.length
    ? visibleSuggestions
    : elsewhereSuggestions;
  const shouldShowSuggestions = showUniversitySuggestions &&
    !universityChoice &&
    Boolean(universitySearch.trim() || universityStateFilter);

  const [
    fallbackUniversityName,
    setFallbackUniversityName,
  ] = useState("");

  const [
    fallbackState,
    setFallbackState,
  ] = useState("");

  const [
    fallbackCity,
    setFallbackCity,
  ] = useState("");

  const [
    matricNumber,
    setMatricNumber,
  ] = useState("");

  const [
    matricFailedAttempts,
    setMatricFailedAttempts,
  ] = useState(0);

  const [
    matricFormatHint,
    setMatricFormatHint,
  ] = useState<
    string | null
  >(null);

  const [
    name,
    setName,
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

  const selectedUniversity =
    useMemo(
      () =>
        universities.find(
          (university) =>
            university.id ===
            universityChoice
        ) || null,
      [
        universities,
        universityChoice,
      ]
    );

  const isOtherUniversity = universityChoice === OTHER_UNIVERSITY;
  const isNotStudent = universityChoice === NOT_A_STUDENT;

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
    if (
      !authOpen ||
      mode !== "register"
    ) {
      return;
    }

    if (
      universities.length >
      0
    ) {
      return;
    }

    let cancelled =
      false;

    const loadUniversities =
      async () => {
        setUniversitiesLoading(
          true
        );

        setUniversitiesError(
          ""
        );

        try {
          const response =
            await fetch(
              `${API_URL}/api/universities`,
              {
                cache:
                  "no-store",
              }
            );

          const data =
            await response.json();

          if (
            !response.ok ||
            !data.success
          ) {
            throw new Error(
              data.message ||
                "Unable to load universities."
            );
          }

          if (!cancelled) {
            setUniversities(
              Array.isArray(
                data.universities
              )
                ? data.universities
                : []
            );
          }
        } catch (loadError) {
          console.error(
            "University load failed:",
            loadError
          );

          if (!cancelled) {
            setUniversitiesError(
              "We could not load the university list. You can try again or choose University not listed."
            );
          }
        } finally {
          if (!cancelled) {
            setUniversitiesLoading(
              false
            );
          }
        }
      };

    void loadUniversities();

    return () => {
      cancelled =
        true;
    };
  }, [
    authOpen,
    mode,
    universities.length,
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

    setUniversityChoice(
      ""
    );
    setUniversityStateFilter("");
    setUniversitySearch("");
    setShowUniversitySuggestions(false);
    setActiveSuggestionIndex(0);

    setFallbackUniversityName(
      ""
    );

    setFallbackState(
      ""
    );

    setFallbackCity(
      ""
    );

    setMatricNumber(
      ""
    );

    setMatricFailedAttempts(
      0
    );

    setMatricFormatHint(
      null
    );

    setCountryCode(
      "+234"
    );

    setPhone("");

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

  const handleUniversityChange = (
    value: string
  ) => {
    setUniversityChoice(
      value
    );
    setShowUniversitySuggestions(false);
    setActiveSuggestionIndex(0);

    setFallbackUniversityName(
      ""
    );

    setFallbackState(
      ""
    );

    setFallbackCity(
      ""
    );

    setMatricNumber(
      ""
    );

    setMatricFailedAttempts(
      0
    );

    setMatricFormatHint(
      null
    );

    setError("");
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

      if (
        mode === "login"
      ) {
        setLoading(true);

        try {
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
        } finally {
          setLoading(
            false
          );
        }

        return;
      }

      if (
        !universityChoice
      ) {
        setError(
          "Search and select your institution, or choose an option under Other."
        );

        return;
      }

      if (
        !isOtherUniversity &&
        !isNotStudent &&
        !selectedUniversity
      ) {
        setError(
          "Please choose an institution from the matching results."
        );

        return;
      }

      if (
        isOtherUniversity &&
        !fallbackUniversityName.trim()
      ) {
        setError(
          "Enter the name of your university."
        );

        return;
      }

      if (
        isOtherUniversity &&
        (!fallbackState ||
          !fallbackCity.trim())
      ) {
        setError(
          "Select your state and enter your city or area."
        );

        return;
      }

      if (
        selectedUniversity &&
        !matricNumber.trim()
      ) {
        setError(
          selectedUniversity
            ? `Enter your ${selectedUniversity.shortName} matric number.`
            : "Enter your matric number."
        );

        return;
      }

      const cleanPhone = phone.replace(/\D/g, "");
      const fullPhone = countryCode === "+234"
        ? toNigeriaE164(phone)
        : cleanPhone ? `${countryCode}${cleanPhone.replace(/^0+/, "")}` : null;
      if (!fullPhone || (countryCode !== "+234" && !/^\+\d{8,15}$/.test(fullPhone))) {
        setError(countryCode === "+234"
          ? "Enter a valid Nigerian phone number (11 digits, starting with 0)."
          : "Enter a valid phone number for the selected country.");
        return;
      }
      if (isNotStudent && selectedRole === "vendor") {
        setError("A student university account is required to sell on CampusMart.");
        return;
      }

      setLoading(true);

      try {
        const result =
          await register({
            name,
            email,
            password,

            role:
              selectedRole,

            phone:
              fullPhone,

            bio: "",

            universityId:
              (isOtherUniversity || isNotStudent)
                ? null
                : universityChoice,

            matricNumber:
              !isOtherUniversity
                ? matricNumber
                : "",

            fallbackUniversityName:
              isOtherUniversity
                ? fallbackUniversityName
                : "",

            fallbackState:
              isOtherUniversity
                ? fallbackState
                : "",

            fallbackCity:
              isOtherUniversity
                ? fallbackCity
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
          if (
            result.code ===
            "INVALID_FORMAT"
          ) {
            setMatricFailedAttempts(
              (
                attempts
              ) =>
                attempts +
                1
            );

            if (
              result.matricFormatHint
            ) {
              setMatricFormatHint(
                result.matricFormatHint
              );
            }
          }

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

  const visibleMatricHint =
    matricFailedAttempts >=
      3
      ? matricFormatHint ||
        selectedUniversity
          ?.matricFormatHint ||
        null
      : null;

  return (
    <div
      className="fixed inset-0 z-[999] flex items-start justify-center overflow-y-auto overscroll-contain px-4 py-6 sm:py-8"
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

      <div className="relative my-auto max-h-[calc(100dvh-3rem)] w-full max-w-lg overflow-y-auto overscroll-contain rounded-2xl bg-white shadow-2xl animate-[modalIn_0.18s_ease-out] sm:max-h-[calc(100dvh-4rem)]">
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

        <div className="p-6 sm:p-9">
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
              : "Join your university marketplace and discover students around you."}
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
                Buyer
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
                Seller
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

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div>
                    <p className="text-sm font-bold text-black">
                      Your university
                    </p>

                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      We use this to
                      keep your
                      marketplace
                      relevant to your
                      campus.
                    </p>
                  </div>

                  <label className="mt-4 block text-sm font-semibold text-slate-700">
                    Find by state (optional)
                    <select
                      value={universityStateFilter}
                      onChange={(event) => {
                        setUniversityStateFilter(event.target.value);
                        handleUniversityChange("");
                        setUniversitySearch("");
                      }}
                      className="mt-1.5 w-full rounded-[10px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-black"
                    >
                      <option value="">All states and FCT</option>
                      {NIGERIAN_STATES.map((state) => (
                        <option key={state} value={state}>{state}</option>
                      ))}
                    </select>
                  </label>

                  <div
                    className="mt-3"
                    onBlur={(event) => {
                      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                        setShowUniversitySuggestions(false);
                      }
                    }}
                  >
                    <p className="text-sm font-semibold text-slate-700">
                      Search and choose your institution
                    </p>
                    {selectedUniversity ? (
                      <div className="mt-1.5 flex items-center justify-between gap-2 rounded-[10px] border border-emerald-200 bg-emerald-50 px-3 py-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-emerald-900">
                            {selectedUniversity.name}
                          </p>
                          <p className="text-xs text-emerald-800">
                            {institutionDisplayCode(selectedUniversity)} · {selectedUniversity.state}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            handleUniversityChange("");
                            setUniversitySearch("");
                            setShowUniversitySuggestions(true);
                          }}
                          className="shrink-0 rounded-lg border border-emerald-300 bg-white px-3 py-2 text-xs font-bold text-emerald-900 hover:bg-emerald-100"
                        >
                          Change
                        </button>
                      </div>
                    ) : (
                      <>
                        <input
                          type="search"
                          role="combobox"
                          aria-autocomplete="list"
                          aria-expanded={shouldShowSuggestions}
                          aria-controls="signup-institution-suggestions"
                          aria-activedescendant={shouldShowSuggestions && keyboardSuggestions.length > 0 ? `signup-institution-${activeSuggestionIndex}` : undefined}
                          autoComplete="off"
                          value={universitySearch}
                          onFocus={() => setShowUniversitySuggestions(true)}
                          onChange={(event) => {
                            // A typed change cannot leave an old institution selected.
                            if (universityChoice) handleUniversityChange("");
                            setUniversitySearch(event.target.value);
                            setActiveSuggestionIndex(0);
                            setShowUniversitySuggestions(true);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Escape") {
                              event.stopPropagation();
                              setShowUniversitySuggestions(false);
                            }
                            if (!shouldShowSuggestions || !keyboardSuggestions.length) return;
                            if (event.key === "ArrowDown") {
                              event.preventDefault();
                              setActiveSuggestionIndex((index) =>
                                Math.min(index + 1, keyboardSuggestions.length - 1));
                            } else if (event.key === "ArrowUp") {
                              event.preventDefault();
                              setActiveSuggestionIndex((index) => Math.max(index - 1, 0));
                            } else if (event.key === "Enter") {
                              event.preventDefault();
                              const picked = keyboardSuggestions[activeSuggestionIndex];
                              if (picked) {
                                if (picked.state !== universityStateFilter) {
                                  setUniversityStateFilter(picked.state);
                                }
                                handleUniversityChange(picked.id);
                                setUniversitySearch(picked.name);
                              }
                            }
                          }}
                          placeholder="Search by name or acronym, e.g. ABSU, UNIPORT"
                          className="mt-1.5 w-full rounded-[10px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-black focus:ring-2 focus:ring-accent-200"
                        />
                        {shouldShowSuggestions ? (
                          <div
                            id="signup-institution-suggestions"
                            role="listbox"
                            aria-label="Matching institutions"
                            className="mt-1.5 max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-sm"
                          >
                            {visibleSuggestions.length ? (
                              visibleSuggestions.map((university, index) => (
                                <button
                                  id={`signup-institution-${index}`}
                                  role="option"
                                  aria-selected={index === activeSuggestionIndex}
                                  key={university.id}
                                  type="button"
                                  onMouseDown={(event) => event.preventDefault()}
                                  onClick={() => {
                                    handleUniversityChange(university.id);
                                    setUniversitySearch(university.name);
                                  }}
                                  className={`block w-full border-b border-slate-100 px-3 py-2.5 text-left last:border-0 hover:bg-amber-50 ${index === activeSuggestionIndex ? "bg-amber-50" : ""}`}
                                >
                                  <span className="block text-sm font-semibold text-slate-900">
                                    {university.name}
                                  </span>
                                  <span className="block text-xs text-slate-500">
                                    {institutionDisplayCode(university)} · {university.state}
                                  </span>
                                </button>
                              ))
                            ) : (
                              <p className="px-3 py-3 text-xs text-slate-600">
                                No matching institutions{universityStateFilter ? ` in ${universityStateFilter}` : ""}.
                                {elsewhereSuggestions.length
                                  ? " Matching institutions were found in other states:"
                                  : " Try another name or select Other below."}
                              </p>
                            )}
                            {!visibleSuggestions.length && elsewhereSuggestions.map((university, index) => (
                              <button
                                id={`signup-institution-${index}`}
                                key={university.id}
                                role="option"
                                aria-selected={index === activeSuggestionIndex}
                                type="button"
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => {
                                  setUniversityStateFilter(university.state);
                                  handleUniversityChange(university.id);
                                  setUniversitySearch(university.name);
                                }}
                                className={`block w-full border-b border-slate-100 px-3 py-2.5 text-left last:border-0 hover:bg-amber-50 ${index === activeSuggestionIndex ? "bg-amber-50" : ""}`}
                              >
                                <span className="block text-sm font-semibold text-slate-900">
                                  {university.name}
                                </span>
                                <span className="block text-xs text-slate-500">
                                  {institutionDisplayCode(university)} · {university.state} · Change state to select
                                </span>
                              </button>
                            ))}
                            {filteredUniversities.length > visibleSuggestions.length ? (
                              <p className="border-t border-slate-100 px-3 py-2 text-xs text-slate-500">
                                Showing {visibleSuggestions.length} of {filteredUniversities.length}. Type more letters to narrow the list.
                              </p>
                            ) : null}
                          </div>
                        ) : null}
                      </>
                    )}
                  </div>

                  <label className="mt-3 block text-sm font-semibold text-slate-700">
                    Other
                    <select
                      name="otherInstitutionChoice"
                      value={isOtherUniversity || isNotStudent ? universityChoice : ""}
                      onChange={(event) => {
                        handleUniversityChange(event.target.value);
                        setUniversitySearch("");
                      }}
                      className="mt-1.5 w-full rounded-[10px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-black"
                    >
                      <option value="">Select only if needed</option>
                      <option value={NOT_A_STUDENT}>I am not a student</option>
                      <option value={OTHER_UNIVERSITY}>My university isn't listed</option>
                    </select>
                  </label>

                  {universitiesError ? (
                    <p className="mt-2 text-xs font-medium leading-5 text-amber-700">
                      {
                        universitiesError
                      }
                    </p>
                  ) : null}

                  {selectedUniversity ? (
                    <div className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5">
                      <p className="text-xs font-semibold text-slate-700">
                        {
                          selectedUniversity.city
                        }
                        ,{" "}
                        {
                          selectedUniversity.state
                        }
                      </p>

                      {selectedRole ===
                      "vendor" ? (
                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          Your student
                          details will
                          be associated
                          with this
                          university for
                          verification.
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  {isOtherUniversity ? (
                    <div className="mt-4 space-y-4">
                      <label className="block text-sm font-semibold text-slate-700">
                        University name

                        <input
                          type="text"
                          name="fallbackUniversityName"
                          autoComplete="organization"
                          required
                          value={
                            fallbackUniversityName
                          }
                          onChange={(
                            event
                          ) =>
                            setFallbackUniversityName(
                              event
                                .target
                                .value
                            )
                          }
                          className="mt-1.5 w-full rounded-[10px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-black focus:ring-2 focus:ring-accent-200"
                          placeholder="Enter your university"
                        />
                      </label>

                      <label className="block text-sm font-semibold text-slate-700">
                        State

                        <select
                          name="fallbackState"
                          required
                          value={
                            fallbackState
                          }
                          onChange={(
                            event
                          ) =>
                            (setFallbackState(event.target.value), setFallbackCity(""))
                          }
                          className="mt-1.5 w-full rounded-[10px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-black focus:ring-2 focus:ring-accent-200"
                        >
                          <option value="">
                            Select
                            state
                          </option>

                          {NIGERIAN_STATES.map(
                            (
                              state
                            ) => (
                              <option
                                key={
                                  state
                                }
                                value={
                                  state
                                }
                              >
                                {
                                  state
                                }
                              </option>
                            )
                          )}
                        </select>
                      </label>

                      <label className="block text-sm font-semibold text-slate-700">
                        City or area

                        <input
                          type="text"
                          name="fallbackCity"
                          autoComplete="address-level2"
                          required
                          value={
                            fallbackCity
                          }
                          onChange={(
                            event
                          ) =>
                            setFallbackCity(
                              event
                                .target
                                .value
                            )
                          }
                          className="mt-1.5 w-full rounded-[10px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-black focus:ring-2 focus:ring-accent-200"
                          placeholder="Select a city, or enter another"
                          list="signup-city-list"
                        />
                        <datalist id="signup-city-list">
                          {(NIGERIA_LOCATIONS[fallbackState] || []).map(city => <option key={city} value={city} />)}
                        </datalist>
                      </label>

                      {selectedRole ===
                      "vendor" ? (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3">
                          <p className="text-xs font-bold text-amber-900">
                            Seller review
                            required
                          </p>

                          <p className="mt-1 text-xs leading-5 text-amber-800">
                            Because your
                            university is
                            not yet listed,
                            you can create
                            your CampusMart
                            account and buy
                            normally, but
                            selling will be
                            unavailable
                            until CampusMart
                            reviews your
                            seller access.
                          </p>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {!isOtherUniversity &&
                  selectedUniversity ? (
                    <label className="mt-4 block text-sm font-semibold text-slate-700">
                      Matric number

                      <input
                        type="text"
                        name="matricNumber"
                        autoComplete="off"
                        required
                        value={
                          matricNumber
                        }
                        onChange={(
                          event
                        ) => {
                          setMatricNumber(
                            event
                              .target
                              .value
                          );

                          setError(
                            ""
                          );
                        }}
                        className="mt-1.5 w-full rounded-[10px] border border-slate-200 bg-white px-4 py-3 text-sm uppercase text-slate-900 outline-none transition focus:border-black focus:ring-2 focus:ring-accent-200"
                        placeholder={`Enter your ${selectedUniversity.shortName} matric number`}
                      />

                      <p className="mt-1.5 text-xs leading-5 text-slate-500">
                        Enter your matric
                        number as it appears
                        on your student
                        record. We ignore
                        spaces and letter
                        case, but your
                        identity details
                        themselves are not
                        guessed or corrected.
                      </p>
                      {visibleMatricHint && <p className="mt-1 flex items-center gap-1 text-xs text-red-600"><span aria-hidden="true">ⓘ</span> {visibleMatricHint}</p>}
                    </label>
                  ) : null}
                </div>

                <label className="block text-sm font-semibold text-slate-700">
                  Phone number


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
                      required
                      value={phone}
                      maxLength={countryCode === "+234" ? 13 : 20}
                      onChange={(event) => setPhone(countryCode === "+234"
                        ? formatNigerianNationalInput(event.target.value)
                        : event.target.value.replace(/[^0-9]/g, ""))}
                      className="min-w-0 flex-1 rounded-[10px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-black focus:bg-white focus:ring-2 focus:ring-accent-200"
                      placeholder={countryCode === "+234" ? "0909 123 4567" : "Phone number"}
                    />
                  </div>
                </label>

                {selectedRole ===
                "vendor" ? (
                  <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div>
                      <p className="text-sm font-bold text-black">
                        Set up your shop
                      </p>

                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        Tell students
                        what you sell
                        and where
                        purchases can
                        be collected.
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
                ) : null}
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
                  : selectedRole ===
                      "vendor" &&
                    isOtherUniversity
                    ? "Create account for review"
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