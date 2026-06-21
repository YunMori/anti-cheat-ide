"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  Badge,
  Button,
  Card,
  Field,
  Input,
  Select,
  Textarea,
  cn,
  riskTone,
} from "@ide/ui";

import { fetchRiskAssessment, RiskAssessment } from "../lib/risk";

// risk-view pulls in the full evidence renderer; load it on demand when a
// reviewer expands a participant row.
const AssessmentView = dynamic(
  () => import("./risk-view").then((mod) => mod.AssessmentView),
  {
    loading: () => (
      <p className="text-sm text-muted">위험 평가 화면을 불러오는 중…</p>
    ),
  },
);

const PLATFORM_API_URL = "/api/platform";

const LANGUAGE_OPTIONS = [
  ["python", "Python 3.12"],
  ["javascript", "JavaScript ES2022"],
  ["cpp", "C++20"],
  ["java", "Java 21"],
] as const;

interface Assessment {
  id: string;
  title: string;
}

interface ProblemSummary {
  id: string;
  title: string;
  order_index: number;
}

interface ParticipantStatus {
  candidate_id: string;
  invited_at: string;
  expires_at: string;
  redeemed: boolean;
  session_id: string | null;
  session_status: string | null;
  risk_score: number | null;
  review_recommended: boolean | null;
  solved_count: number;
  total_problems: number;
}

interface AdminUser {
  id: string;
  email: string;
  display_name: string;
  role: "admin" | "reviewer" | null;
  status: "pending" | "active";
}

interface TestCaseDraft {
  stdin: string;
  expected_stdout: string;
  hidden: boolean;
}

