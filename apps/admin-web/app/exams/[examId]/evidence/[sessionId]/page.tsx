"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { StateCard } from "@ide/ui";
import { fetchRiskAssessment, RiskAssessment } from "../../../../../lib/risk";
import { AssessmentView } from "../../../../../app/risk-view";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; assessment: RiskAssessment };

export default function EvidencePage({
  params,
}: {
  params: Promise<{ examId: string; sessionId: string }>;
}) {
  const { examId, sessionId } = use(params);
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    fetchRiskAssessment(sessionId, controller.signal)
      .then((assessment) => setState({ status: "ready", assessment }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setState({
          status: "error",
          message:
            error instanceof Error
              ? error.message
              : "위험 평가를 불러오지 못했습니다.",
        });
      });
    return () => controller.abort();
  }, [sessionId]);

  return (
    <section className="space-y-5">
      <div className="flex items-center gap-3">
        <Link
          href={`/exams/${examId}/monitor`}
          className="text-sm text-accent no-underline hover:underline"
        >
          ← 모니터링
        </Link>
        <span className="font-mono text-xs text-muted">{sessionId}</span>
      </div>

      {state.status === "loading" && (
        <StateCard
          tone="loading"
          title="위험 평가를 불러오는 중"
          description="잠시만 기다려 주세요."
        />
      )}
      {state.status === "error" && (
        <StateCard tone="error" title="불러오기 실패" description={state.message} />
      )}
      {state.status === "ready" && <AssessmentView assessment={state.assessment} />}
    </section>
  );
}
