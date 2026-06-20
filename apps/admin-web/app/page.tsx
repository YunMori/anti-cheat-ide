"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import {
  Button,
  Card,
  Field,
  Input,
  StateCard,
  ThemeToggle,
} from "@ide/ui";
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
    <main className="mx-auto w-[min(1180px,calc(100%-2rem))] pb-20">
      <header className="flex items-center justify-between gap-4 py-6">
        <Link
          className="flex items-center gap-3 text-text no-underline"
          href="/"
          aria-label="Session Review 홈"
        >
          <span
            className="flex size-9 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-fg"
            aria-hidden="true"
          >
            SR
          </span>
          <span className="flex flex-col leading-tight">
            <strong className="text-sm font-bold">Session Review</strong>
            <small className="text-xs text-muted">근거 중심 검토 도구</small>
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-muted sm:inline">
            {auth.status === "authenticated"
              ? `${auth.user.display_name} · ${auth.user.role}`
              : "관리자 전용 · MVP"}
          </span>
          <ThemeToggle />
        </div>
      </header>

      {auth.status === "loading" && (
        <StateCard tone="loading" title="관리자 인증을 확인하는 중입니다" description="잠시만 기다려 주세요." />
      )}
      {auth.status === "anonymous" && (
        <AuthPanel
          onAuthenticated={(user) => setAuth({ status: "authenticated", user })}
        />
      )}

      {auth.status === "authenticated" && auth.user.role && (
        <>
          <div className="mb-4 flex justify-end">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void handleLogout()}
            >
              로그아웃
            </Button>
          </div>

          <ManagementDesk role={auth.user.role} />

          <aside
            className="mt-8 flex items-start gap-3 rounded-xl border-l-4 border-warning bg-risk-medium-soft p-4"
            aria-label="검토 정책"
          >
            <span
              className="flex size-6 shrink-0 items-center justify-center rounded-full bg-warning font-bold text-white"
              aria-hidden="true"
            >
              !
            </span>
            <p className="text-sm text-text">
              <strong className="mr-1 font-bold">자동 탈락 금지.</strong>
              탐지 점수만으로 응시자를 탈락시키지 않습니다. 신호별 근거와 시험
              맥락을 사람이 검토해야 합니다.
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
    <section aria-labelledby="auth-title" className="mx-auto max-w-md">
      <div className="mb-4 space-y-1 text-center">
        <p className="text-xs font-bold uppercase tracking-wider text-accent">
          Admin access
        </p>
        <h1 id="auth-title" className="text-2xl font-bold text-text">
          {mode === "login" ? "관리자 로그인" : "관리자 가입 요청"}
        </h1>
        <p className="text-sm text-muted">
          첫 가입자는 자동 admin으로 승인됩니다. 이후 가입자는 기존 admin 승인이
          필요합니다.
        </p>
      </div>
      <Card className="p-6">
        <form className="space-y-4" onSubmit={submit}>
          {mode === "signup" && (
            <Field label="이름" htmlFor="display-name">
              <Input id="display-name" name="displayName" required placeholder="홍길동" />
            </Field>
          )}
          <Field label="이메일" htmlFor="admin-email">
            <Input
              id="admin-email"
              name="email"
              required
              type="email"
              placeholder="admin@example.com"
            />
          </Field>
          <Field label="비밀번호" htmlFor="admin-password">
            <Input id="admin-password" name="password" required type="password" minLength={8} />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={busy}>
              {busy ? "처리 중…" : mode === "login" ? "로그인" : "가입 요청"}
            </Button>
            <Button
              variant="secondary"
              type="button"
              onClick={() => {
                setNotice("");
                setMode(mode === "login" ? "signup" : "login");
              }}
            >
              {mode === "login" ? "가입 요청" : "로그인으로 돌아가기"}
            </Button>
          </div>
          {notice && (
            <p role="status" className="text-sm text-muted">
              {notice}
            </p>
          )}
        </form>
      </Card>
    </section>
  );
}