async function request<T>(path: string, body: object): Promise<T> {
  const response = await fetch(`${PLATFORM_API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(
      typeof payload?.detail === "string"
        ? payload.detail
        : `요청 실패 (${response.status})`,
    );
  }
  return response.json() as Promise<T>;
}

export function ManagementDesk({ role }: { role: "admin" | "reviewer" }) {
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [activeAssessmentId, setActiveAssessmentId] = useState("");
  const [problems, setProblems] = useState<ProblemSummary[]>([]);
  const [participants, setParticipants] = useState<ParticipantStatus[]>([]);
  const [notice, setNotice] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${PLATFORM_API_URL}/assessments`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : []))
      .then((items: Assessment[]) => setAssessments(items))
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setNotice(
            "시험 목록을 불러오지 못했습니다. Platform API 상태를 확인하세요.",
          );
        }
      });
    return () => controller.abort();
  }, []);

  // 현재 시험의 문제·참가자를 로드하고, 참가자는 10초마다 폴링한다.
  // 문제/초대 생성 후 refreshKey를 올리면 즉시 다시 불러온다.
  useEffect(() => {
    if (!activeAssessmentId) return;
    const controller = new AbortController();
    const problemsUrl = `${PLATFORM_API_URL}/problems?assessment_id=${encodeURIComponent(activeAssessmentId)}`;
    const participantsUrl = `${PLATFORM_API_URL}/assessments/${encodeURIComponent(activeAssessmentId)}/participants`;

    fetch(problemsUrl, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : []))
      .then((items: ProblemSummary[]) =>
        setProblems([...items].sort((a, b) => a.order_index - b.order_index)),
      )
      .catch(() => undefined);

    fetch(participantsUrl, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : []))
      .then((items: ParticipantStatus[]) => setParticipants(items))
      .catch(() => undefined);

    const timer = setInterval(() => {
      fetch(participantsUrl, { signal: controller.signal })
        .then((response) => (response.ok ? response.json() : []))
        .then((items: ParticipantStatus[]) => setParticipants(items))
        .catch(() => undefined);
    }, 10000);

    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [activeAssessmentId, refreshKey]);

  const activeAssessment =
    assessments.find((item) => item.id === activeAssessmentId) ?? null;

  return (
    <section aria-labelledby="management-title" className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wider text-accent">
          Assessment operations
        </p>
        <h1 id="management-title" className="text-2xl font-bold text-text">
          시험을 만들고, 출제하고, 참가자를 모니터링하세요.
        </h1>
        <p className="max-w-2xl text-sm text-muted">
          시험 하나를 선택하면 출제·초대·모니터링이 모두 그 시험으로 이어집니다.
          숨은 테스트 케이스는 응시자 브라우저에 전달되지 않습니다.
        </p>
      </header>

      {notice && (
        <p
          role="status"
          className="rounded-lg border border-border bg-surface-2 px-4 py-2 text-sm text-text"
        >
          {notice}
        </p>
      )}

      <Card className="flex flex-wrap items-end justify-between gap-4 p-4">
        <Field label="현재 시험" htmlFor="active-assessment" className="min-w-60 flex-1">
          <Select
            id="active-assessment"
            value={activeAssessmentId}
            onChange={(event) => setActiveAssessmentId(event.target.value)}
          >
            <option value="" disabled>
              {assessments.length ? "시험을 선택하세요" : "아직 시험이 없습니다"}
            </option>
            {assessments.map((assessment) => (
              <option key={assessment.id} value={assessment.id}>
                {assessment.title}
              </option>
            ))}
          </Select>
        </Field>
        {activeAssessment && (
          <div className="flex gap-6 text-sm text-muted">
            <span>
              <strong className="text-text">{problems.length}</strong> 문제
            </span>
            <span>
              <strong className="text-text">{participants.length}</strong> 참가자
            </span>
          </div>
        )}
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        {role === "admin" && (
          <>
            <AssessmentForm
              onCreated={(assessment) => {
                setAssessments((current) => [...current, assessment]);
                setActiveAssessmentId(assessment.id);
                setNotice(
                  `시험 "${assessment.title}"을 생성했습니다. 이제 문제를 출제하세요.`,
                );
              }}
            />
            <ProblemForm
              assessmentId={activeAssessmentId}
              problems={problems}
              onCreated={(title) => {
                setNotice(`문제 "${title}"을 출제했습니다.`);
                setRefreshKey((key) => key + 1);
              }}
            />
            <InviteForm
              assessmentId={activeAssessmentId}
              participantCount={participants.length}
              onCreated={(_url, candidateId) => {
                setNotice(`응시자 ${candidateId} 초대 링크를 생성했습니다.`);
                setRefreshKey((key) => key + 1);
              }}
            />
          </>
        )}

        <div className="lg:col-span-2">
          <ParticipantMonitor
            assessmentId={activeAssessmentId}
            participants={participants}
          />
        </div>
      </div>

      {role === "admin" && <PendingUsers onNotice={setNotice} />}
    </section>
  );
}

function StepCard({
  step,
  title,
  detail,
  children,
  className,
}: {
  step: string;
  title: string;
  detail: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("flex flex-col", className)}>
      <header className="flex items-start gap-3 border-b border-border px-5 py-4">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 font-mono text-sm font-bold text-primary">
          {step}
        </span>
        <div>
          <h2 className="text-sm font-bold text-text">{title}</h2>
          <p className="text-xs text-muted">{detail}</p>
        </div>
      </header>
      <div className="flex flex-col gap-3 p-5">{children}</div>
    </Card>
  );
}

function TextField({
  label,
  name,
  type = "text",
  placeholder,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  defaultValue?: string;
}) {
  return (
    <Field label={label} htmlFor={`field-${name}`}>
      <Input
        id={`field-${name}`}
        name={name}
        type={type}
        placeholder={placeholder}
        defaultValue={defaultValue}
        required
      />
    </Field>
  );
}

function SubmitButton({
  busy,
  label,
  disabled = false,
}: {
  busy: boolean;
  label: string;
  disabled?: boolean;
}) {
  return (
    <Button type="submit" disabled={busy || disabled} className="self-start">
      {busy ? "처리 중…" : label}
    </Button>
  );
}

