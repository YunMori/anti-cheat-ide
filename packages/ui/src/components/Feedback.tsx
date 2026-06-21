import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../cn";

/** Indeterminate spinner. Respects prefers-reduced-motion. */
export function Spinner({
  className,
  label = "로딩 중",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <span
      role="status"
      aria-label={label}
      className={cn(
        "inline-block size-4 animate-spin rounded-full border-2 border-border border-t-primary motion-reduce:animate-none",
        className,
      )}
    />
  );
}

/** Pulsing placeholder block for loading skeletons. */
export function Skeleton({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "animate-pulse rounded-md bg-surface-2 motion-reduce:animate-none",
        className,
      )}
      {...props}
    />
  );
}

export type StateTone = "loading" | "empty" | "error";

/** Centered placeholder for loading / empty / error states. */
export function StateCard({
  tone = "empty",
  title,
  description,
  action,
  className,
}: {
  tone?: StateTone;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-surface/60 px-6 py-10 text-center",
        className,
      )}
    >
      {tone === "loading" ? <Spinner className="size-6" /> : null}
      <div className="space-y-1">
        <h3
          className={cn(
            "text-sm font-semibold",
            tone === "error" ? "text-danger" : "text-text",
          )}
        >
          {title}
        </h3>
        {description ? (
          <p className="text-sm text-muted">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
