"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { ManagementDesk } from "./management-desk";

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
  const [auth, setAuth] = useState<AuthState>({ status: "loading" });

  useEffect(() => {
    fetch("/api/auth/me")
      .then((response) =>
        response.ok
          ? response.json()
          : Promise.reject(new Error("not authenticated")),
      )
      .then((user: AdminUser) => setAuth({ status: "authenticated", user }))
      .catch(() => setAuth({ status: "anonymous" }));
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setAuth({ status: "anonymous" });
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

          <aside className="policy" aria-label="검토 정책">
            <span className="policyIcon" aria-hidden="true">!</span>
            <p>
              <strong>자동 탈락 금지</strong>
              탐지 점수만으로 응시자를 탈락시키지 않습니다. 신호별 근거와 시험 맥락을 사람이
              검토해야 합니다.
            </p>
          </aside>
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

function LoadingState() {
  return (
    <div className="stateCard">
      <span className="loader" aria-hidden="true" />
      <h2>관리자 인증을 확인하는 중입니다</h2>
      <p>잠시만 기다려 주세요.</p>
    </div>
  );
}