function ErrorText({ message }: { message: string }) {
  return (
    <p role="alert" className="text-sm text-danger">
      {message}
    </p>
  );
}

function InfoNote({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border-l-2 border-accent bg-surface-2 px-4 py-3 font-mono text-xs text-muted">
      {children}
    </div>
  );
}

function AssessmentForm({
  onCreated,
}: {
  onCreated: (assessment: Assessment) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      const assessment = await request<Assessment>("/assessments", {
        organization_id: form.get("organizationId"),
        title: form.get("title"),
        starts_at: new Date(String(form.get("startsAt"))).toISOString(),
        ends_at: new Date(String(form.get("endsAt"))).toISOString(),
      });
      onCreated(assessment);
      formElement.reset();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "시험 생성에 실패했습니다.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <StepCard step="01" title="시험 생성" detail="출제 묶음과 시험 시간을 정의합니다.">
        <TextField label="조직 ID" name="organizationId" placeholder="org_acme" />
        <TextField
          label="시험 제목"
          name="title"
          placeholder="2026 백엔드 개발자 코딩테스트"
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label="시작 시간" name="startsAt" type="datetime-local" />
          <TextField label="종료 시간" name="endsAt" type="datetime-local" />
        </div>
        <SubmitButton busy={busy} label="시험 생성" />
        {error && <ErrorText message={error} />}
      </StepCard>
    </form>
  );
}

