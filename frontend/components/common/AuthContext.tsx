"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type Role = "vendor" | "client";
export type AuthMode = "login" | "register";

export type StudentVerificationStatus =
  | "not_started"
  | "pending"
  | "verified"
  | "failed";

export type VendorVerificationStatus =
  | "not_started"
  | "pending"
  | "verified"
  | "rejected";

export type VendorAccessStatus =
  | "active"
  | "pending_review"
  | "restricted"
  | "suspended";

export type UniversityVerificationMethod =
  | "none"
  | "manual"
  | "database"
  | "api";

export type UniversitySummary = {
  id: string;
  name: string;
  shortName: string;
  slug: string;
  country: string;
  state: string;
  city: string;
  studentVerificationEnabled: boolean;
  verificationMethod: UniversityVerificationMethod;
  matricValidationEnabled: boolean;
  matricFormatHint: string | null;
};

export type UserProfile = {
  id: string;
  name: string;
  role: Role;
  email: string;

  campus?: string;
  phone?: string;
  bio?: string;
  avatarUrl?: string;

  universityId?: string;
  university?: UniversitySummary | null;
  matricNumber?: string;

  studentVerificationStatus?: StudentVerificationStatus;
  studentVerificationSource?: string;
  studentVerifiedAt?: string;

  fallbackUniversityName?: string;
  fallbackState?: string;
  fallbackCity?: string;

  businessName?: string;
  businessDescription?: string;
  pickupLocation?: string;

  vendorVerified?: boolean;
  vendorAccessStatus?: VendorAccessStatus;
  vendorVerificationStatus?: VendorVerificationStatus;
  verificationSubmittedAt?: string;
  vendorVerifiedAt?: string;
};

export type RegistrationData = {
  name: string;
  email: string;
  password: string;
  role: Role;
  phone?: string;
  bio?: string;

  universityId: string | null;
  matricNumber?: string;

  fallbackUniversityName?: string;
  fallbackState?: string;
  fallbackCity?: string;

  businessName?: string;
  businessDescription?: string;
  pickupLocation?: string;
};

export type AuthResult = {
  success: boolean;
  message?: string;
  code?: string;
  matricFormatHint?: string | null;
};

type ApiVendorProfile = {
  id?: string;
  businessName?: string | null;
  businessDescription?: string | null;
  pickupLocation?: string | null;
  verified?: boolean;
  accessStatus?: VendorAccessStatus | null;
  vendorVerificationStatus?:
    | VendorVerificationStatus
    | null;
  verificationSubmittedAt?: string | null;
  vendorVerifiedAt?: string | null;
};

type ApiUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  campus?: string | null;
  phone?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;

  universityId?: string | null;
  university?: UniversitySummary | null;
  matricNumber?: string | null;

  studentVerificationStatus?:
    | StudentVerificationStatus
    | null;
  studentVerificationSource?: string | null;
  studentVerifiedAt?: string | null;

  fallbackUniversityName?: string | null;
  fallbackState?: string | null;
  fallbackCity?: string | null;

  vendorProfile?: ApiVendorProfile | null;
  createdAt?: string;
};

type AuthContextValue = {
  user: UserProfile | null;
  isAuthenticated: boolean;

  authOpen: boolean;
  authMode: AuthMode;
  roleHint: Role;

  openAuth: (mode?: AuthMode, roleHint?: Role) => void;
  closeAuth: () => void;

  login: (
    email: string,
    password: string
  ) => Promise<AuthResult>;

  register: (
    data: RegistrationData
  ) => Promise<AuthResult>;

  refreshSession: () => Promise<AuthResult>;
  logout: () => void;

  updateProfile: (
    updates: Partial<Omit<UserProfile, "email" | "role">>
  ) => void;

  changePassword: (
    currentPassword: string,
    newPassword: string
  ) => Promise<AuthResult>;
};

const AuthContext = createContext<AuthContextValue | null>(
  null
);

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:5000";

const USER_STORAGE_KEY = "campusmart-user";
const TOKEN_STORAGE_KEY = "campusmart-token";
const AUTH_STORAGE_KEY = "campusmart-auth";

