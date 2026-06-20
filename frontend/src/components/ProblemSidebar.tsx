"use client";

import { Badge, Button, Field, Select, StateCard } from "@ide/ui";

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
      aria-label="문제 패널"
      className={`shrink-0 overflow-hidden border-r border-border bg-surface transition-[width] duration-200 ${
        collapsed ? "w-10" : "w-72 overflow-y-auto p-5 lg:w-80 lg:p-6"
      }`}
    >
      {collapsed ? (
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label="문제 패널 펼치기"
          title="문제 패널 펼치기"
          className="flex h-full w-full flex-col items-center gap-3 py-4 text-primary transition-colors hover:bg-surface-2"
        >
          <span aria-hidden="true">▶</span>
          <span className="text-xs font-bold [writing-mode:vertical-rl]">
            문제
          </span>
        </button>
      ) : (
        <>
          <div className="mb-4 flex justify-end">
            <Button
              variant="secondary"
              size="sm"
              onClick={onToggleCollapsed}
              aria-label="문제 패널 접기"
            >
              ◀ 접기
            </Button>
          </div>

          <ProblemList
            problems={problems}
            currentProblemId={currentProblemId}
            onSelect={onSelectProblem}
          />

          {problem ? (
            <>
              <div className="mb-4">
                <Badge tone="primary">문제 {problem.order_index + 1}</Badge>
                <h2 className="mt-2 text-xl font-bold text-text">
                  {problem.title}
                </h2>
              </div>

              <div className="space-y-4 text-sm leading-relaxed text-muted">
                <p className="whitespace-pre-wrap">{problem.statement}</p>
                <div className="rounded-lg border border-border bg-surface-2 p-4 font-mono text-xs text-text">
                  제한: {problem.time_limit_ms}ms / {problem.memory_limit_mb}MB
                </div>
                {problem.public_test_cases.map((testCase, index) => (
                  <div
                    key={testCase.id}
                    className="rounded-lg border border-border bg-surface-2 p-4 font-mono text-xs"
                  >
                    <strong className="mb-2 block text-accent">
                      예제 {index + 1}
                    </strong>
                    <pre className="whitespace-pre-wrap text-text">
                      입력: {testCase.stdin || "(없음)"}
                    </pre>
                    <pre className="mt-2 whitespace-pre-wrap text-text">
                      출력: {testCase.expected_stdout || "(없음)"}
                    </pre>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <StateCard
              tone="loading"
              title="문제를 불러오는 중"
              description="선택한 문제를 준비하고 있습니다."
            />
          )}

          <div className="mt-8 space-y-4">
            <Field label="풀이 언어" htmlFor="language-select">
              <Select
                id="language-select"
                value={selectedLanguage}
                onChange={(event) =>
                  onSelectLanguage(event.target.value as SupportedLanguage)
                }
              >
                {(Object.keys(LANGUAGE_LABELS) as SupportedLanguage[]).map(
                  (language) => (
                    <option key={language} value={language}>
                      {LANGUAGE_LABELS[language]}
                    </option>
                  ),
                )}
              </Select>
            </Field>

            <div className="rounded-lg border-l-4 border-warning bg-surface-2 p-4">
              <h3 className="mb-2 text-xs font-bold uppercase text-text">
                안내
              </h3>
              <p className="text-[11px] text-muted">
                키 입력, 붙여넣기 횟수, 코드 변경 및 포커스 변경이 시험 무결성
                검토를 위해 기록됩니다. 클립보드 내용은 수집하지 않습니다.
              </p>
            </div>

            {transport.lastError && (
              <div
                role="alert"
                className="rounded-lg border border-danger/40 bg-risk-high-soft p-4 text-xs text-danger"
              >
                {transport.lastError}
              </div>
            )}

            {submission && (
              <section className="rounded-lg border border-border bg-surface-2 p-4 text-xs text-muted">
                <h3 className="mb-2 font-bold uppercase text-accent">제출</h3>
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