function ProblemForm({
  assessmentId,
  problems,
  onCreated,
}: {
  assessmentId: string;
  problems: ProblemSummary[];
  onCreated: (title: string) => void;
}) {
  const [languages, setLanguages] = useState<string[]>(["python"]);
  const [testCases, setTestCases] = useState<TestCaseDraft[]>([
    { stdin: "", expected_stdout: "", hidden: false },
    { stdin: "", expected_stdout: "", hidden: true },
  ]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const updateTestCase = (index: number, patch: Partial<TestCaseDraft>) =>
    setTestCases((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!assessmentId) {
      setError("먼저 시험을 생성·선택하세요.");
      return;
    }
    setBusy(true);
    setError("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      const title = String(form.get("title"));
      await request("/problems", {
        assessment_id: assessmentId,
        title,
        statement: form.get("statement"),
        allowed_languages: languages,
        starter_code: {},
        time_limit_ms: Number(form.get("timeLimit")),
        memory_limit_mb: Number(form.get("memoryLimit")),
        pass_threshold: Number(form.get("passThreshold")) / 100,
        test_cases: testCases,
      });
      onCreated(title);
      formElement.reset();
      setLanguages(["python"]);
      setTestCases([
        { stdin: "", expected_stdout: "", hidden: false },
        { stdin: "", expected_stdout: "", hidden: true },
      ]);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "문제 출제에 실패했습니다.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <StepCard
        step="02"
        title="문제 출제"
        detail="설명, 언어, 채점 케이스를 직접 입력합니다."
        className="lg:row-span-2"
      >
        {!assessmentId ? (
          <InfoNote>먼저 ① 시험을 생성·선택하면 문제를 출제할 수 있습니다.</InfoNote>
        ) : (
          <>
            {problems.length > 0 && (
              <InfoNote>
                <strong className="text-text">출제된 문제 {problems.length}개</strong>
                {problems.map((problem, index) => (
                  <span key={problem.id}>
                    {index + 1}. {problem.title}
                  </span>
                ))}
              </InfoNote>
            )}
            <TextField label="문제 제목" name="title" placeholder="A + B" />
            <Field label="문제 설명" htmlFor="field-statement">
              <Textarea
                id="field-statement"
                name="statement"
                rows={5}
                required
                placeholder="입력 형식과 출력 조건을 포함해 작성하세요."
              />
            </Field>
            <fieldset className="space-y-2">
              <legend className="text-xs font-semibold text-muted">허용 언어</legend>
              <div className="flex flex-wrap gap-3">
                {LANGUAGE_OPTIONS.map(([value, label]) => (
                  <label
                    key={value}
                    className="flex items-center gap-2 text-sm text-text"
                  >
                    <input
                      type="checkbox"
                      checked={languages.includes(value)}
                      onChange={(event) =>
                        setLanguages((current) =>
                          event.target.checked
                            ? [...current, value]
                            : current.filter((item) => item !== value),
                        )
                      }
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField
                label="시간 제한(ms)"
                name="timeLimit"
                type="number"
                defaultValue="2000"
              />
              <TextField
                label="메모리(MB)"
                name="memoryLimit"
                type="number"
                defaultValue="128"
              />
            </div>
            <TextField
              label="다음 문제 해금 통과율(%)"
              name="passThreshold"
              type="number"
              defaultValue="100"
            />
            <div className="space-y-3">
              {testCases.map((testCase, index) => (
                <section
                  className="space-y-2 rounded-lg border border-border bg-surface-2 p-3"
                  key={index}
                >
                  <header className="flex items-center justify-between">
                    <strong className="text-sm text-text">
                      테스트 {index + 1}
                    </strong>
                    <label className="flex items-center gap-2 text-xs text-muted">
                      <input
                        type="checkbox"
                        checked={testCase.hidden}
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
                    onChange={(event) =>
                      updateTestCase(index, { stdin: event.target.value })
                    }
                    placeholder="stdin"
                  />
                  <Textarea
                    rows={2}
                    aria-label={`테스트 ${index + 1} 예상 출력`}
                    value={testCase.expected_stdout}
                    onChange={(event) =>
                      updateTestCase(index, {
                        expected_stdout: event.target.value,
                      })
                    }
                    placeholder="expected stdout (마지막 줄바꿈 포함 주의)"
                  />
                </section>
              ))}
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
                테스트 케이스 추가
              </Button>
            </div>
            <SubmitButton
              busy={busy}
              label="문제 출제"
              disabled={languages.length === 0}
            />
          </>
        )}
        {error && <ErrorText message={error} />}
      </StepCard>
    </form>
  );
}

function InviteForm({
  assessmentId,
  participantCount,
  onCreated,
}: {
  assessmentId: string;
  participantCount: number;
  onCreated: (inviteUrl: string, candidateId: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");
  const [copied, setCopied] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!assessmentId) {
      setError("먼저 시험을 생성·선택하세요.");
      return;
    }
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const candidateId = String(form.get("candidateId"));
    try {
      const invite = await request<{ invite_url: string }>(
        `/assessments/${encodeURIComponent(assessmentId)}/invites`,
        {
          candidate_id: candidateId,
          expires_at: new Date(String(form.get("expiresAt"))).toISOString(),
        },
      );
      setInviteUrl(invite.invite_url);
      setCopied(false);
      onCreated(invite.invite_url, candidateId);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "초대 링크 생성에 실패했습니다.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
    } catch {
      setError("클립보드 복사에 실패했습니다. 링크를 직접 선택해 복사하세요.");
    }
  }

  return (
    <form onSubmit={submit}>
      <StepCard
        step="03"
        title="참가자 초대"
        detail={`1회용 인증 링크를 생성합니다. 현재 ${participantCount}명 초대됨.`}
      >
        {!assessmentId ? (
          <InfoNote>
            먼저 ① 시험을 생성·선택하면 참가자를 초대할 수 있습니다.
          </InfoNote>
        ) : (
          <>
            <TextField
              label="응시자 ID"
              name="candidateId"
              placeholder="candidate_20260001"
            />
            <TextField label="만료 시간" name="expiresAt" type="datetime-local" />
            <InfoNote>
              <strong className="text-text">식별 기준</strong>
              <span>candidate_id = 사람</span>
              <span>초대 링크 교환 시 session_id가 생성됩니다</span>
            </InfoNote>
            <SubmitButton busy={busy} label="초대 링크 생성" />
            {inviteUrl && (
              <output className="flex flex-col gap-2 rounded-lg border border-border bg-surface-2 p-3 text-xs">
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    type="button"
                    onClick={() => void copyLink()}
                  >
                    {copied ? "복사됨 ✓" : "링크 복사"}
                  </Button>
                </div>
                <span className="break-all font-mono text-muted">{inviteUrl}</span>
              </output>
            )}
          </>
        )}
        {error && <ErrorText message={error} />}
      </StepCard>
    </form>
  );
}

function statusLabel(participant: ParticipantStatus): string {
  if (!participant.redeemed) return "초대됨";
  if (participant.session_status === "finished") return "응시 종료";
  if (participant.session_status === "submitted") return "제출 완료";
  return "응시 중";
}

function ParticipantMonitor({
  assessmentId,
  participants,
}: {
  assessmentId: string;
  participants: ParticipantStatus[];
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [highRiskOnly, setHighRiskOnly] = useState(false);
  const [risk, setRisk] = useState<
    Record<string, RiskAssessment | "loading" | "error">
  >({});

  const visible = useMemo(() => {
    const filtered = highRiskOnly
      ? participants.filter(
          (p) => p.risk_score != null && riskTone(p.risk_score) === "high",
        )
      : participants;
    // 위험 점수 내림차순(점수 없는 참가자는 뒤로) 정렬해 고위험을 먼저 노출.
    return [...filtered].sort(
      (a, b) => (b.risk_score ?? -1) - (a.risk_score ?? -1),
    );
  }, [participants, highRiskOnly]);

  async function toggle(participant: ParticipantStatus) {
    const sessionId = participant.session_id;
    if (!sessionId) return;
    if (expanded === sessionId) {
      setExpanded(null);
      return;
    }
    setExpanded(sessionId);
    const current = risk[sessionId];
    if (!current || current === "error") {
      setRisk((state) => ({ ...state, [sessionId]: "loading" }));
      try {
        const assessment = await fetchRiskAssessment(sessionId);
        setRisk((state) => ({ ...state, [sessionId]: assessment }));
      } catch {
        setRisk((state) => ({ ...state, [sessionId]: "error" }));
      }
    }
  }

  return (
    <StepCard
      step="04"
      title="참가자 모니터링"
      detail="응시 상태·풀이 진행·위험을 10초마다 자동 새로고침합니다."
    >
      {!assessmentId ? (
        <InfoNote>시험을 선택하면 참가자 현황이 표시됩니다.</InfoNote>
      ) : participants.length === 0 ? (
        <InfoNote>아직 초대한 참가자가 없습니다. ③에서 초대하세요.</InfoNote>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted">
              위험 점수 높은 순 · {visible.length}/{participants.length}명
            </span>
            <Button
              variant={highRiskOnly ? "primary" : "secondary"}
              size="sm"
              type="button"
              aria-pressed={highRiskOnly}
              onClick={() => setHighRiskOnly((value) => !value)}
            >
              고위험만
            </Button>
          </div>

          <div className="overflow-hidden rounded-lg border border-border">
            <div className="hidden grid-cols-[1.5fr_1fr_0.8fr_0.8fr_auto] gap-2 bg-surface-2 px-4 py-2 text-[11px] font-semibold uppercase text-muted sm:grid">
              <span>응시자</span>
              <span>상태</span>
              <span>진행</span>
              <span>위험</span>
              <span />
            </div>
            {visible.map((participant) => {
              const sessionId = participant.session_id;
              const tone =
                participant.risk_score != null
                  ? riskTone(participant.risk_score)
                  : null;
              const isOpen = Boolean(sessionId) && expanded === sessionId;
              const detail = sessionId ? risk[sessionId] : undefined;
              return (
                <div
                  key={participant.candidate_id + (sessionId ?? "")}
                  className={cn(
                    "border-t border-border first:border-t-0",
                    tone === "high" && "bg-risk-high-soft/50",
                  )}
                >
                  <button
                    type="button"
                    disabled={!sessionId}
                    onClick={() => void toggle(participant)}
                    aria-expanded={isOpen}
                    className={cn(
                      "grid w-full grid-cols-2 items-center gap-2 px-4 py-3 text-left text-sm transition-colors sm:grid-cols-[1.5fr_1fr_0.8fr_0.8fr_auto]",
                      sessionId
                        ? "cursor-pointer hover:bg-surface-2"
                        : "cursor-default opacity-70",
                    )}
                  >
                    <span className="truncate font-mono text-text">
                      {participant.candidate_id}
                    </span>
                    <span
                      className={cn(
                        "text-xs",
                        participant.redeemed ? "text-success" : "text-muted",
                      )}
                    >
                      {statusLabel(participant)}
                    </span>
                    <span className="text-xs text-muted">
                      {participant.solved_count}/{participant.total_problems}
                    </span>
                    <span>
                      {participant.risk_score != null && tone ? (
                        <Badge tone={tone}>
                          {Math.round(participant.risk_score)}
                        </Badge>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </span>
                    <span className="text-xs text-accent">
                      {sessionId ? (isOpen ? "근거 ▲" : "근거 ▼") : ""}
                    </span>
                  </button>
                  {isOpen && sessionId && (
                    <div className="border-t border-border bg-surface px-4 py-4">
                      {detail === "loading" && (
                        <p className="text-sm text-muted">
                          위험 평가를 불러오는 중…
                        </p>
                      )}
                      {detail === "error" && (
                        <ErrorText message="위험 평가를 불러오지 못했습니다." />
                      )}
                      {detail &&
                        detail !== "loading" &&
                        detail !== "error" && (
                          <AssessmentView assessment={detail} />
                        )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </StepCard>
  );
}

function PendingUsers({ onNotice }: { onNotice: (message: string) => void }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [busyUserId, setBusyUserId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${PLATFORM_API_URL}/admin/users/pending`)
      .then((response) => (response.ok ? response.json() : []))
      .then((items: AdminUser[]) => setUsers(items))
      .catch(() => setError("승인 대기 목록을 불러오지 못했습니다."));
  }, []);

  async function approve(user: AdminUser, role: "admin" | "reviewer") {
    setBusyUserId(user.id);
    setError("");
    try {
      await request(`/admin/users/${encodeURIComponent(user.id)}/approve`, {
        role,
      });
      setUsers((current) => current.filter((item) => item.id !== user.id));
      onNotice(`${user.email} 계정을 ${role} 권한으로 승인했습니다.`);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "계정 승인에 실패했습니다.",
      );
    } finally {
      setBusyUserId("");
    }
  }

  return (
    <StepCard
      step="·"
      title="관리자 가입 승인"
      detail="워크플로우와 별개로 대기 중인 관리자 계정을 승인합니다."
    >
      {users.length === 0 ? (
        <InfoNote>승인 대기 중인 계정이 없습니다.</InfoNote>
      ) : (
        users.map((user) => (
          <article
            key={user.id}
            className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface-2 px-4 py-3"
          >
            <div className="mr-auto">
              <strong className="block text-sm text-text">
                {user.display_name}
              </strong>
              <span className="text-xs text-muted">{user.email}</span>
            </div>
            <Button
              variant="secondary"
              size="sm"
              type="button"
              disabled={busyUserId === user.id}
              onClick={() => void approve(user, "reviewer")}
            >
              reviewer 승인
            </Button>
            <Button
              size="sm"
              type="button"
              disabled={busyUserId === user.id}
              onClick={() => void approve(user, "admin")}
            >
              admin 승인
            </Button>
          </article>
        ))
      )}
      {error && <ErrorText message={error} />}
    </StepCard>
  );
}
