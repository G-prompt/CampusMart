"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type Role =
  | "vendor"
  | "client";

export type AuthMode =
  | "login"
  | "register";

export type UserProfile = {
  id: string;
  name: string;
  role: Role;
  email: string;

  campus?: string;
  phone?: string;
  bio?: string;

  avatarUrl?: string;

  businessName?: string;
  businessDescription?: string;
  pickupLocation?: string;

  vendorVerified?: boolean;
};

export type RegistrationData = {
  name: string;
  email: string;
  password: string;
  role: Role;

  campus: string;
  phone?: string;
  bio?: string;

  businessName?: string;
  businessDescription?: string;
  pickupLocation?: string;
};

type AuthResult = {
  success: boolean;
  message?: string;
};

type ApiVendorProfile = {
  id?: string;
  businessName?: string | null;
  businessDescription?: string | null;
  pickupLocation?: string | null;
  verified?: boolean;
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

  vendorProfile?: ApiVendorProfile | null;

  createdAt?: string;
};

type AuthContextValue = {
  user: UserProfile | null;

  isAuthenticated: boolean;

  authOpen: boolean;
  authMode: AuthMode;
  roleHint: Role;

  openAuth: (
    mode?: AuthMode,
    roleHint?: Role
  ) => void;

  closeAuth: () => void;

  login: (
    email: string,
    password: string
  ) => Promise<AuthResult>;

  register: (
    data: RegistrationData
  ) => Promise<AuthResult>;

  logout: () => void;

  updateProfile: (
    updates: Partial<
      Omit<
        UserProfile,
        "email" | "role"
      >
    >
  ) => void;

  changePassword: (
    currentPassword: string,
    newPassword: string
  ) => boolean;
};

const AuthContext =
  createContext<AuthContextValue | null>(
    null
  );

const API_URL =
  process.env
    .NEXT_PUBLIC_API_URL ||
  "http://localhost:5000";

const USER_STORAGE_KEY =
  "campusmart-user";

const TOKEN_STORAGE_KEY =
  "campusmart-token";

const AUTH_STORAGE_KEY =
  "campusmart-auth";

function normalizeUser(
  user: ApiUser
): UserProfile {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,

    campus:
      user.campus ||
      undefined,

    phone:
      user.phone ||
      undefined,

    bio:
      user.bio ||
      undefined,

    avatarUrl:
      user.avatarUrl ||
      undefined,

    businessName:
      user.vendorProfile
        ?.businessName ||
      undefined,

    businessDescription:
      user.vendorProfile
        ?.businessDescription ||
      undefined,

    pickupLocation:
      user.vendorProfile
        ?.pickupLocation ||
      undefined,

    vendorVerified:
      user.vendorProfile
        ?.verified ??
      false,
  };
}

function readStoredUser():
  | UserProfile
  | null {
  if (
    typeof window ===
    "undefined"
  ) {
    return null;
  }

  const stored =
    localStorage.getItem(
      USER_STORAGE_KEY
    );

  if (!stored) {
    return null;
  }

  try {
    return JSON.parse(
      stored
    ) as UserProfile;
  } catch {
    localStorage.removeItem(
      USER_STORAGE_KEY
    );

    localStorage.removeItem(
      TOKEN_STORAGE_KEY
    );

    localStorage.removeItem(
      AUTH_STORAGE_KEY
    );

    return null;
  }
}

