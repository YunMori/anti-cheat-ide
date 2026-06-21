import type { HTMLAttributes } from "react";
import { cn } from "../cn";

export type BadgeTone =
  | "neutral"
  | "primary"
  | "low"
  | "medium"
  | "high"
  | "success"
  | "warning"
  | "danger";

const TONES: Record<BadgeTone, string> = {
  neutral: "bg-surface-2 text-muted",
  primary: "bg-primary/10 text-primary",
  low: "bg-risk-low-soft text-risk-low",
  medium: "bg-risk-medium-soft text-risk-medium",
  high: "bg-risk-high-soft text-risk-high",
  success: "bg-risk-low-soft text-success",
  warning: "bg-risk-medium-soft text-warning",
  danger: "bg-risk-high-soft text-danger",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

export function Badge({ tone = "neutral", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold",
        TONES[tone],
        className,
      )}
      {...props}
    />
  );
}

/** Map a 0-100 risk score to the matching badge tone. */
export function riskTone(score: number): Extract<BadgeTone, "low" | "medium" | "high"> {
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}
