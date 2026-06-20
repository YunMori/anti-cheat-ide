"use client";

import { Button, ThemeToggle } from "@ide/ui";

import { STATUS_COLORS, STATUS_LABELS } from "../lib/constants";
import type { TransportState } from "../lib/session-event-client";
import type { CandidateProblem, SessionInfo } from "../lib/types";

interface IdeHeaderProps {
  sessionInfo: SessionInfo | null;
  editorRevision: number;
  online: boolean;
  transport: TransportState;
  problem: CandidateProblem | null;
  submitting: boolean;
  finishing: boolean;
  onFlush: () => void;
  onSubmit: () => void;
  onFinish: () => void;
}

export function IdeHeader({
  sessionInfo,
  editorRevision,
  online,
  transport,
  problem,
  submitting,
  finishing,
  onFlush,
  onSubmit,
  onFinish,
}: IdeHeaderProps) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3 shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-3">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary font-bold text-primary-fg">
          AS
        </div>
        <h1 className="text-lg font-bold tracking-tight text-text">
          Anti-Cheat <span className="text-accent">Web IDE</span>
        </h1>
      </div>

      <div className="flex items-center gap-4">
        <dl className="hidden flex-col items-end text-xs sm:flex">
          <dt className="text-[10px] font-bold uppercase text-muted">
            Candidate
          </dt>
          <dd className="font-mono text-text">
            {sessionInfo?.candidate_id ?? "확인 중"}
          </dd>
        </dl>

        <div className="hidden h-9 w-px bg-border md:block" />

        <dl className="hidden flex-col items-end md:flex">
          <dt className="text-[10px] font-bold uppercase text-muted">
            Editor revision
          </dt>
          <dd className="font-mono text-lg font-bold text-accent">
            {editorRevision}
          </dd>
        </dl>

        <div className="hidden h-9 w-px bg-border lg:block" />

        <div
          className="hidden flex-col gap-0.5 text-xs lg:flex"
          aria-live="polite"
        >
          <span className={online ? "text-success" : "text-danger"}>
            Platform: {online ? "Online" : "Offline"}
          </span>
          <span className={STATUS_COLORS[transport.status]} title={transport.lastError}>
            Events: {STATUS_LABELS[transport.status]} ({transport.pendingEvents})
          </span>
        </div>

        <ThemeToggle />

        <Button variant="secondary" size="sm" onClick={onFlush}>
          이벤트 전송
        </Button>
        <Button
          variant="success"
          size="sm"
          disabled={submitting || !problem}
          onClick={onSubmit}
        >
          {submitting ? "제출 중…" : "제출"}
        </Button>
        <Button
          variant="danger"
          size="sm"
          disabled={finishing}
          onClick={onFinish}
        >
          {finishing ? "종료 중…" : "응시 종료"}
        </Button>
      </div>
    </header>
  );
}
