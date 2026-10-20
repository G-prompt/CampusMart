"use client";
import { createContext, useContext, useCallback, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

type Options = { title: string; description: string; confirmLabel?: string; danger?: boolean };
type Pending = Options & { resolve: (result: boolean) => void };
const Context = createContext<((options: Options) => Promise<boolean>) | null>(null);
export function CampusMartConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const confirm = useCallback((options: Options) => new Promise<boolean>(resolve => {
    setPending(old => { old?.resolve(false); return { ...options, resolve }; });
  }), []);
  const close = (answer: boolean) => {
    if (!pending) return;
    pending.resolve(answer);
    setPending(null);
  };
  return <Context.Provider value={confirm}>
    {children}
    {pending && typeof document !== "undefined" && createPortal(
      <div className="fixed inset-0 z-[9999] grid place-items-center bg-slate-950/65 p-4"
           onKeyDown={e => { if (e.key === "Escape") close(false); }}>
        <div role="dialog" aria-modal="true" aria-labelledby="campusmart-confirm-heading" aria-describedby="campusmart-confirm-description"
             className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
          <div className="mb-3 grid size-10 place-items-center rounded-xl bg-amber-100 text-amber-700">!</div>
          <h2 id="campusmart-confirm-heading" className="text-base font-black text-slate-950">{pending.title}</h2>
          <p id="campusmart-confirm-description" className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600">{pending.description}</p>
          <div className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={() => close(false)} autoFocus className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-bold">Cancel</button>
            <button type="button" onClick={() => close(true)}
              className={`rounded-lg px-4 py-2.5 text-sm font-bold text-white ${pending.danger ? "bg-red-700" : "bg-slate-950"}`}>
              {pending.confirmLabel || "Confirm"}
            </button>
          </div>
        </div>
      </div>, document.body)}
  </Context.Provider>;
}
export function useCampusMartConfirm() {
  const value = useContext(Context);
  if (!value) throw new Error("useCampusMartConfirm must be used within CampusMartConfirmProvider");
  return value;
}
