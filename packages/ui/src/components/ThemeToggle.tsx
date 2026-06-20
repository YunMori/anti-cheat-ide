"use client";

import { cn } from "../cn";
import { useTheme } from "../theme";

/** Light/dark toggle button. Must be rendered inside a ThemeProvider. */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "라이트 모드로 전환" : "다크 모드로 전환"}
      title={isDark ? "라이트 모드로 전환" : "다크 모드로 전환"}
      className={cn(
        "inline-flex size-9 items-center justify-center rounded-lg border border-border bg-surface text-text transition-colors hover:bg-surface-2",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg",
        className,
      )}
    >
      <span aria-hidden="true" className="text-base leading-none">
        {isDark ? "☀️" : "🌙"}
      </span>
    </button>
  );
}
