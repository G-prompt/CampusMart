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

export type UserProfile = {
  id: string;
  name: string;
  role: Role;
  email: string;
};

type AuthResult = {
  success: boolean;
  message?: string;
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

  register: (data: {
    name: string;
    email: string;
    password: string;
    role: Role;
  }) => Promise<AuthResult>;

  logout: () => void;
};

const AuthContext =
  createContext<AuthContextValue | null>(null);

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "http://localhost:5000";

function readStoredUser(): UserProfile | null {
  if (typeof window === "undefined") {
    return null;
  }

  const stored =
    localStorage.getItem("campusmart-user");

  if (!stored) {
    return null;
  }

  try {
    return JSON.parse(stored) as UserProfile;
  } catch {
    localStorage.removeItem("campusmart-user");
    localStorage.removeItem("campusmart-token");

    return null;
  }
}

export function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] =
    useState<UserProfile | null>(null);

  const [authOpen, setAuthOpen] =
    useState(false);

  const [authMode, setAuthMode] =
    useState<AuthMode>("login");

  const [roleHint, setRoleHint] =
    useState<Role>("client");

  useEffect(() => {
    setUser(readStoredUser());

    const onStorage = () => {
      setUser(readStoredUser());
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

  const persistSession = useCallback(
    (
      profile: UserProfile,
      token: string
    ) => {
      localStorage.setItem(
        "campusmart-user",
        JSON.stringify(profile)
      );

      localStorage.setItem(
        "campusmart-token",
        token
      );

      localStorage.setItem(
        "campusmart-auth",
        "true"
      );

      setUser(profile);
      setAuthOpen(false);
    },
    []
  );

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
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              email,
              password,
            }),
          }
        );

        const data =
          await response.json();

        if (!response.ok) {
          return {
            success: false,
            message:
              data.message ||
              "Login failed.",
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

  const register = useCallback(
    async (data: {
      name: string;
      email: string;
      password: string;
      role: Role;
    }): Promise<AuthResult> => {
      try {
        const response = await fetch(
          `${API_URL}/api/auth/register`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify(data),
          }
        );

        const result =
          await response.json();

        if (!response.ok) {
          return {
            success: false,
            message:
              result.message ||
              "Registration failed.",
          };
        }

        const loginResult =
          await login(
            data.email,
            data.password
          );

        if (!loginResult.success) {
          return {
            success: false,
            message:
              "Account created, but automatic login failed.",
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
          success: false,
          message:
            "Unable to connect to the server.",
        };
      }
    },
    [login]
  );

  const logout = useCallback(() => {
    localStorage.removeItem(
      "campusmart-user"
    );

    localStorage.removeItem(
      "campusmart-token"
    );

    localStorage.removeItem(
      "campusmart-auth"
    );

    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      authOpen,
      authMode,
      openAuth,
      closeAuth,
      roleHint,
      login,
      register,
      logout,
    }),
    [
      user,
      authOpen,
      authMode,
      openAuth,
      closeAuth,
      roleHint,
      login,
      register,
      logout,
    ]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context =
    useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used within an AuthProvider"
    );
  }

  return context;
}