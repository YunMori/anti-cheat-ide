"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Badge, Card, riskTone } from "@ide/ui";
import { get } from "../../../../lib/api";
import type { ParticipantStatus, Problem } from "../../../../lib/types";
import { Eyebrow, PolicyBanner, participantStatusLabel } from "../../../../components/ui-bits";
import { KpiCard } from "../../../../components/metrics";

export default function DashboardPage({
  params,
}: {
  params: Promise<{ examId: string }>;
}) {
  const { examId } = use(params);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [participants, setParticipants] = useState<ParticipantStatus[]>([]);

  useEffect(() => {
    void get<Problem[]>(`/problems?assessment_id=${encodeURIComponent(examId)}`, []).then(
      setProblems,
    );
    void get<ParticipantStatus[]>(
      `/assessments/${encodeURIComponent(examId)}/participants`,
      [],
    ).then(setParticipants);
  }, [examId]);

  const activeCount = participants.filter(
    (p) =>
      p.redeemed &&
      p.session_status !== "finished" &&
      p.session_status !== "submitted",
  ).length;
  const highRiskCount = participants.filter(
    (p) => p.risk_score != null && riskTone(p.risk_score) === "high",
  ).length;

  const reviewQueue = useMemo(
    () =>
      [...participants]
        .filter((p) => p.risk_score != null)
        .sort((a, b) => (b.risk_score ?? -1) - (a.risk_score ?? -1))
        .slice(0, 6),
    [participants],
  );

  const activity = useMemo(
    () =>
      [...participants]
        .sort(
          (a, b) =>
            new Date(b.invited_at).getTime() - new Date(a.invited_at).getTime(),
        )
        .slice(0, 6),
    [participants],
  );

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <Eyebrow>Overview</Eyebrow>
        <h1 className="text-2xl font-bold text-text">대시보드</h1>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="출제 문제" value={problems.length} />
        <KpiCard label="초대 참가자" value={participants.length} />
        <KpiCard label="응시 중" value={activeCount} tone="accent" />
        <KpiCard label="고위험 신호" value={highRiskCount} tone="high" />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-sm font-bold text-text">검토가 필요한 응시자</h2>
          <p className="mt-1 text-xs text-muted">위험 점수 높은 순</p>
          <ul className="mt-4 space-y-2">
            {reviewQueue.length === 0 && (
              <li className="text-sm text-muted">아직 위험 신호가 없습니다.</li>
            )}
            {reviewQueue.map((p) => (
              <li key={p.candidate_id}>
                {p.session_id ? (
                  <Link
                    href={`/exams/${examId}/evidence/${p.session_id}`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 no-underline transition-colors hover:bg-surface-2"
                  >
                    <span className="truncate font-mono text-sm text-text">
                      {p.candidate_id}
                    </span>
                    <span className="flex items-center gap-3">
                      <Badge tone={riskTone(p.risk_score ?? 0)}>
                        {Math.round(p.risk_score ?? 0)}
                      </Badge>
                      <span className="text-xs text-accent">근거 →</span>
                    </span>
                  </Link>
                ) : (
                  <span className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 opacity-70">
                    <span className="truncate font-mono text-sm text-text">
                      {p.candidate_id}
                    </span>
                    <span className="text-xs text-muted">미응시</span>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-bold text-text">최근 활동</h2>
          <p className="mt-1 text-xs text-muted">초대·응시 현황</p>
          <ul className="mt-4 space-y-3">
            {activity.length === 0 && (
              <li className="text-sm text-muted">표시할 활동이 없습니다.</li>
            )}
            {activity.map((p) => {
              const tone =
                p.risk_score != null ? riskTone(p.risk_score) : "low";
              const dot =
                tone === "high"
                  ? "var(--risk-high)"
                  : tone === "medium"
                    ? "var(--risk-medium)"
                    : "var(--risk-low)";
              return (
                <li key={p.candidate_id} className="flex items-center gap-3 text-sm">
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ background: dot }}
                    aria-hidden="true"
                  />
                  <span className="truncate font-mono text-text">{p.candidate_id}</span>
                  <span className="ml-auto text-xs text-muted">
                    {participantStatusLabel(p)}
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      <PolicyBanner />
    </section>
  );
}
