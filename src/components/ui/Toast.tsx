"use client";

import { useEffect, useState } from "react";

export type ToastKind = "success" | "error" | "info";
export type Toast = { id: number; kind: ToastKind; message: string };

const listeners = new Set<(t: Toast) => void>();
let nextId = 1;

export function toast(message: string, kind: ToastKind = "info") {
  const t: Toast = { id: nextId++, kind, message };
  listeners.forEach((l) => l(t));
}

export const showToast = {
  success: (msg: string) => toast(msg, "success"),
  error: (msg: string) => toast(msg, "error"),
  info: (msg: string) => toast(msg, "info"),
};

const KIND_STYLES: Record<ToastKind, string> = {
  success: "border-emerald-200 bg-white text-slate-800",
  error: "border-rose-200 bg-white text-slate-800",
  info: "border-blue-200 bg-white text-slate-800",
};

const ICON_STYLES: Record<ToastKind, string> = {
  success: "bg-emerald-500",
  error: "bg-rose-500",
  info: "bg-blue-500",
};

export default function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const handler = (t: Toast) => {
      setToasts((prev) => [...prev, t]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((x) => x.id !== t.id));
      }, 3500);
    };
    listeners.add(handler);
    return () => { listeners.delete(handler); };
  }, []);

  const dismiss = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id));

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[9999] flex w-80 flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-start gap-2.5 overflow-hidden rounded-lg border px-3 py-2.5 shadow-lg ${KIND_STYLES[t.kind]} animate-toast-in`}
        >
          <span className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white ${ICON_STYLES[t.kind]}`}>
            {t.kind === "success" ? "✓" : t.kind === "error" ? "!" : "i"}
          </span>
          <p className="flex-1 text-xs leading-relaxed">{t.message}</p>
          <button
            onClick={() => dismiss(t.id)}
            className="flex-shrink-0 rounded p-0.5 text-slate-400 hover:text-slate-700"
            aria-label="Dismiss"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      ))}
    </div>
  );
}
