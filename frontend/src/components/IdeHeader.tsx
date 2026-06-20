"use client";

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
    <header className="flex items-center justify-between border-b border-gray-700 bg-gray-800 p-4 shadow-md">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500 font-bold text-gray-900">
          AS
        </div>
        <h1 className="text-xl font-bold tracking-tight">
          Anti-Cheat <span className="text-cyan-400">Web IDE</span>
        </h1>
      </div>

      <div className="flex items-center gap-5">
        <div className="hidden flex-col items-end text-xs lg:flex">
          <span className="text-[10px] font-bold uppercase text-gray-500">
            Candidate
          </span>
          <strong className="font-mono text-cyan-300">
            {sessionInfo?.candidate_id ?? "확인 중"}
          </strong>
        </div>
        <div className="h-10 w-px bg-gray-700" />
        <div className="flex flex-col items-end">
          <span className="text-[10px] font-bold uppercase text-gray-500">
            Editor revision
          </span>
          <span className="font-mono text-xl font-bold text-cyan-400">
            {editorRevision}
          </span>
        </div>
        <div className="h-10 w-px bg-gray-700" />
        <div className="flex flex-col gap-1 text-xs">
          <span
            className={online ? "text-green-400" : "text-red-400"}
            title="브라우저 네트워크 상태"
          >
            Platform: {online ? "Online" : "Offline"}
          </span>
          <span
            className={STATUS_COLORS[transport.status]}
            title={transport.lastError}
          >
            Events: {STATUS_LABELS[transport.status]} ({transport.pendingEvents})
          </span>
        </div>
        <button
          type="button"
          onClick={onFlush}
          className="rounded-md bg-cyan-600 px-5 py-2.5 font-bold text-gray-900 shadow-lg transition-all hover:bg-cyan-500 active:scale-95"
        >
          SEND EVENTS
        </button>
        <button
          type="button"
          disabled={submitting || !problem}
          onClick={onSubmit}
          className="rounded-md bg-green-500 px-5 py-2.5 font-bold text-gray-900 shadow-lg transition-all hover:bg-green-400 disabled:cursor-not-allowed disabled:bg-gray-600"
        >
          {submitting ? "SUBMITTING" : "SUBMIT"}
        </button>
        <button
          type="button"
          disabled={finishing}
          onClick={onFinish}
          className="rounded-md bg-red-600 px-5 py-2.5 font-bold text-white shadow-lg transition-all hover:bg-red-500 active:scale-95 disabled:cursor-not-allowed disabled:bg-gray-600"
        >
          {finishing ? "종료 중..." : "응시 종료"}
        </button>
      </div>
    </header>
  );
}
