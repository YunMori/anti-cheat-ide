"use client";

import { cn } from "../cn";

export type ToastTone = "info" | "success" | "error";

export type ToastItem = {
  id: string;
  message: string;
  tone?: ToastTone;
};

const TONES: Record<ToastTone, string> = {
  info: "border-border bg-surface text-text",
  success: "border-success/40 bg-risk-low-soft text-success",
  error: "border-danger/40 bg-risk-high-soft text-danger",
};

/**
 * Fixed-position toast stack. Announces messages to assistive tech via
 * an aria-live region.
 */
export function AlertStack({ alerts }: { alerts: ToastItem[] }) {
  return (
    <div
      aria-live="polite"
      aria-relevant="additions"
      className="pointer-events-none fixed right-4 top-20 z-50 flex w-[min(20rem,calc(100vw-2rem))] flex-col gap-2"
    >
      {alerts.map((alert) => (
        <div
          key={alert.id}
          role="status"
          className={cn(
            "pointer-events-auto rounded-lg border px-4 py-3 text-sm shadow-[var(--shadow-card)]",
            "motion-safe:animate-[toast-in_160ms_ease-out]",
            TONES[alert.tone ?? "info"],
          )}
        >
          {alert.message}
        </div>
      ))}
    </div>
  );
}
