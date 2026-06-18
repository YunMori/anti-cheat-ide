"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  fetchRiskAssessment,
  formatEvidenceValue,
  getRiskBand,
  getRiskBandLabel,
  RiskAssessment,
  RiskLookupError,
} from "../lib/risk";
import { ManagementDesk } from "./management-desk";

type ViewState =
  | { status: "empty" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "success"; assessment: RiskAssessment };

type AdminUser = {
  id: string;
  email: string;
  display_name: string;
  role: "admin" | "reviewer" | null;
  status: "pending" | "active";
};

type AuthState =
  | { status: "loading" }
  | { status: "anonymous" }
  | { status: "authenticated"; user: AdminUser };

export default function Home() {
  const [sessionId, setSessionId] = useState("");
  const [view, setView] = useState<ViewState>({ status: "empty" });
  const [auth, setAuth] = useState<AuthState>({ status: "loading" });
  const abortController = useRef<AbortController | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((response) =>
        response.ok
          ? response.json()
          : Promise.reject(new Error("not authenticated")),
      )
      .then((user: AdminUser) => setAuth({ status: "authenticated", user }))
      .catch(() => setAuth({ status: "anonymous" }));
    return () => abortController.current?.abort();
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setAuth({ status: "anonymous" });
    setView({ status: "empty" });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedSessionId = sessionId.trim();
    if (!normalizedSessionId) {
      setView({ status: "error", message: "조회할 세션 ID를 입력하세요." });
      return;
    }

    abortController.current?.abort();
    abortController.current = new AbortController();
    setView({ status: "loading" });

    try {
      const assessment = await fetchRiskAssessment(
        normalizedSessionId,
        abortController.current.signal,
      );
      setView({ status: "success", assessment });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      const message =
        error instanceof RiskLookupError
          ? error.message
          : "Platform API에 연결할 수 없습니다. API 주소와 실행 상태를 확인하세요.";
      setView({ status: "error", message });
    }
  }

  return (
    <main>
      <header className="masthead">
        <Link className="brand" href="/" aria-label="Session Review 홈">
          <span className="brandMark" aria-hidden="true">SR</span>
          <span>
            <strong>Session Review</strong>
            <small>근거 중심 검토 도구</small>
          </span>
        </Link>
        <span className="environment">
          {auth.status === "authenticated"
            ? `${auth.user.display_name} · ${auth.user.role}`
            : "관리자 전용 · MVP"}
        </span>
      </header>

      {auth.status === "loading" && <LoadingState />}
      {auth.status === "anonymous" && (
        <AuthPanel onAuthenticated={(user) => setAuth({ status: "authenticated", user })} />
      )}

      {auth.status === "authenticated" && auth.user.role && (
        <>
          <div className="searchSection">
            <button className="secondaryButton" type="button" onClick={() => void handleLogout()}>
              로그아웃
            </button>
          </div>

          <ManagementDesk role={auth.user.role} />

      <section className="searchSection" aria-labelledby="search-title">
        <div className="sectionIntro">
          <p className="eyebrow">Review desk</p>
          <h1 id="search-title">세션의 판단 근거를 검토하세요.</h1>
          <p>
            위험 신호는 검토 순서를 정하는 보조 정보입니다. 점수와 근거를 함께 확인한 뒤
            사람의 판단을 기록하세요.
          </p>
        </div>

        <form className="searchForm" onSubmit={handleSubmit}>
          <label htmlFor="session-id">세션 ID</label>
          <div className="searchControls">
            <input
              id="session-id"
              name="sessionId"
              type="search"
              value={sessionId}
              onChange={(event) => setSessionId(event.target.value)}
              placeholder="예: ses_7f13..."
              autoComplete="off"
              aria-describedby="session-help"
            />
            <button type="submit" disabled={view.status === "loading"}>
              {view.status === "loading" ? "조회 중..." : "위험 평가 조회"}
            </button>
          </div>
          <p id="session-help">Platform API에서 생성된 전체 세션 ID를 입력하세요.</p>
        </form>
      </section>

      <aside className="policy" aria-label="검토 정책">
        <span className="policyIcon" aria-hidden="true">!</span>
        <p>
          <strong>자동 탈락 금지</strong>
          탐지 점수만으로 응시자를 탈락시키지 않습니다. 신호별 근거와 시험 맥락을 사람이
          검토해야 합니다.
        </p>
      </aside>

      <section className="results" aria-live="polite" aria-busy={view.status === "loading"}>
        {view.status === "empty" && <EmptyState />}
        {view.status === "loading" && <LoadingState />}
        {view.status === "error" && <ErrorState message={view.message} />}
        {view.status === "success" && <AssessmentView assessment={view.assessment} />}
      </section>
        </>
      )}
    </main>
  );
}

