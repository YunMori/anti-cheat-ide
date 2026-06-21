"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Badge, Button, Card, Field, Input, Textarea, cn } from "@ide/ui";
import { useConsole } from "../../../../components/console";
import { get, patch, post } from "../../../../lib/api";
import { LANGUAGE_OPTIONS } from "../../../../lib/types";
import type { Problem, TestCase } from "../../../../lib/types";
import { Eyebrow, ErrorText } from "../../../../components/ui-bits";

type Draft = Omit<TestCase, "id">;

export default function ProblemsPage() {
  const { examId, exam } = useConsole();
  const locked = exam ? exam.status !== "draft" : true;
  const [problems, setProblems] = useState<Problem[]>([]);
  const [selectedId, setSelectedId] = useState<string | "new" | null>(null);

  const reload = useCallback(() => {
    void get<Problem[]>(`/problems?assessment_id=${encodeURIComponent(examId)}`, []).then(
      (items) => {
        const sorted = [...items].sort((a, b) => a.order_index - b.order_index);
        setProblems(sorted);
        setSelectedId((current) => current ?? sorted[0]?.id ?? null);
      },
    );
  }, [examId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const selected =
    selectedId && selectedId !== "new"
      ? problems.find((p) => p.id === selectedId) ?? null
      : null;

  return (
    <section className="space-y-5">
      <header className="flex items-center justify-between">
        <div className="space-y-1">
          <Eyebrow>Problem editor</Eyebrow>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-text">문제 출제</h1>
            {exam &&
              (locked ? (
                <Badge tone="high">🔒 잠김</Badge>
              ) : (
                <Badge tone="medium">● 시작 전</Badge>
              ))}
          </div>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
        <Card className="flex flex-col p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-text">
              출제된 문제 {problems.length}
            </span>
            {!locked && (
              <Button size="sm" onClick={() => setSelectedId("new")}>
                ＋ 추가
              </Button>
            )}
            {locked && <span className="text-xs text-risk-high">🔒 잠김</span>}
          </div>
          <ul className="mt-3 space-y-1">
            {problems.map((problem, index) => (
              <li key={problem.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(problem.id)}
                  className={cn(
                    "w-full rounded-lg px-3 py-2 text-left text-sm transition-colors",
                    selectedId === problem.id
                      ? "bg-primary/10 font-semibold text-primary"
                      : "text-text hover:bg-surface-2",
                  )}
                >
                  {index + 1}. {problem.title}
                </button>
              </li>
            ))}
            {problems.length === 0 && (
              <li className="px-3 py-2 text-xs text-muted">
                아직 출제된 문제가 없습니다.
              </li>
            )}
          </ul>
        </Card>

        <div>
          {locked ? (
            <LockBanner />
          ) : (
            <EditBanner />
          )}
          {selectedId === "new" ? (
            <ProblemEditor
              key="new"
              examId={examId}
              locked={false}
              onSaved={(created) => {
                setSelectedId(created.id);
                reload();
              }}
            />
          ) : selected ? (
            <ProblemEditor
              key={selected.id}
              examId={examId}
              problem={selected}
              locked={locked}
              onSaved={reload}
            />
          ) : (
            <Card className="p-6 text-sm text-muted">
              왼쪽에서 문제를 선택하거나 새로 추가하세요.
            </Card>
          )}
        </div>
      </div>
    </section>
  );
}

function EditBanner() {
  return (
    <div className="mb-4 flex items-start gap-3 rounded-xl border-l-[3px] border-accent bg-surface-2 px-4 py-3 text-sm text-text">
      <span aria-hidden="true">✎</span>
      <p>
        아직 시험이 시작되지 않아 출제·테스트 케이스를 자유롭게 수정할 수 있습니다.
        <strong className="ml-1">시험을 시작하면 출제 내용이 잠깁니다.</strong>
      </p>
    </div>
  );
}

function LockBanner() {
  return (
    <div className="mb-4 flex items-start gap-3 rounded-xl border-l-[3px] border-risk-high bg-risk-high-soft px-4 py-3 text-sm text-text">
      <span
        className="flex size-[22px] shrink-0 items-center justify-center rounded-full bg-risk-high text-xs text-white"
        aria-hidden="true"
      >
        🔒
      </span>
      <p>
        <strong className="mr-1">시험이 시작되어 출제 내용이 잠겼습니다.</strong>
        무결성 보장을 위해 문제·언어·테스트 케이스는 시험 종료 전까지 수정할 수
        없습니다.
      </p>
    </div>
  );
}

function ProblemEditor({
  examId,
  problem,
  locked,
  onSaved,
}: {
  examId: string;
  problem?: Problem;
  locked: boolean;
  onSaved: (problem: Problem) => void;
}) {
  const [languages, setLanguages] = useState<string[]>(
    problem?.allowed_languages ?? ["python"],
  );
  const [testCases, setTestCases] = useState<Draft[]>(
    problem?.test_cases.map((tc) => ({
      stdin: tc.stdin,
      expected_stdout: tc.expected_stdout,
      hidden: tc.hidden,
    })) ?? [
      { stdin: "", expected_stdout: "", hidden: false },
      { stdin: "", expected_stdout: "", hidden: true },
    ],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const updateTestCase = (index: number, change: Partial<Draft>) =>
    setTestCases((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...change } : item,
      ),
    );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (locked) return;
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const body = {
      title: form.get("title"),
      statement: form.get("statement"),
      allowed_languages: languages,
      time_limit_ms: Number(form.get("timeLimit")),
      memory_limit_mb: Number(form.get("memoryLimit")),
      pass_threshold: Number(form.get("passThreshold")) / 100,
      test_cases: testCases,
    };
    try {
      const saved = problem
        ? await patch<Problem>(`/problems/${encodeURIComponent(problem.id)}`, body)
        : await post<Problem>("/problems", { assessment_id: examId, starter_code: {}, ...body });
      onSaved(saved);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "저장에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className={cn("p-5", locked && "pointer-events-none opacity-70")}>
      <form className="flex flex-col gap-4" onSubmit={submit}>
        <Field label="문제 제목" htmlFor="problem-title">
          <Input
            id="problem-title"
            name="title"
            defaultValue={problem?.title}
            placeholder="A + B"
            required
            disabled={locked}
          />
        </Field>
        <Field label="문제 설명" htmlFor="problem-statement">
          <Textarea
            id="problem-statement"
            name="statement"
            rows={5}
            defaultValue={problem?.statement}
            placeholder="입력 형식과 출력 조건을 포함해 작성하세요."
            required
            disabled={locked}
          />
        </Field>

        <fieldset className="space-y-2" disabled={locked}>
          <legend className="text-xs font-semibold text-muted">허용 언어</legend>
          <div className="flex flex-wrap gap-2">
            {LANGUAGE_OPTIONS.map(([value, label]) => {
              const on = languages.includes(value);
              return (
                <button
                  key={value}
                  type="button"
                  disabled={locked}
                  onClick={() =>
                    setLanguages((current) =>
                      current.includes(value)
                        ? current.filter((item) => item !== value)
                        : [...current, value],
                    )
                  }
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs transition-colors",
                    on
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted hover:bg-surface-2",
                  )}
                >
                  {on ? "✓ " : ""}
                  {label}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="시간 제한(ms)" htmlFor="problem-time">
            <Input
              id="problem-time"
              name="timeLimit"
              type="number"
              defaultValue={problem?.time_limit_ms ?? 2000}
              disabled={locked}
              required
            />
          </Field>
          <Field label="메모리(MB)" htmlFor="problem-memory">
            <Input
              id="problem-memory"
              name="memoryLimit"
              type="number"
              defaultValue={problem?.memory_limit_mb ?? 128}
              disabled={locked}
              required
            />
          </Field>
          <Field label="해금 통과율(%)" htmlFor="problem-threshold">
            <Input
              id="problem-threshold"
              name="passThreshold"
              type="number"
              defaultValue={Math.round((problem?.pass_threshold ?? 1) * 100)}
              disabled={locked}
              required
            />
          </Field>
        </div>

        <div className="space-y-3">
          {testCases.map((testCase, index) => (
            <section
              key={index}
              className="space-y-2 rounded-lg border border-border bg-surface-2 p-3"
            >
              <header className="flex items-center justify-between">
                <strong className="text-sm text-text">테스트 {index + 1}</strong>
                <label className="flex items-center gap-2 text-xs text-muted">
                  <input
                    type="checkbox"
                    checked={testCase.hidden}
                    disabled={locked}
                    onChange={(event) =>
                      updateTestCase(index, { hidden: event.target.checked })
                    }
                  />
                  숨은 케이스
                </label>
              </header>
              <Textarea
                rows={2}
                aria-label={`테스트 ${index + 1} 입력`}
                value={testCase.stdin}
                disabled={locked}
                onChange={(event) =>
                  updateTestCase(index, { stdin: event.target.value })
                }
                placeholder="stdin"
              />
              <Textarea
                rows={2}
                aria-label={`테스트 ${index + 1} 예상 출력`}
                value={testCase.expected_stdout}
                disabled={locked}
                onChange={(event) =>
                  updateTestCase(index, { expected_stdout: event.target.value })
                }
                placeholder="expected stdout (마지막 줄바꿈 포함 주의)"
              />
            </section>
          ))}
          {!locked && (
            <Button
              variant="secondary"
              size="sm"
              type="button"
              onClick={() =>
                setTestCases((current) => [
                  ...current,
                  { stdin: "", expected_stdout: "", hidden: true },
                ])
              }
            >
              ＋ 테스트 케이스
            </Button>
          )}
        </div>

        {locked ? (
          <Button type="button" variant="secondary" disabled className="self-start">
            🔒 문제 저장 (잠김)
          </Button>
        ) : (
          <Button
            type="submit"
            disabled={busy || languages.length === 0}
            className="self-start"
          >
            {busy ? "저장 중…" : problem ? "변경 저장" : "문제 저장"}
          </Button>
        )}
        {error && <ErrorText message={error} />}
      </form>
    </Card>
  );
}
