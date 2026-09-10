"use client";

import { useEffect, useState } from "react";

type Toast = { id: number; message: string };

export default function ToastHost() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const showToast = (event: Event) => {
      const message = (event as CustomEvent<{ message?: string }>).detail?.message;
      if (!message) return;
      const id = Date.now();
      setToasts((current) => [...current, { id, message }]);
      window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 2800);
    };
    window.addEventListener("campusmart-toast", showToast);
    return () => window.removeEventListener("campusmart-toast", showToast);
  }, []);

  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-20 z-[1000] flex flex-col items-end gap-2 md:bottom-6" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto flex items-center gap-3 rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-xl animate-[toastIn_220ms_ease-out]">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent-400 text-xs text-black" aria-hidden="true">✓</span>
          {toast.message}
          <button type="button" onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))} className="ml-2 text-white/60 hover:text-white" aria-label="Dismiss notification">×</button>
        </div>
      ))}
    </div>
  );
}
