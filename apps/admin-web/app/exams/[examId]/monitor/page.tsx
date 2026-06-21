"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Card, cn, riskTone } from "@ide/ui";
import { get } from "../../../../lib/api";
import type { ParticipantStatus } from "../../../../lib/types";
import { Eyebrow, participantStatusLabel } from "../../../../components/ui-bits";
import { RiskGauge } from "../../../../components/metrics";

export default function MonitorPage({
  params,
}: {
  params: Promise<{ examId: string }>;
}) {
  const { examId } = use(params);
  const router = useRouter();
  const [participants, setParticipants] = useState<ParticipantStatus[]>([]);
  const [highRiskOnly, setHighRiskOnly] = useState(false);

  useEffect(() => {
    const url = `/assessments/${encodeURIComponent(examId)}/participants`;
    let active = true;
    const load = () =>
      get<ParticipantStatus[]>(url, []).then((items) => {
        if (active) setParticipants(items);
      });
    void load();
    const timer = setInterval(() => void load(), 10000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [examId]);

  const visible = useMemo(() => {
    const filtered = highRiskOnly
      ? participants.filter(
          (p) => p.risk_score != null && riskTone(p.risk_score) === "high",
        )
      : participants;
    return [...filtered].sort(
      (a, b) => (b.risk_score ?? -1) - (a.risk_score ?? -1),
    );
  }, [participants, highRiskOnly]);

  function openEvidence(p: ParticipantStatus) {
    if (p.session_id) {
      router.push(`/exams/${examId}/evidence/${p.session_id}`);
    }
  }

  return (
    <section className="space-y-5">
      <header className="flex items-end justify-between gap-4">
        <div className="space-y-1">
          <Eyebrow>Live monitor</Eyebrow>
          <h1 className="text-2xl font-bold text-text">참가자 모니터링</h1>
          <p className="text-sm text-muted">
            참가자 행을 클릭하면 해당 응시자의 근거 상세로 이동합니다.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-muted sm:inline">
            ● 10초마다 자동 새로고침
          </span>
          <Button
            variant={highRiskOnly ? "primary" : "secondary"}
            size="sm"
            aria-pressed={highRiskOnly}
            onClick={() => setHighRiskOnly((value) => !value)}
          >
            고위험만
          </Button>
        </div>
      </header>

      <Card className="overflow-hidden">
        <div className="grid grid-cols-[1.5fr_0.8fr_0.6fr_1.2fr_auto] gap-2 bg-surface-2 px-4 py-2 text-[11px] font-semibold uppercase text-muted">
          <span>응시자</span>
          <span>상태</span>
          <span>진행</span>
          <span>위험 점수</span>
          <span />
        </div>

        {visible.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted">
            표시할 참가자가 없습니다.
          </p>
        ) : (
          visible.map((p) => {
            const tone = p.risk_score != null ? riskTone(p.risk_score) : null;
            const clickable = Boolean(p.session_id);
            return (
              <div
                key={p.candidate_id + (p.session_id ?? "")}
                role={clickable ? "button" : undefined}
                tabIndex={clickable ? 0 : undefined}
                onClick={() => openEvidence(p)}
                onKeyDown={(event) => {
                  if (clickable && (event.key === "Enter" || event.key === " ")) {
                    event.preventDefault();
                    openEvidence(p);
                  }
                }}
                className={cn(
                  "grid grid-cols-[1.5fr_0.8fr_0.6fr_1.2fr_auto] items-center gap-2 border-t border-border px-4 py-3 text-sm transition-colors",
                  tone === "high" && "bg-risk-high-soft/60",
                  clickable
                    ? "cursor-pointer hover:bg-surface-2"
                    : "cursor-default opacity-70",
                )}
              >
                <span className="truncate font-mono text-text">{p.candidate_id}</span>
                <span
                  className={cn(
                    "text-xs",
                    p.redeemed ? "text-success" : "text-muted",
                  )}
                >
                  {participantStatusLabel(p)}
                </span>
                <span className="text-xs text-muted">
                  {p.solved_count}/{p.total_problems}
                </span>
                <span className="flex items-center gap-2">
                  {p.risk_score != null && tone ? (
                    <>
                      <Badge tone={tone}>{Math.round(p.risk_score)}</Badge>
                      <RiskGauge score={p.risk_score} />
                    </>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </span>
                <span className="text-xs text-accent">
                  {clickable ? "근거 →" : ""}
                </span>
              </div>
            );
          })
        )}
      </Card>

      <p className="text-xs text-muted">
        위험 점수 높은 순 · {visible.length}/{participants.length}명 표시 중
      </p>
    </section>
  );
}
