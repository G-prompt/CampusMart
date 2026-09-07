"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type Role = "vendor" | "client";
export type AuthMode = "login" | "register";
export type UserProfile = { name: string; role: Role; email: string };

type AuthContextValue = {
  user: UserProfile | null;
  isAuthenticated: boolean;
  authOpen: boolean;
  authMode: AuthMode;
  openAuth: (mode?: AuthMode, roleHint?: Role) => void;
  closeAuth: () => void;
  roleHint: Role;
  login: (email: string, password: string, role: Role) => void;
  register: (data: { name: string; email: string; password: string; role: Role }) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredUser(): UserProfile | null {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem("campusmart-user");
  if (!stored) return null;
  try {
    return JSON.parse(stored) as UserProfile;
  } catch {
    localStorage.removeItem("campusmart-user");
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [roleHint, setRoleHint] = useState<Role>("client");

  useEffect(() => {
    setUser(readStoredUser());
    const onStorage = () => setUser(readStoredUser());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const openAuth = useCallback((mode: AuthMode = "login", role?: Role) => {
    setAuthMode(mode);
    if (role) setRoleHint(role);
    setAuthOpen(true);
  }, []);

  const closeAuth = useCallback(() => setAuthOpen(false), []);

  const persistUser = useCallback((profile: UserProfile) => {
    localStorage.setItem("campusmart-user", JSON.stringify(profile));
    localStorage.setItem("campusmart-auth", "true");
    setUser(profile);
    setAuthOpen(false);
  }, []);

  const login = useCallback(
    (email: string, _password: string, role: Role) => {
      persistUser({ name: email.split("@")[0].replace(/[._-]/g, " ") || "Student", role, email });
    },
    [persistUser]
  );

  const register = useCallback(
    (data: { name: string; email: string; password: string; role: Role }) => {
      persistUser({ name: data.name, role: data.role, email: data.email });
    },
    [persistUser]
  );

  const logout = useCallback(() => {
    localStorage.removeItem("campusmart-user");
    localStorage.removeItem("campusmart-auth");
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, isAuthenticated: Boolean(user), authOpen, authMode, openAuth, closeAuth, roleHint, login, register, logout }),
    [user, authOpen, authMode, openAuth, closeAuth, roleHint, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
