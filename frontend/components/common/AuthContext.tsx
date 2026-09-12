"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type Role = "vendor" | "client";
export type AuthMode = "login" | "register";
export type UserProfile = {
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
};

type AuthContextValue = {
  user: UserProfile | null;
  isAuthenticated: boolean;
  authOpen: boolean;
  authMode: AuthMode;
  openAuth: (mode?: AuthMode, roleHint?: Role) => void;
  closeAuth: () => void;
  roleHint: Role;
  login: (email: string, password: string, role: Role) => void;
  register: (data: Omit<StoredAccount, never>) => void;
  logout: () => void;
  updateProfile: (updates: Partial<Omit<UserProfile, "email" | "role">>) => void;
  changePassword: (currentPassword: string, newPassword: string) => boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const ACCOUNTS_KEY = "campusmart-accounts";
type StoredAccount = UserProfile & { password: string };

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
    (email: string, password: string, _role: Role) => {
      const accounts = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) ?? "[]") as StoredAccount[];
      const account = accounts.find((item) => item.email.toLowerCase() === email.toLowerCase() && item.password === password);
      if (!account) return;
      const { password: _storedPassword, ...profile } = account;
      persistUser(profile);
    },
    [persistUser]
  );

  const register = useCallback(
    (data: StoredAccount) => {
      const accounts = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) ?? "[]") as StoredAccount[];
      if (accounts.some((item) => item.email.toLowerCase() === data.email.toLowerCase())) return;
      localStorage.setItem(ACCOUNTS_KEY, JSON.stringify([...accounts, data]));
      const { password: _password, ...profile } = data;
      persistUser(profile);
    },
    [persistUser]
  );

  const logout = useCallback(() => {
    localStorage.removeItem("campusmart-user");
    localStorage.removeItem("campusmart-auth");
    setUser(null);
  }, []);

  const updateProfile = useCallback((updates: Partial<Omit<UserProfile, "email" | "role">>) => {
    if (!user) return;
    const nextProfile = { ...user, ...updates };
    const accounts = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) ?? "[]") as StoredAccount[];
    const nextAccounts = accounts.map((account) => account.email.toLowerCase() === user.email.toLowerCase() ? { ...account, ...updates } : account);
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(nextAccounts));
    persistUser(nextProfile);
  }, [persistUser, user]);

  const changePassword = useCallback((currentPassword: string, newPassword: string) => {
    if (!user) return false;
    const accounts = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) ?? "[]") as StoredAccount[];
    const account = accounts.find((item) => item.email.toLowerCase() === user.email.toLowerCase());
    if (!account || account.password !== currentPassword) return false;
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts.map((item) => item.email.toLowerCase() === user.email.toLowerCase() ? { ...item, password: newPassword } : item)));
    return true;
  }, [user]);

  const value = useMemo(
    () => ({ user, isAuthenticated: Boolean(user), authOpen, authMode, openAuth, closeAuth, roleHint, login, register, logout, updateProfile, changePassword }),
    [user, authOpen, authMode, openAuth, closeAuth, roleHint, login, register, logout, updateProfile, changePassword]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