export function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [
    user,
    setUser,
  ] =
    useState<UserProfile | null>(
      null
    );

  const [
    authOpen,
    setAuthOpen,
  ] =
    useState(false);

  const [
    authMode,
    setAuthMode,
  ] =
    useState<AuthMode>(
      "login"
    );

  const [
    roleHint,
    setRoleHint,
  ] =
    useState<Role>(
      "client"
    );

  useEffect(() => {
    setUser(
      readStoredUser()
    );

    const onStorage = () => {
      setUser(
        readStoredUser()
      );
    };

    window.addEventListener(
      "storage",
      onStorage
    );

    return () => {
      window.removeEventListener(
        "storage",
        onStorage
      );
    };
  }, []);

  const openAuth =
    useCallback(
      (
        mode: AuthMode =
          "login",
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

  const closeAuth =
    useCallback(() => {
      setAuthOpen(false);
    }, []);

  const persistSession =
    useCallback(
      (
        apiUser: ApiUser,
        token: string
      ) => {
        const profile =
          normalizeUser(
            apiUser
          );

        localStorage.setItem(
          USER_STORAGE_KEY,
          JSON.stringify(
            profile
          )
        );

        localStorage.setItem(
          TOKEN_STORAGE_KEY,
          token
        );

        localStorage.setItem(
          AUTH_STORAGE_KEY,
          "true"
        );

        setUser(profile);

        setAuthOpen(false);
      },
      []
    );

  const login =
    useCallback(
      async (
        email: string,
        password: string
      ): Promise<AuthResult> => {
        try {
          const response =
            await fetch(
              `${API_URL}/api/auth/login`,
              {
                method:
                  "POST",

                headers: {
                  "Content-Type":
                    "application/json",
                },

                body:
                  JSON.stringify(
                    {
                      email,
                      password,
                    }
                  ),
              }
            );

          const data =
            await response.json();

          if (
            !response.ok ||
            !data.success
          ) {
            return {
              success:
                false,

              message:
                data.message ||
                "Login failed.",
            };
          }

          if (
            !data.user ||
            !data.token
          ) {
            return {
              success:
                false,

              message:
                "The server returned an invalid login response.",
            };
          }

          persistSession(
            data.user,
            data.token
          );

          return {
            success: true,
          };
        } catch (error) {
          console.error(
            "Login request failed:",
            error
          );

          return {
            success: false,

            message:
              "Unable to connect to the server.",
          };
        }
      },
      [persistSession]
    );

  const register =
    useCallback(
      async (
        data: RegistrationData
      ): Promise<AuthResult> => {
        try {
          const payload = {
            name:
              data.name.trim(),

            email:
              data.email
                .trim()
                .toLowerCase(),

            password:
              data.password,

            role:
              data.role,

            campus:
              data.campus.trim(),

            phone:
              data.phone?.trim() ||
              "",

            bio:
              data.role ===
              "client"
                ? data.bio?.trim() ||
                  ""
                : "",

            businessName:
              data.role ===
              "vendor"
                ? data.businessName?.trim() ||
                  ""
                : "",

            businessDescription:
              data.role ===
              "vendor"
                ? data.businessDescription?.trim() ||
                  ""
                : "",

            pickupLocation:
              data.role ===
              "vendor"
                ? data.pickupLocation?.trim() ||
                  ""
                : "",
          };

          const response =
            await fetch(
              `${API_URL}/api/auth/register`,
              {
                method:
                  "POST",

                headers: {
                  "Content-Type":
                    "application/json",
                },

                body:
                  JSON.stringify(
                    payload
                  ),
              }
            );

          const result =
            await response.json();

          if (
            !response.ok ||
            !result.success
          ) {
            return {
              success:
                false,

              message:
                result.message ||
                "Registration failed.",
            };
          }

          /*
           * Registration endpoint
           * creates the account.
           *
           * We then log in normally
           * so the frontend receives
           * a JWT and the complete
           * profile.
           */
          const loginResult =
            await login(
              payload.email,
              data.password
            );

          if (
            !loginResult.success
          ) {
            return {
              success:
                false,

              message:
                "Your account was created, but automatic login failed. Please sign in.",
            };
          }

          return {
            success: true,
          };
        } catch (error) {
          console.error(
            "Registration request failed:",
            error
          );

          return {
            success:
              false,

            message:
              "Unable to connect to the server.",
          };
        }
      },
      [login]
    );

  const logout =
    useCallback(() => {
      localStorage.removeItem(
        USER_STORAGE_KEY
      );

      localStorage.removeItem(
        TOKEN_STORAGE_KEY
      );

      localStorage.removeItem(
        AUTH_STORAGE_KEY
      );

      setUser(null);
    }, []);

  /*
   * This currently updates the
   * locally stored profile only.
   *
   * We can connect profile editing
   * to the backend separately.
   */
  const updateProfile =
    useCallback(
      (
        updates: Partial<
          Omit<
            UserProfile,
            "email" | "role"
          >
        >
      ) => {
        if (!user) {
          return;
        }

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
   * Password changing is not yet
   * connected to the backend.
   */
  const changePassword =
    useCallback(
      (
        _currentPassword: string,
        _newPassword: string
      ) => false,
      []
    );

  const value =
    useMemo(
      () => ({
        user,

        isAuthenticated:
          Boolean(user),

        authOpen,
        authMode,
        roleHint,

        openAuth,
        closeAuth,

        login,
        register,
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
        logout,
        updateProfile,
        changePassword,
      ]
    );

  return (
    <AuthContext.Provider
      value={value}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context =
    useContext(
      AuthContext
    );

  if (!context) {
    throw new Error(
      "useAuth must be used within an AuthProvider"
    );
  }

  return context;
}