function AuthPanel({
  onAuthenticated,
}: {
  onAuthenticated: (user: AdminUser) => void;
}) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    const form = new FormData(event.currentTarget);
    const payload =
      mode === "login"
        ? {
            email: form.get("email"),
            password: form.get("password"),
          }
        : {
            email: form.get("email"),
            password: form.get("password"),
            display_name: form.get("displayName"),
          };

    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          typeof body?.detail === "string"
            ? body.detail
            : `요청 실패 (${response.status})`,
        );
      }
      if (mode === "login") {
        onAuthenticated(body as AdminUser);
        return;
      }
      setNotice(
        body.status === "active"
          ? "첫 관리자 계정이 생성되었습니다. 이제 로그인하세요."
          : "가입 요청이 접수되었습니다. 기존 관리자의 승인을 기다리세요.",
      );
      setMode("login");
    } catch (caught) {
      setNotice(caught instanceof Error ? caught.message : "요청에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="searchSection" aria-labelledby="auth-title">
      <div className="sectionIntro">
        <p className="eyebrow">Admin access</p>
        <h1 id="auth-title">{mode === "login" ? "관리자 로그인" : "관리자 가입 요청"}</h1>
        <p>
          첫 가입자는 자동 admin으로 승인됩니다. 이후 가입자는 기존 admin 승인이 필요합니다.
        </p>
      </div>
      <form className="searchForm" onSubmit={submit}>
        {mode === "signup" && (
          <>
            <label htmlFor="display-name">이름</label>
            <input id="display-name" name="displayName" required placeholder="홍길동" />
          </>
        )}
        <label htmlFor="admin-email">이메일</label>
        <input id="admin-email" name="email" required type="email" placeholder="admin@example.com" />
        <label htmlFor="admin-password">비밀번호</label>
        <input id="admin-password" name="password" required type="password" minLength={8} />
        <div className="searchControls">
          <button type="submit" disabled={busy}>
            {busy ? "처리 중..." : mode === "login" ? "로그인" : "가입 요청"}
          </button>
          <button
            className="secondaryButton"
            type="button"
            onClick={() => {
              setNotice("");
              setMode(mode === "login" ? "signup" : "login");
            }}
          >
            {mode === "login" ? "가입 요청" : "로그인으로 돌아가기"}
          </button>
        </div>
        {notice && <p id="session-help">{notice}</p>}
      </form>
    </section>
  );
}

function EmptyState() {
  return (
    <div className="stateCard">
      <span className="stateSymbol" aria-hidden="true">⌕</span>
      <h2>검토할 세션을 검색하세요</h2>
      <p>세션 ID를 입력하면 위험 점수와 신호별 근거가 여기에 표시됩니다.</p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="stateCard">
      <span className="loader" aria-hidden="true" />
      <h2>위험 평가를 불러오는 중입니다</h2>
      <p>Platform API 응답을 기다리고 있습니다.</p>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="stateCard errorState" role="alert">
      <span className="stateSymbol" aria-hidden="true">×</span>
      <h2>평가를 표시할 수 없습니다</h2>
      <p>{message}</p>
    </div>
  );
}

function AssessmentView({ assessment }: { assessment: RiskAssessment }) {
  const band = getRiskBand(assessment.risk_score);

  return (
    <div className="assessment">
      <section className={`scoreCard ${band}`} aria-labelledby="risk-score-title">
        <div>
          <p className="eyebrow">Risk assessment</p>
          <h2 id="risk-score-title">위험 평가</h2>
          <dl className="metadata">
            <div>
              <dt>세션</dt>
              <dd>{assessment.session_id}</dd>
            </div>
            <div>
              <dt>모델 버전</dt>
              <dd>{assessment.model_version}</dd>
            </div>
            <div>
              <dt>평가 ID</dt>
              <dd>{assessment.id}</dd>
            </div>
          </dl>
        </div>

        <div className="scoreReadout">
          <span className="scoreLabel">{getRiskBandLabel(assessment.risk_score)}</span>
          <strong>
            {assessment.risk_score}
            <small>/100</small>
          </strong>
          <span className="reviewFlag">
            {assessment.review_recommended ? "사람의 검토 권장" : "정기 검토"}
          </span>
        </div>
      </section>

      <section className="signalSection" aria-labelledby="signals-title">
        <div className="signalHeading">
          <div>
            <p className="eyebrow">Evidence ledger</p>
            <h2 id="signals-title">신호별 근거</h2>
          </div>
          <span>{assessment.signals.length}개 신호</span>
        </div>

        {assessment.signals.length === 0 ? (
          <div className="noSignals">
            <h3>기록된 위험 신호가 없습니다</h3>
            <p>현재 평가에는 검토할 신호별 근거가 포함되지 않았습니다.</p>
          </div>
        ) : (
          <ol className="signalList">
            {assessment.signals.map((signal, index) => (
              <li key={`${signal.code}-${index}`}>
                <article className="signalCard">
                  <header>
                    <span className="signalIndex" aria-hidden="true">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <h3>{signal.code}</h3>
                      <p>탐지 규칙이 기록한 검토 근거</p>
                    </div>
                    <strong className="signalScore">{signal.score}/100</strong>
                  </header>

                  <dl className="evidenceList">
                    {Object.entries(signal.evidence).map(([key, value]) => (
                      <div key={key}>
                        <dt>{key}</dt>
                        <dd>
                          <pre>{formatEvidenceValue(value)}</pre>
                        </dd>
                      </div>
                    ))}
                  </dl>
                </article>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
