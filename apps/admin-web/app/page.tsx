"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Card, Field, Input, StateCard, ThemeToggle } from "@ide/ui";
import { useAdminAuth } from "../lib/auth";
import type { AdminUser } from "../lib/types";

export default function Home() {
  const { auth, logout } = useAdminAuth();
  const router = useRouter();

  const authedWithRole =
    auth.status === "authenticated" && Boolean(auth.user.role);

  useEffect(() => {
    if (authedWithRole) {
      router.replace("/exams");
    }
  }, [authedWithRole, router]);

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
        <ThemeToggle />
      </header>

      {auth.status === "loading" && (
        <StateCard
          tone="loading"
          title="관리자 인증을 확인하는 중입니다"
          description="잠시만 기다려 주세요."
        />
      )}

      {auth.status === "anonymous" && <AuthPanel />}

      {authedWithRole && (
        <StateCard
          tone="loading"
          title="시험 관리로 이동 중입니다"
          description="잠시만 기다려 주세요."
        />
      )}

      {auth.status === "authenticated" && !auth.user.role && (
        <section className="mx-auto max-w-md space-y-4 text-center">
          <StateCard
            tone="empty"
            title="승인 대기 중입니다"
            description="기존 관리자가 계정을 승인하면 시험 관리에 접근할 수 있습니다."
          />
          <Button variant="secondary" size="sm" onClick={() => void logout()}>
            로그아웃
          </Button>
        </section>
      )}
    </main>
  );
}

function AuthPanel() {
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
        ? { email: form.get("email"), password: form.get("password") }
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
        // useAdminAuth가 /api/auth/me로 다시 확인하도록 새로고침.
        window.location.assign("/exams");
        return;
      }
      setNotice(
        (body as AdminUser).status === "active"
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