function normalizeUser(user: ApiUser): UserProfile {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,

    campus: user.campus || undefined,
    phone: user.phone || undefined,
    bio: user.bio || undefined,
    avatarUrl: user.avatarUrl || undefined,

    universityId: user.universityId || undefined,
    university: user.university ?? null,
    matricNumber: user.matricNumber || undefined,

    studentVerificationStatus:
      user.studentVerificationStatus || undefined,
    studentVerificationSource:
      user.studentVerificationSource || undefined,
    studentVerifiedAt:
      user.studentVerifiedAt || undefined,

    fallbackUniversityName:
      user.fallbackUniversityName || undefined,
    fallbackState: user.fallbackState || undefined,
    fallbackCity: user.fallbackCity || undefined,

    businessName:
      user.vendorProfile?.businessName || undefined,
    businessDescription:
      user.vendorProfile?.businessDescription || undefined,
    pickupLocation:
      user.vendorProfile?.pickupLocation || undefined,

    vendorVerified:
      user.vendorProfile?.verified ?? false,
    vendorAccessStatus:
      user.vendorProfile?.accessStatus || undefined,
    vendorVerificationStatus:
      user.vendorProfile?.vendorVerificationStatus ||
      undefined,

    verificationSubmittedAt:
      user.vendorProfile?.verificationSubmittedAt ||
      undefined,

    vendorVerifiedAt:
      user.vendorProfile?.vendorVerifiedAt || undefined,
  };
}

