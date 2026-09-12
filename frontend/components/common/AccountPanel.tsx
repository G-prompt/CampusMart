"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "./AuthContext";

const PREFS_KEY = "campusmart-account-preferences";

export default function AccountPanel({ title = "Profile", description = "Manage your CampusMart account details and preferences." }: { title?: string; description?: string }) {
  const { user, updateProfile, changePassword, logout, openAuth } = useAuth();
  const router = useRouter();
  const [name, setName] = useState(user?.name ?? "");
  const [campus, setCampus] = useState(user?.campus ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [bio, setBio] = useState(user?.bio ?? "");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl ?? "");
  const [businessName, setBusinessName] = useState(user?.businessName ?? "");
  const [businessDescription, setBusinessDescription] = useState(user?.businessDescription ?? "");
  const [pickupLocation, setPickupLocation] = useState(user?.pickupLocation ?? "");
  const [emailUpdates, setEmailUpdates] = useState(true);
  const [orderAlerts, setOrderAlerts] = useState(true);
  const [saved, setSaved] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");

  useEffect(() => {
    if (!user) return;
    setName(user.name);
    setCampus(user.campus ?? "");
    setPhone(user.phone ?? "");
    setBio(user.bio ?? "");
    setAvatarUrl(user.avatarUrl ?? "");
    setBusinessName(user.businessName ?? "");
    setBusinessDescription(user.businessDescription ?? "");
    setPickupLocation(user.pickupLocation ?? "");
    const stored = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}") as { emailUpdates?: boolean; orderAlerts?: boolean };
    setEmailUpdates(stored.emailUpdates ?? true);
    setOrderAlerts(stored.orderAlerts ?? true);
  }, [user]);

  const save = (event: FormEvent) => {
    event.preventDefault();
    updateProfile({ name: name.trim() || user?.name || "Student", campus: campus.trim(), phone: phone.trim(), bio: bio.trim(), avatarUrl: avatarUrl.trim(), businessName: businessName.trim(), businessDescription: businessDescription.trim(), pickupLocation: pickupLocation.trim() });
    localStorage.setItem(PREFS_KEY, JSON.stringify({ emailUpdates, orderAlerts }));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
  };

  const savePassword = (event: FormEvent) => {
    event.preventDefault();
    if (newPassword.length < 6) return setPasswordMessage("Use at least 6 characters for your new password.");
    if (newPassword !== confirmPassword) return setPasswordMessage("New passwords do not match.");
    if (!changePassword(currentPassword, newPassword)) return setPasswordMessage("Current password is incorrect.");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordMessage("Password updated successfully.");
  };

  if (!user) return <div className="site-card mx-auto max-w-md p-8 text-center"><h2 className="text-2xl font-bold text-slate-950">Sign in to manage your account</h2><p className="mt-3 text-sm leading-7 text-slate-600">Your profile, preferences, orders, and saved listings are available after you sign in.</p><button type="button" onClick={() => openAuth("login")} className="mt-6 rounded-[10px] bg-accent-400 px-5 py-3 text-sm font-bold text-black">Sign in</button></div>;

  return <div className="grid gap-6 lg:grid-cols-[0.75fr_1.25fr]">
    <aside className="site-card p-6"><div className="flex items-center gap-4"><div className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-black text-2xl font-bold text-accent-400">{user.avatarUrl ? <Image src={user.avatarUrl} alt="" fill sizes="64px" className="object-cover" unoptimized /> : user.name.slice(0, 1).toUpperCase()}</div><div><h2 className="text-xl font-bold text-slate-950">{user.name}</h2><p className="text-sm text-slate-500">{user.email}</p></div></div><div className="mt-6 space-y-3 text-sm"><div className="flex items-center justify-between border-b border-slate-100 pb-3"><span className="text-slate-500">Account type</span><span className="font-bold capitalize text-slate-950">{user.role === "vendor" ? "Vendor" : "Client"}</span></div><div className="flex items-center justify-between border-b border-slate-100 pb-3"><span className="text-slate-500">Account status</span><span className="font-bold text-emerald-700">Active</span></div><div className="flex items-center justify-between"><span className="text-slate-500">Member since</span><span className="font-bold text-slate-950">2026</span></div></div><p className="mt-6 rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-600">Your account type is fixed. To use a different account type, sign out and create a new account with another email.</p><button type="button" onClick={() => { logout(); router.push("/"); }} className="mt-5 w-full rounded-[10px] bg-slate-100 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-200">Sign out</button></aside>
    <form onSubmit={save} className="site-card space-y-6 p-6 sm:p-8"><div><h2 className="text-2xl font-bold text-slate-950">{title}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{description}</p></div><div className="grid gap-5 sm:grid-cols-2"><label className="text-sm font-semibold text-slate-700">Full name<input value={name} onChange={(event) => setName(event.target.value)} className="mt-2 w-full rounded-[10px] border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-black focus:bg-white" /></label><label className="text-sm font-semibold text-slate-700">Email address<input value={user.email} readOnly className="mt-2 w-full cursor-not-allowed rounded-[10px] border border-slate-200 bg-slate-100 px-4 py-3 text-slate-500" /></label><label className="text-sm font-semibold text-slate-700">Upload profile picture<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => setAvatarUrl(String(reader.result)); reader.readAsDataURL(file); }} className="mt-2 block w-full rounded-[10px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700" /></label><label className="text-sm font-semibold text-slate-700">Profile picture URL<input type="url" value={avatarUrl.startsWith("data:") ? "" : avatarUrl} onChange={(event) => setAvatarUrl(event.target.value)} className="mt-2 w-full rounded-[10px] border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-black focus:bg-white" placeholder="https://..." /></label><label className="text-sm font-semibold text-slate-700">Campus or school<input value={campus} onChange={(event) => setCampus(event.target.value)} className="mt-2 w-full rounded-[10px] border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-black focus:bg-white" placeholder="University of Lagos" /></label><label className="text-sm font-semibold text-slate-700">Phone number<input value={phone} onChange={(event) => setPhone(event.target.value)} className="mt-2 w-full rounded-[10px] border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-black focus:bg-white" placeholder="0800 000 0000" /></label></div><label className="block text-sm font-semibold text-slate-700">About you<textarea rows={4} value={bio} onChange={(event) => setBio(event.target.value)} className="mt-2 w-full resize-y rounded-[10px] border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-black focus:bg-white" placeholder="A short introduction for your profile." /></label>{user.role === "vendor" ? <div className="space-y-4 border-t border-slate-200 pt-6"><h3 className="font-bold text-slate-950">Shop details</h3><label className="block text-sm font-semibold text-slate-700">Shop or business name<input value={businessName} onChange={(event) => setBusinessName(event.target.value)} className="mt-2 w-full rounded-[10px] border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-black focus:bg-white" /></label><label className="block text-sm font-semibold text-slate-700">What do you sell?<textarea rows={3} value={businessDescription} onChange={(event) => setBusinessDescription(event.target.value)} className="mt-2 w-full resize-y rounded-[10px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-black focus:bg-white" /></label><label className="block text-sm font-semibold text-slate-700">Usual campus pickup point<input value={pickupLocation} onChange={(event) => setPickupLocation(event.target.value)} className="mt-2 w-full rounded-[10px] border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none focus:border-black focus:bg-white" /></label></div> : null}<div className="border-t border-slate-200 pt-6"><h3 className="font-bold text-slate-950">Notifications</h3><div className="mt-4 space-y-3"><label className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 p-4 text-sm"><span><span className="block font-bold text-slate-950">Email updates</span><span className="mt-1 block text-slate-500">Product news and account updates</span></span><input type="checkbox" checked={emailUpdates} onChange={(event) => setEmailUpdates(event.target.checked)} className="h-5 w-5 accent-black" /></label><label className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 p-4 text-sm"><span><span className="block font-bold text-slate-950">Order alerts</span><span className="mt-1 block text-slate-500">Updates about purchases and fulfillment</span></span><input type="checkbox" checked={orderAlerts} onChange={(event) => setOrderAlerts(event.target.checked)} className="h-5 w-5 accent-black" /></label></div></div><div className="flex items-center gap-4"><button type="submit" className="rounded-[10px] bg-accent-400 px-5 py-3 text-sm font-bold text-black">{saved ? "Saved" : "Save changes"}</button>{saved ? <span className="text-sm font-semibold text-emerald-700">Your account is up to date.</span> : null}</div></form>
    <form onSubmit={savePassword} className="site-card space-y-4 p-6 lg:col-start-2"><h2 className="text-lg font-bold text-slate-950">Change password</h2><div className="grid gap-4 sm:grid-cols-3"><input type="password" required value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className="rounded-[10px] border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-900" placeholder="Current password" /><input type="password" required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="rounded-[10px] border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-900" placeholder="New password" /><input type="password" required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="rounded-[10px] border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-900" placeholder="Confirm password" /></div>{passwordMessage ? <p className="text-sm font-semibold text-slate-600">{passwordMessage}</p> : null}<button type="submit" className="w-fit rounded-[10px] border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-900 hover:bg-slate-50">Update password</button></form>
  </div>;
}