"use client";

import { LANGUAGE_LABELS } from "../lib/constants";
import type { TransportState } from "../lib/session-event-client";
import type {
  CandidateProblem,
  CandidateProblemSummary,
  SubmissionAccepted,
  SupportedLanguage,
} from "../lib/types";
import { ProblemList } from "./ProblemList";

interface ProblemSidebarProps {
  problems: CandidateProblemSummary[];
  currentProblemId: string;
  onSelectProblem: (problemId: string) => void;
  problem: CandidateProblem | null;
  selectedLanguage: SupportedLanguage;
  onSelectLanguage: (language: SupportedLanguage) => void;
  transport: TransportState;
  submission: SubmissionAccepted | null;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

export function ProblemSidebar({
  problems,
  currentProblemId,
  onSelectProblem,
  problem,
  selectedLanguage,
  onSelectLanguage,
  transport,
  submission,
  collapsed,
  onToggleCollapsed,
}: ProblemSidebarProps) {
  return (
    <aside
      className={`custom-scrollbar shrink-0 overflow-hidden border-r border-gray-700 bg-gray-800 transition-[width] duration-200 ${
        collapsed ? "w-10" : "w-80 overflow-y-auto p-6"
      }`}
    >
      {collapsed ? (
        <button
          type="button"
          onClick={onToggleCollapsed}
          title="문제 패널 펼치기"
          className="flex h-full w-full flex-col items-center gap-3 py-4 text-cyan-300 transition-colors hover:bg-cyan-900/30"
        >
          <span aria-hidden>▶</span>
          <span className="text-xs font-bold [writing-mode:vertical-rl]">
            문제
          </span>
        </button>
      ) : (
        <>
          <div className="mb-4 flex justify-end">
            <button
              type="button"
              onClick={onToggleCollapsed}
              title="문제 패널 접기"
              className="rounded border border-gray-600 px-2 py-1 text-xs text-gray-300 transition-colors hover:bg-gray-700"
            >
              ◀ 접기
            </button>
          </div>

          <ProblemList
            problems={problems}
            currentProblemId={currentProblemId}
            onSelect={onSelectProblem}
          />

          <div className="mb-6">
            <span className="rounded bg-cyan-900 px-2 py-1 text-[10px] font-bold text-cyan-300">
              LEVEL 2
            </span>
            <h2 className="mt-2 text-xl font-bold text-gray-100">
              {problem?.title ?? "Fibonacci Series"}
            </h2>
          </div>

          <div className="space-y-4 text-sm leading-relaxed text-gray-400">
            {problem ? (
              <>
                <p className="whitespace-pre-wrap">{problem.statement}</p>
                <div className="rounded-lg border border-gray-700 bg-gray-900 p-4 font-mono text-xs">
                  제한: {problem.time_limit_ms}ms / {problem.memory_limit_mb}MB
                </div>
                {problem.public_test_cases.map((testCase, index) => (
                  <div
                    key={testCase.id}
                    className="rounded-lg border border-gray-700 bg-gray-900 p-4 font-mono text-xs"
                  >
                    <strong className="mb-2 block text-cyan-400">
                      예제 {index + 1}
                    </strong>
                    <pre className="whitespace-pre-wrap">
                      입력: {testCase.stdin || "(없음)"}
                    </pre>
                    <pre className="mt-2 whitespace-pre-wrap">
                      출력: {testCase.expected_stdout || "(없음)"}
                    </pre>
                  </div>
                ))}
              </>
            ) : (
              <>
                <p>피보나치 수는 수학에서 매우 유명한 수열입니다.</p>
                <div className="rounded-lg border border-gray-700 bg-gray-900 p-4 font-mono text-xs italic">
                  F(n) = F(n-1) + F(n-2)
                </div>
                <p>
                  인자 n(0 ≤ n ≤ 30)을 받아 n번째 피보나치 수를 반환하는 효율적인
                  알고리즘을 작성하세요.
                </p>
              </>
            )}
          </div>

          <div className="mt-8 space-y-4">
            <label className="block text-xs font-bold text-gray-300">
              풀이 언어
              <select
                value={selectedLanguage}
                onChange={(event) =>
                  onSelectLanguage(event.target.value as SupportedLanguage)
                }
                className="mt-2 w-full rounded border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-cyan-300"
              >
                {(Object.keys(LANGUAGE_LABELS) as SupportedLanguage[]).map(
                  (language) => (
                    <option key={language} value={language}>
                      {LANGUAGE_LABELS[language]}
                    </option>
                  ),
                )}
              </select>
            </label>
            <div className="rounded-lg border-l-4 border-yellow-500 bg-gray-900 p-4">
              <h3 className="mb-2 text-xs font-bold uppercase text-gray-300">
                Attention
              </h3>
              <p className="text-[11px] text-gray-500">
                키 입력, 붙여넣기 횟수, 코드 변경 및 포커스 변경이 시험 무결성
                검토를 위해 기록됩니다. 클립보드 내용은 수집하지 않습니다.
              </p>
            </div>
            {transport.lastError && (
              <div className="rounded-lg border border-red-900 bg-red-950/40 p-4 text-xs text-red-300">
                {transport.lastError}
              </div>
            )}
            {submission && (
              <section className="rounded-lg border border-gray-700 bg-gray-900 p-4 text-xs text-gray-300">
                <h3 className="mb-2 font-bold uppercase text-cyan-300">
                  Submission
                </h3>
                <p>ID: {submission.id}</p>
                {submission.status === "judge_failed" ? (
                  <p>제출은 저장됐지만 채점 서비스 호출에 실패했습니다.</p>
                ) : (
                  <p>제출이 접수되었습니다. 결과는 공개되지 않습니다.</p>
                )}
              </section>
            )}
          </div>
        </>
      )}
    </aside>
  );
}