function readStoredUser(): UserProfile | null {
  if (typeof window === "undefined") {
    return null;
  }

  const stored = localStorage.getItem(USER_STORAGE_KEY);

  if (!stored) {
    return null;
  }

  try {
    return JSON.parse(stored) as UserProfile;
  } catch {
    localStorage.removeItem(USER_STORAGE_KEY);
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
}

export function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<UserProfile | null>(
    null
  );

  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] =
    useState<AuthMode>("login");
  const [roleHint, setRoleHint] =
    useState<Role>("client");

  /*
   * =====================================================
   * SESSION HELPERS
   * =====================================================
   */

  const clearSession = useCallback(() => {
    localStorage.removeItem(USER_STORAGE_KEY);
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(AUTH_STORAGE_KEY);
    setUser(null);
  }, []);

  const persistUser = useCallback((apiUser: ApiUser) => {
    const profile = normalizeUser(apiUser);

    localStorage.setItem(
      USER_STORAGE_KEY,
      JSON.stringify(profile)
    );

    localStorage.setItem(AUTH_STORAGE_KEY, "true");
    setUser(profile);

    return profile;
  }, []);

  const persistSession = useCallback(
    (apiUser: ApiUser, token: string) => {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
      persistUser(apiUser);
      setAuthOpen(false);
    },
    [persistUser]
  );

  /*
   * =====================================================
   * RESTORE CACHED SESSION
   * =====================================================
   */

  useEffect(() => {
    setUser(readStoredUser());

    const onStorage = () => {
      setUser(readStoredUser());
    };

    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  /*
   * =====================================================
   * AUTH MODAL
   * =====================================================
   */

  const openAuth = useCallback(
    (
      mode: AuthMode = "login",
      role?: Role
    ) => {
      setAuthMode(mode);

      if (role) {
        setRoleHint(role);
      }

      setAuthOpen(true);
    },
    []
  );

  const closeAuth = useCallback(() => {
    setAuthOpen(false);
  }, []);

  /*
   * =====================================================
   * LOGIN
   * =====================================================
   */

  const login = useCallback(
    async (
      email: string,
      password: string
    ): Promise<AuthResult> => {
      try {
        const response = await fetch(
          `${API_URL}/api/auth/login`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              email,
              password,
            }),
          }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
          return {
            success: false,
            message: data.message || "Login failed.",
            code: data.code,
          };
        }

        if (!data.user || !data.token) {
          return {
            success: false,
            message:
              "The server returned an invalid login response.",
          };
        }

        persistSession(data.user, data.token);

        return {
          success: true,
          message: data.message,
        };
      } catch (error) {
        console.error("Login request failed:", error);

        return {
          success: false,
          message: "Unable to connect to the server.",
        };
      }
    },
    [persistSession]
  );

  /*
   * =====================================================
   * REGISTER
   * =====================================================
   */

  const register = useCallback(
    async (data: RegistrationData): Promise<AuthResult> => {
      try {
        const payload = {
          name: data.name.trim(),
          email: data.email.trim().toLowerCase(),
          password: data.password,
          role: data.role,

          phone: data.phone?.trim() || "",

          bio:
            data.role === "client"
              ? data.bio?.trim() || ""
              : "",

          universityId: data.universityId,
          matricNumber: data.matricNumber?.trim() || "",

          fallbackUniversityName: data.universityId
            ? ""
            : data.fallbackUniversityName?.trim() || "",

          fallbackState: data.universityId
            ? ""
            : data.fallbackState?.trim() || "",

          fallbackCity: data.universityId
            ? ""
            : data.fallbackCity?.trim() || "",

          businessName:
            data.role === "vendor"
              ? data.businessName?.trim() || ""
              : "",

          businessDescription:
            data.role === "vendor"
              ? data.businessDescription?.trim() || ""
              : "",

          pickupLocation:
            data.role === "vendor"
              ? data.pickupLocation?.trim() || ""
              : "",
        };

        const response = await fetch(
          `${API_URL}/api/auth/register`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
          }
        );

        const result = await response.json();

        if (!response.ok || !result.success) {
          return {
            success: false,
            message:
              result.message || "Registration failed.",
            code: result.code,
            matricFormatHint:
              result.matricFormatHint ?? null,
          };
        }

        const loginResult = await login(
          payload.email,
          data.password
        );

        if (!loginResult.success) {
          return {
            success: false,
            message:
              "Your account was created, but automatic login failed. Please sign in.",
          };
        }

        return {
          success: true,
          message:
            result.message || "Account created successfully.",
        };
      } catch (error) {
        console.error("Registration request failed:", error);

        return {
          success: false,
          message: "Unable to connect to the server.",
        };
      }
    },
    [login]
  );

  /*
   * =====================================================
   * REFRESH SESSION
   * =====================================================
   */

  const refreshSession = useCallback(
    async (): Promise<AuthResult> => {
      const token = localStorage.getItem(TOKEN_STORAGE_KEY);

      if (!token) {
        clearSession();

        return {
          success: false,
          message:
            "Your session is unavailable. Please sign in again.",
        };
      }

      try {
        const response = await fetch(
          `${API_URL}/api/auth/me`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            cache: "no-store",
          }
        );

        const data = await response.json();

        if (response.status === 401) {
          clearSession();

          return {
            success: false,
            message:
              data.message ||
              "Your session has expired. Please sign in again.",
            code: data.code,
          };
        }

        if (!response.ok || !data.success) {
          return {
            success: false,
            message:
              data.message || "Unable to refresh your account.",
            code: data.code,
          };
        }

        if (!data.user) {
          return {
            success: false,
            message:
              "The server returned an invalid account response.",
          };
        }

        persistUser(data.user);

        return {
          success: true,
          message: "Account refreshed.",
        };
      } catch (error) {
        console.error("Session refresh failed:", error);

        return {
          success: false,
          message: "Unable to refresh your account.",
        };
      }
    },
    [clearSession, persistUser]
  );

  /*
   * =====================================================
   * LOGOUT
   * =====================================================
   */

  const logout = useCallback(() => {
    clearSession();
  }, [clearSession]);

  /*
   * =====================================================
   * LOCAL PROFILE CACHE
   * =====================================================
   *
   * The AccountPanel saves name and phone through
   * PATCH /api/auth/profile before updating this cache.
   */

  const updateProfile = useCallback(
    (
      updates: Partial<
        Omit<UserProfile, "email" | "role">
      >
    ) => {
      if (!user) return;

      const next = {
        ...user,
        ...updates,
      };

      localStorage.setItem(
        USER_STORAGE_KEY,
        JSON.stringify(next)
      );

      setUser(next);
    },
    [user]
  );

  /*
   * =====================================================
   * CHANGE PASSWORD
   * =====================================================
   */

  const changePassword = useCallback(
    async (
      currentPassword: string,
      newPassword: string
    ): Promise<AuthResult> => {
      const token = localStorage.getItem(TOKEN_STORAGE_KEY);

      if (!token) {
        clearSession();

        return {
          success: false,
          message: "Please sign in again.",
        };
      }

      try {
        const response = await fetch(
          `${API_URL}/api/auth/change-password`,
          {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              currentPassword,
              newPassword,
            }),
          }
        );

        const data = await response.json().catch(() => null);

        if (!response.ok || !data?.success) {
          if (response.status === 401 &&
              data?.code === "SESSION_EXPIRED") {
            clearSession();
          }

          return {
            success: false,
            code: data?.code,
            message:
              data?.message || "Unable to change password.",
          };
        }

        /*
         * Backend password hash has changed.
         * All old tokens, including this one, are invalid.
         */
        clearSession();

        window.dispatchEvent(
          new CustomEvent("campusmart-toast", {
            detail: {
              message:
                "Password updated. Sign in with your new password.",
            },
          })
        );

        setAuthMode("login");
        setAuthOpen(true);

        return {
          success: true,
          code: "PASSWORD_CHANGED",
          message:
            "Password updated. Sign in with your new password.",
        };
      } catch (error) {
        console.error("Change password request failed:", error);

        return {
          success: false,
          message:
            "Unable to connect to the server. Your password may not have changed.",
        };
      }
    },
    [clearSession]
  );

  /*
   * =====================================================
   * CONTEXT
   * =====================================================
   */

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user),

      authOpen,
      authMode,
      roleHint,

      openAuth,
      closeAuth,

      login,
      register,
      refreshSession,
      logout,

      updateProfile,
      changePassword,
    }),
    [
      user,
      authOpen,
      authMode,
      roleHint,
      openAuth,
      closeAuth,
      login,
      register,
      refreshSession,
      logout,
      updateProfile,
      changePassword,
    ]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used within an AuthProvider"
    );
  }

  return context;
}