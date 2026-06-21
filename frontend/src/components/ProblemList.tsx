"use client";

import { cn } from "@ide/ui";

import type { CandidateProblemSummary } from "../lib/types";

interface ProblemListProps {
  problems: CandidateProblemSummary[];
  currentProblemId: string;
  onSelect: (problemId: string) => void;
}

const STATUS_MARK: Record<CandidateProblemSummary["status"], string> = {
  solved: "✓",
  unlocked: "○",
  locked: "🔒",
};

const STATUS_TEXT: Record<CandidateProblemSummary["status"], string> = {
  solved: "해결됨",
  unlocked: "풀이 가능",
  locked: "잠김",
};

export function ProblemList({
  problems,
  currentProblemId,
  onSelect,
}: ProblemListProps) {
  if (problems.length === 0) {
    return (
      <p className="mb-6 rounded-lg border border-dashed border-border bg-surface-2 p-3 text-xs text-muted">
        아직 등록된 문제가 없습니다. 관리자에게 문의하세요.
      </p>
    );
  }

  return (
    <nav className="mb-6" aria-label="문제 목록">
      <h3 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted">
        문제 {problems.length}개
      </h3>
      <ol className="space-y-1">
        {problems.map((item) => {
          const locked = item.status === "locked";
          const active = item.id === currentProblemId;
          return (
            <li key={item.id}>
              <button
                type="button"
                disabled={locked}
                aria-current={active ? "true" : undefined}
                onClick={() => onSelect(item.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-text hover:bg-surface-2",
                  locked && "cursor-not-allowed opacity-50",
                )}
                title={
                  locked
                    ? `이전 문제를 ${Math.round(item.pass_threshold * 100)}% 이상 통과하면 해금됩니다.`
                    : undefined
                }
              >
                <span className="w-4 text-center" aria-hidden="true">
                  {STATUS_MARK[item.status]}
                </span>
                <span className="flex-1 truncate">
                  {locked
                    ? `문제 ${item.order_index + 1} (잠김)`
                    : (item.title ?? `문제 ${item.order_index + 1}`)}
                </span>
                <span className="sr-only">{STATUS_TEXT[item.status]}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
