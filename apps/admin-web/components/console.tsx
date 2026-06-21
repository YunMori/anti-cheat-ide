"use client";

import { createContext, useContext, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Badge, ThemeToggle, cn } from "@ide/ui";
import type { Assessment } from "../lib/types";
import { STATUS_META } from "../lib/types";
import { AccentToggle } from "./accent-toggle";

interface ConsoleValue {
  examId: string;
  exam: Assessment | null;
  exams: Assessment[];
  role: "admin" | "reviewer";
  logout: () => Promise<void>;
}

const ConsoleContext = createContext<ConsoleValue | null>(null);

/** 콘솔 셸 내부에서 현재 시험·역할 컨텍스트를 읽는다. */
export function useConsole(): ConsoleValue {
  const value = useContext(ConsoleContext);
  if (!value) {
    throw new Error("useConsole must be used within ConsoleShell");
  }
  return value;
}

type NavItem = {
  seg: string;
  label: string;
  icon: ReactNode;
  adminOnly?: boolean;
};

const ICON = "size-[18px] shrink-0";

const NAV: NavItem[] = [
  {
    seg: "dashboard",
    label: "대시보드",
    icon: (
      <svg className={ICON} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <rect x="3" y="3" width="7" height="9" rx="1" />
        <rect x="14" y="3" width="7" height="5" rx="1" />
        <rect x="14" y="12" width="7" height="9" rx="1" />
        <rect x="3" y="16" width="7" height="5" rx="1" />
      </svg>
    ),
  },
  {
    seg: "settings",
    label: "시험 설정",
    adminOnly: true,
    icon: (
      <svg className={ICON} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <line x1="4" y1="8" x2="20" y2="8" />
        <circle cx="9" cy="8" r="2.4" fill="var(--surface)" />
        <line x1="4" y1="16" x2="20" y2="16" />
        <circle cx="15" cy="16" r="2.4" fill="var(--surface)" />
      </svg>
    ),
  },
  {
    seg: "problems",
    label: "문제",
    adminOnly: true,
    icon: (
      <svg className={ICON} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <polyline points="9 7 4 12 9 17" />
        <polyline points="15 7 20 12 15 17" />
      </svg>
    ),
  },
  {
    seg: "candidates",
    label: "응시자",
    adminOnly: true,
    icon: (
      <svg className={ICON} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <circle cx="9" cy="8" r="3" />
        <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
        <path d="M16 6.2a3 3 0 0 1 0 5.6M17.5 19a5.5 5.5 0 0 0-2.3-4.5" />
      </svg>
    ),
  },
  {
    seg: "monitor",
    label: "모니터링",
    icon: (
      <svg className={ICON} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
        <path d="M3 12h3l2.5-7 4 14 2.5-7H21" />
      </svg>
    ),
  },
];

export function ConsoleShell({
  value,
  children,
}: {
  value: ConsoleValue;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { examId, exam, exams, role, logout } = value;
  const items = NAV.filter((item) => role === "admin" || !item.adminOnly);

  return (
    <ConsoleContext.Provider value={value}>
      <div className="flex min-h-screen">
        <aside className="flex w-[214px] shrink-0 flex-col border-r border-border bg-surface">
          <Link
            href="/exams"
            className="flex items-center gap-3 px-4 py-5 text-text no-underline"
          >
            <span
              className="flex size-[34px] items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-fg"
              aria-hidden="true"
            >
              SR
            </span>
            <span className="flex flex-col leading-tight">
              <strong className="text-sm font-bold">Session Review</strong>
              <small className="text-[11px] text-muted">근거 중심 검토 도구</small>
            </span>
          </Link>

          <nav className="flex flex-1 flex-col gap-1 px-3 py-2">
            {items.map((item) => {
              const href = `/exams/${examId}/${item.seg}`;
              const active = pathname.startsWith(href);
              return (
                <Link
                  key={item.seg}
                  href={href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-[12.5px] no-underline transition-colors",
                    active
                      ? "bg-primary/10 font-semibold text-primary"
                      : "text-muted hover:bg-surface-2 hover:text-text",
                  )}
                >
                  {item.icon}
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <p className="px-4 py-4 text-[11px] text-muted">v0.9 · MVP</p>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-[60px] items-center justify-between gap-4 border-b border-border bg-surface px-6">
            <label className="flex items-center gap-2 text-xs text-muted">
              현재 시험
              <select
                value={examId}
                onChange={(event) =>
                  router.push(`/exams/${event.target.value}/dashboard`)
                }
                className="rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-sm font-medium text-text"
              >
                {exams.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
              {exam && (
                <Badge tone={STATUS_META[exam.status].tone}>
                  {STATUS_META[exam.status].label}
                </Badge>
              )}
            </label>

            <div className="flex items-center gap-3">
              <span className="hidden text-xs text-muted sm:inline">
                {role === "admin" ? "admin" : "reviewer"}
              </span>
              <AccentToggle />
              <ThemeToggle />
              <button
                type="button"
                onClick={() => void logout().then(() => router.push("/"))}
                className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted transition-colors hover:bg-surface-2 hover:text-text"
              >
                로그아웃
              </button>
            </div>
          </header>

          <main className="min-w-0 flex-1 px-7 py-6">{children}</main>
        </div>
      </div>
    </ConsoleContext.Provider>
  );
}
