"use client";

import { FormEvent, useEffect, useState } from "react";

import { fetchRiskAssessment, getRiskBand, RiskAssessment } from "../lib/risk";
import { AssessmentView } from "./risk-view";

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
          setNotice("시험 목록을 불러오지 못했습니다. Platform API 상태를 확인하세요.");
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
    <section className="managementDesk" aria-labelledby="management-title">
      <header className="deskHeading">
        <div>
          <p className="eyebrow">Assessment operations</p>
          <h1 id="management-title">시험을 만들고, 출제하고, 참가자를 모니터링하세요.</h1>
        </div>
        <p>
          시험 하나를 선택하면 출제·초대·모니터링이 모두 그 시험으로 이어집니다.
          숨은 테스트 케이스는 응시자 브라우저에 전달되지 않습니다.
        </p>
      </header>

      {notice && (
        <p className="operationNotice" role="status">
          {notice}
        </p>
      )}

      <div className="contextBar">
        <label className="field">
          <span>현재 시험</span>
          <select
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
          </select>
        </label>
        {activeAssessment && (
          <div className="contextMeta">
            <span>
              <strong>{problems.length}</strong> 문제
            </span>
            <span>
              <strong>{participants.length}</strong> 참가자
            </span>
          </div>
        )}
      </div>

      <div className="workflowSteps">
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

        <ParticipantMonitor
          assessmentId={activeAssessmentId}
          participants={participants}
        />
      </div>

      {role === "admin" && (
        <div className="adminSettings">
          <PendingUsers onNotice={setNotice} />
        </div>
      )}
    </section>
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
      setError(caught instanceof Error ? caught.message : "시험 생성에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="operationCard" onSubmit={submit}>
      <CardHeader step="01" title="시험 생성" detail="출제 묶음과 시험 시간을 정의합니다." />
      <Field label="조직 ID" name="organizationId" placeholder="org_acme" />
      <Field label="시험 제목" name="title" placeholder="2026 백엔드 개발자 코딩테스트" />
      <div className="fieldPair">
        <Field label="시작 시간" name="startsAt" type="datetime-local" />
        <Field label="종료 시간" name="endsAt" type="datetime-local" />
      </div>
      <ActionButton busy={busy} label="시험 생성" />
      {error && <ErrorText message={error} />}
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
      setError(caught instanceof Error ? caught.message : "문제 출제에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="operationCard featuredCard" onSubmit={submit}>
      <CardHeader step="02" title="문제 출제" detail="설명, 언어, 채점 케이스를 직접 입력합니다." />
      {!assessmentId ? (
        <p className="identityNote">먼저 ① 시험을 생성·선택하면 문제를 출제할 수 있습니다.</p>
      ) : (
        <>
          {problems.length > 0 && (
            <div className="identityNote">
              <strong>출제된 문제 {problems.length}개</strong>
              {problems.map((problem, index) => (
                <span key={problem.id}>
                  {index + 1}. {problem.title}
                </span>
              ))}
            </div>
          )}
          <Field label="문제 제목" name="title" placeholder="A + B" />
          <label className="field">
            <span>문제 설명</span>
            <textarea
              name="statement"
              rows={5}
              required
              placeholder="입력 형식과 출력 조건을 포함해 작성하세요."
            />
          </label>
          <fieldset className="languageField">
            <legend>허용 언어</legend>
            <div>
              {LANGUAGE_OPTIONS.map(([value, label]) => (
                <label key={value}>
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
          <div className="fieldPair">
            <Field label="시간 제한(ms)" name="timeLimit" type="number" defaultValue="2000" />
            <Field label="메모리(MB)" name="memoryLimit" type="number" defaultValue="128" />
          </div>
          <Field
            label="다음 문제 해금 통과율(%)"
            name="passThreshold"
            type="number"
            defaultValue="100"
          />
          <div className="testCaseStack">
            {testCases.map((testCase, index) => (
              <section className="testCaseEditor" key={index}>
                <header>
                  <strong>테스트 {index + 1}</strong>
                  <label>
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
                <textarea
                  aria-label={`테스트 ${index + 1} 입력`}
                  value={testCase.stdin}
                  onChange={(event) =>
                    updateTestCase(index, { stdin: event.target.value })
                  }
                  placeholder="stdin"
                />
                <textarea
                  aria-label={`테스트 ${index + 1} 예상 출력`}
                  value={testCase.expected_stdout}
                  onChange={(event) =>
                    updateTestCase(index, { expected_stdout: event.target.value })
                  }
                  placeholder="expected stdout (마지막 줄바꿈 포함 주의)"
                />
              </section>
            ))}
            <button
              className="secondaryButton"
              type="button"
              onClick={() =>
                setTestCases((current) => [
                  ...current,
                  { stdin: "", expected_stdout: "", hidden: true },
                ])
              }
            >
              테스트 케이스 추가
            </button>
          </div>
          <ActionButton busy={busy} label="문제 출제" disabled={languages.length === 0} />
        </>
      )}
      {error && <ErrorText message={error} />}
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
      onCreated(invite.invite_url, candidateId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "초대 링크 생성에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="operationCard" onSubmit={submit}>
      <CardHeader
        step="03"
        title="참가자 초대"
        detail={`1회용 인증 링크를 생성합니다. 현재 ${participantCount}명 초대됨.`}
      />
      {!assessmentId ? (
        <p className="identityNote">먼저 ① 시험을 생성·선택하면 참가자를 초대할 수 있습니다.</p>
      ) : (
        <>
          <Field label="응시자 ID" name="candidateId" placeholder="candidate_20260001" />
          <Field label="만료 시간" name="expiresAt" type="datetime-local" />
          <div className="identityNote">
            <strong>식별 기준</strong>
            <span>candidate_id = 사람</span>
            <span>초대 링크 교환 시 session_id가 생성됩니다</span>
          </div>
          <ActionButton busy={busy} label="초대 링크 생성" />
          {inviteUrl && (
            <output className="sessionOutput">
              <button
                className="secondaryButton"
                type="button"
                onClick={() => void navigator.clipboard.writeText(inviteUrl)}
              >
                링크 복사
              </button>
              {inviteUrl}
            </output>
          )}
        </>
      )}
      {error && <ErrorText message={error} />}
    </form>
  );
}

function statusLabel(participant: ParticipantStatus): string {
  if (!participant.redeemed) return "초대됨";
  if (
    participant.session_status === "submitted" ||
    participant.session_status === "finished"
  ) {
    return "제출 완료";
  }
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
  const [risk, setRisk] = useState<
    Record<string, RiskAssessment | "loading" | "error">
  >({});

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
    <section className="operationCard">
      <CardHeader
        step="04"
        title="참가자 모니터링"
        detail="응시 상태·풀이 진행·위험을 10초마다 자동 새로고침합니다."
      />
      {!assessmentId ? (
        <p className="identityNote">시험을 선택하면 참가자 현황이 표시됩니다.</p>
      ) : participants.length === 0 ? (
        <p className="identityNote">아직 초대한 참가자가 없습니다. ③에서 초대하세요.</p>
      ) : (
        <div className="participantTable">
          <div className="participantHead">
            <span>응시자</span>
            <span>상태</span>
            <span>진행</span>
            <span>위험</span>
            <span />
          </div>
          {participants.map((participant) => {
            const sessionId = participant.session_id;
            const band =
              participant.risk_score != null
                ? getRiskBand(participant.risk_score)
                : null;
            const isOpen = Boolean(sessionId) && expanded === sessionId;
            const detail = sessionId ? risk[sessionId] : undefined;
            return (
              <div
                className="participantItem"
                key={participant.candidate_id + (sessionId ?? "")}
              >
                <button
                  type="button"
                  className="participantRow"
                  disabled={!sessionId}
                  onClick={() => void toggle(participant)}
                >
                  <span className="pCand">{participant.candidate_id}</span>
                  <span className={`pStatus ${participant.redeemed ? "isLive" : ""}`}>
                    {statusLabel(participant)}
                  </span>
                  <span className="pProgress">
                    {participant.solved_count}/{participant.total_problems}
                  </span>
                  <span className="pRisk">
                    {participant.risk_score != null ? (
                      <span className={`riskBadge ${band}`}>
                        {Math.round(participant.risk_score)}
                      </span>
                    ) : (
                      "—"
                    )}
                  </span>
                  <span className="pToggle">
                    {sessionId ? (isOpen ? "근거 ▲" : "근거 ▼") : ""}
                  </span>
                </button>
                {isOpen && sessionId && (
                  <div className="participantDetail">
                    {detail === "loading" && (
                      <p className="identityNote">위험 평가를 불러오는 중…</p>
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
      )}
    </section>
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
      await request(`/admin/users/${encodeURIComponent(user.id)}/approve`, { role });
      setUsers((current) => current.filter((item) => item.id !== user.id));
      onNotice(`${user.email} 계정을 ${role} 권한으로 승인했습니다.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "계정 승인에 실패했습니다.");
    } finally {
      setBusyUserId("");
    }
  }

  return (
    <section className="operationCard">
      <CardHeader step="·" title="관리자 가입 승인" detail="워크플로우와 별개로 대기 중인 관리자 계정을 승인합니다." />
      {users.length === 0 ? (
        <p className="identityNote">승인 대기 중인 계정이 없습니다.</p>
      ) : (
        users.map((user) => (
          <article className="identityNote" key={user.id}>
            <strong>{user.display_name}</strong>
            <span>{user.email}</span>
            <button
              className="secondaryButton"
              type="button"
              disabled={busyUserId === user.id}
              onClick={() => void approve(user, "reviewer")}
            >
              reviewer 승인
            </button>
            <button
              className="secondaryButton"
              type="button"
              disabled={busyUserId === user.id}
              onClick={() => void approve(user, "admin")}
            >
              admin 승인
            </button>
          </article>
        ))
      )}
      {error && <ErrorText message={error} />}
    </section>
  );
}

function CardHeader({ step, title, detail }: { step: string; title: string; detail: string }) {
  return (
    <header className="cardHeader">
      <span>{step}</span>
      <div>
        <h2>{title}</h2>
        <p>{detail}</p>
      </div>
    </header>
  );
}

function Field({
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
    <label className="field">
      <span>{label}</span>
      <input name={name} type={type} placeholder={placeholder} defaultValue={defaultValue} required />
    </label>
  );
}

function ActionButton({
  busy,
  label,
  disabled = false,
}: {
  busy: boolean;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button className="primaryButton" type="submit" disabled={busy || disabled}>
      {busy ? "처리 중..." : label}
    </button>
  );
}

function ErrorText({ message }: { message: string }) {
  return (
    <p className="formError" role="alert">
      {message}
    </p>
  );
}
