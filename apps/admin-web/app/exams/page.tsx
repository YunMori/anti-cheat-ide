"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, StateCard, ThemeToggle, cn } from "@ide/ui";
import { useAdminAuth } from "../../lib/auth";
import { get, post } from "../../lib/api";
import type { AdminUser, Assessment } from "../../lib/types";
import { STATUS_META } from "../../lib/types";
import { AccentToggle } from "../../components/accent-toggle";
import { AssessmentForm } from "../../components/assessment-form";
import { Eyebrow, ErrorText, formatDateTime } from "../../components/ui-bits";

export default function ExamsPage() {
  const { auth, logout } = useAdminAuth();
  const router = useRouter();
  const [exams, setExams] = useState<Assessment[]>([]);
  const [creating, setCreating] = useState(false);

  const isAdmin = auth.status === "authenticated" && auth.user.role === "admin";

  const loadExams = useCallback(() => {
    void get<Assessment[]>("/assessments", []).then(setExams);
  }, []);

  useEffect(() => {
    if (auth.status === "anonymous") router.replace("/");
    if (auth.status === "authenticated" && !auth.user.role) router.replace("/");
    if (auth.status === "authenticated" && auth.user.role) loadExams();
  }, [auth, router, loadExams]);

  if (auth.status !== "authenticated" || !auth.user.role) {
    return (
      <main className="mx-auto w-[min(1180px,calc(100%-2rem))] py-10">
        <StateCard tone="loading" title="불러오는 중" description="잠시만 기다려 주세요." />
      </main>
    );
  }

  return (
    <main className="mx-auto w-[min(1180px,calc(100%-2rem))] pb-20">
      <header className="flex items-center justify-between gap-4 py-6">
        <div className="flex items-center gap-3">
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
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-muted sm:inline">
            {auth.user.display_name} · {auth.user.role}
          </span>
          <AccentToggle />
          <ThemeToggle />
          <Button variant="secondary" size="sm" onClick={() => void logout()}>
            로그아웃
          </Button>
        </div>
      </header>

      <div className="mb-6 flex items-end justify-between gap-4">
        <div className="space-y-2">
          <Eyebrow>Exam management</Eyebrow>
          <h1 className="text-2xl font-bold text-text">시험 관리</h1>
          <p className="max-w-2xl text-sm text-muted">
            새 시험을 생성하거나 기존 시험에 입장해 대시보드·출제·모니터링을 이어서
            진행합니다.
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setCreating((value) => !value)}>
            {creating ? "닫기" : "＋ 새 시험 만들기"}
          </Button>
        )}
      </div>

      {creating && isAdmin && (
        <div className="mb-6">
          <AssessmentForm
            onCreated={(assessment) => {
              setCreating(false);
              router.push(`/exams/${assessment.id}/settings`);
            }}
          />
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isAdmin && !creating && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex min-h-[208px] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border bg-surface/40 p-6 text-center transition-colors hover:bg-surface"
          >
            <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-xl text-primary">
              ＋
            </span>
            <strong className="text-sm font-bold text-text">새 시험 만들기</strong>
            <span className="text-xs text-muted">
              제목·시간·출제 묶음을 처음부터 구성합니다
            </span>
          </button>
        )}

        {exams.map((exam) => (
          <ExamCard key={exam.id} exam={exam} />
        ))}

        {exams.length === 0 && (
          <Card className="flex min-h-[208px] items-center justify-center p-6 text-center text-sm text-muted">
            아직 생성된 시험이 없습니다.
          </Card>
        )}
      </div>

      {isAdmin && <PendingUsers onChanged={loadExams} />}
    </main>
  );
}

function ExamCard({ exam }: { exam: Assessment }) {
  const meta = STATUS_META[exam.status];
  return (
    <Card
      className={cn(
        "flex min-h-[208px] flex-col p-5",
        exam.status === "archived" && "opacity-80",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <Badge tone={meta.tone}>● {meta.label}</Badge>
        <span className="text-[11px] font-medium text-accent">{meta.note}</span>
      </div>
      <h2 className="mt-4 text-base font-bold text-text">{exam.title}</h2>
      <p className="mt-1 font-mono text-xs text-muted">
        {formatDateTime(exam.starts_at)} – {formatDateTime(exam.ends_at)}
      </p>
      <div className="mt-auto pt-5">
        <Link href={`/exams/${exam.id}/dashboard`}>
          <Button className="w-full" variant={exam.status === "archived" ? "secondary" : "primary"}>
            {exam.status === "archived" ? "결과 보기 →" : "입장 →"}
          </Button>
        </Link>
      </div>
    </Card>
  );
}

function PendingUsers({ onChanged }: { onChanged: () => void }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [busyUserId, setBusyUserId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void get<AdminUser[]>("/admin/users/pending", []).then(setUsers);
  }, []);

  async function approve(user: AdminUser, role: "admin" | "reviewer") {
    setBusyUserId(user.id);
    setError("");
    try {
      await post(`/admin/users/${encodeURIComponent(user.id)}/approve`, { role });
      setUsers((current) => current.filter((item) => item.id !== user.id));
      onChanged();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "계정 승인에 실패했습니다.");
    } finally {
      setBusyUserId("");
    }
  }

  if (users.length === 0) return null;

  return (
    <section className="mt-10 space-y-3">
      <h2 className="text-sm font-bold text-text">관리자 가입 승인</h2>
      {users.map((user) => (
        <Card
          key={user.id}
          className="flex flex-wrap items-center gap-3 px-4 py-3"
        >
          <div className="mr-auto">
            <strong className="block text-sm text-text">{user.display_name}</strong>
            <span className="text-xs text-muted">{user.email}</span>
          </div>
          <Button
            variant="secondary"
            size="sm"
            disabled={busyUserId === user.id}
            onClick={() => void approve(user, "reviewer")}
          >
            reviewer 승인
          </Button>
          <Button
            size="sm"
            disabled={busyUserId === user.id}
            onClick={() => void approve(user, "admin")}
          >
            admin 승인
          </Button>
        </Card>
      ))}
      {error && <ErrorText message={error} />}
    </section>
  );
}
