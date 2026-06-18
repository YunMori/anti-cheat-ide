"use client";

import { FormEvent, useEffect, useState } from "react";

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
  const [notice, setNotice] = useState("");

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

  return (
    <section className="managementDesk" aria-labelledby="management-title">
      <header className="deskHeading">
        <div>
          <p className="eyebrow">Assessment operations</p>
          <h1 id="management-title">시험을 만들고, 출제하고, 응시자를 초대하세요.</h1>
        </div>
        <p>
          출제 데이터와 응시 세션을 분리해 관리합니다. 숨은 테스트 케이스는 응시자
          브라우저에 전달되지 않습니다.
        </p>
      </header>

      {notice && <p className="operationNotice" role="status">{notice}</p>}

      <div className="operationGrid">
        {role === "admin" ? (
          <>
            <AssessmentForm
              onCreated={(assessment) => {
                setAssessments((current) => [...current, assessment]);
                setNotice(`시험 "${assessment.title}"을 생성했습니다.`);
              }}
            />
            <ProblemForm
              assessments={assessments}
              onCreated={(title) => setNotice(`문제 "${title}"을 출제했습니다.`)}
            />
            <InviteForm
              assessments={assessments}
              onCreated={(inviteUrl, candidateId) =>
                setNotice(`응시자 ${candidateId} 초대 링크를 생성했습니다: ${inviteUrl}`)
              }
            />
            <PendingUsers onNotice={setNotice} />
          </>
        ) : (
          <article className="operationCard">
            <CardHeader step="RO" title="검토자 권한" detail="위험 평가 조회만 가능합니다." />
            <p className="identityNote">
              시험 생성, 문제 출제, 참가자 초대 생성은 admin 권한이 필요합니다.
            </p>
          </article>
        )}
      </div>
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
  assessments,
  onCreated,
}: {
  assessments: Assessment[];
  onCreated: (title: string) => void;
}) {
  const [languages, setLanguages] = useState<string[]>(["python"]);
  const [testCases, setTestCases] = useState<TestCaseDraft[]>([
    { stdin: "", expected_stdout: "", hidden: false },
    { stdin: "", expected_stdout: "", hidden: true },
  ]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      const title = String(form.get("title"));
      await request("/problems", {
        assessment_id: form.get("assessmentId"),
        title,
        statement: form.get("statement"),
        allowed_languages: languages,
        starter_code: {},
        time_limit_ms: Number(form.get("timeLimit")),
        memory_limit_mb: Number(form.get("memoryLimit")),
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
      <CardHeader step="02" title="문제 수동 출제" detail="설명, 언어, 채점 케이스를 직접 입력합니다." />
      <AssessmentSelect assessments={assessments} />
      <Field label="문제 제목" name="title" placeholder="A + B" />
      <label className="field">
        <span>문제 설명</span>
        <textarea name="statement" rows={5} required placeholder="입력 형식과 출력 조건을 포함해 작성하세요." />
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
                    setTestCases((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, hidden: event.target.checked } : item,
                      ),
                    )
                  }
                />
                숨은 케이스
              </label>
            </header>
            <textarea
              aria-label={`테스트 ${index + 1} 입력`}
              value={testCase.stdin}
              onChange={(event) =>
                setTestCases((current) =>
                  current.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, stdin: event.target.value } : item,
                  ),
                )
              }
              placeholder="stdin"
            />
            <textarea
              aria-label={`테스트 ${index + 1} 예상 출력`}
              value={testCase.expected_stdout}
              onChange={(event) =>
                setTestCases((current) =>
                  current.map((item, itemIndex) =>
                    itemIndex === index
                      ? { ...item, expected_stdout: event.target.value }
                      : item,
                  ),
                )
              }
              placeholder="expected stdout"
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
      {error && <ErrorText message={error} />}
    </form>
  );
}

function InviteForm({
  assessments,
  onCreated,
}: {
  assessments: Assessment[];
  onCreated: (inviteUrl: string, candidateId: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const candidateId = String(form.get("candidateId"));
    const assessmentId = String(form.get("assessmentId"));
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
      <CardHeader step="03" title="참가자 초대 링크" detail="1회용 인증 링크를 생성합니다." />
      <AssessmentSelect assessments={assessments} />
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
      {error && <ErrorText message={error} />}
    </form>
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
      <CardHeader step="04" title="관리자 가입 승인" detail="대기 중인 관리자 계정을 승인합니다." />
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

function AssessmentSelect({ assessments }: { assessments: Assessment[] }) {
  return (
    <label className="field">
      <span>시험</span>
      <select name="assessmentId" required defaultValue="">
        <option value="" disabled>시험을 선택하세요</option>
        {assessments.map((assessment) => (
          <option key={assessment.id} value={assessment.id}>{assessment.title}</option>
        ))}
      </select>
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
  return <button className="primaryButton" type="submit" disabled={busy || disabled}>{busy ? "처리 중..." : label}</button>;
}

function ErrorText({ message }: { message: string }) {
  return <p className="formError" role="alert">{message}</p>;
}
