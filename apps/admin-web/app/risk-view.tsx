"use client";

import { Badge, Card, riskTone } from "@ide/ui";

import {
  formatEvidenceValue,
  formatMetricValue,
  getRiskBandLabel,
  getSignalMeta,
  humanizeKey,
  partitionEvidence,
  RiskAssessment,
  RiskSignal,
} from "../lib/risk";

/** 세션 위험 평가(점수 + 신호별 근거) 표시. 모니터 행 펼침과 공용. */
export function AssessmentView({ assessment }: { assessment: RiskAssessment }) {
  const tone = riskTone(assessment.risk_score);

  return (
    <div className="space-y-5">
      <Card
        className="overflow-hidden"
        aria-labelledby="risk-score-title"
      >
        <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-muted">
              Risk assessment
            </p>
            <h2 id="risk-score-title" className="text-lg font-bold text-text">
              위험 평가
            </h2>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-xs text-muted sm:grid-cols-3">
              <Meta term="세션" value={assessment.session_id} />
              <Meta term="모델 버전" value={assessment.model_version} />
              <Meta term="평가 ID" value={assessment.id} />
            </dl>
          </div>

          <div className="flex flex-col items-start gap-1 sm:items-end">
            <Badge tone={tone}>{getRiskBandLabel(assessment.risk_score)}</Badge>
            <strong className="text-4xl font-bold text-text">
              {Math.round(assessment.risk_score)}
              <small className="text-base font-medium text-muted">/100</small>
            </strong>
            <span className="text-xs text-muted">
              {assessment.review_recommended ? "사람의 검토 권장" : "정기 검토"}
            </span>
          </div>
        </div>
      </Card>

      <section aria-labelledby="signals-title" className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted">
              Evidence ledger
            </p>
            <h2 id="signals-title" className="text-base font-bold text-text">
              신호별 근거
            </h2>
          </div>
          <span className="text-xs text-muted">
            {assessment.signals.length}개 신호
          </span>
        </div>

        {assessment.signals.length === 0 ? (
          <Card className="p-5 text-center">
            <h3 className="text-sm font-semibold text-text">
              기록된 위험 신호가 없습니다
            </h3>
            <p className="mt-1 text-sm text-muted">
              현재 평가에는 검토할 신호별 근거가 포함되지 않았습니다.
            </p>
          </Card>
        ) : (
          <ol className="space-y-3">
            {assessment.signals.map((signal, index) => (
              <li key={`${signal.code}-${index}`}>
                <SignalCard signal={signal} index={index} />
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function SignalCard({ signal, index }: { signal: RiskSignal; index: number }) {
  const meta = getSignalMeta(signal.code);
  const { metrics, thresholds } = partitionEvidence(signal.evidence);

  return (
    <Card className="overflow-hidden">
      <header className="flex items-start gap-3 border-b border-border px-5 py-4">
        <span
          className="font-mono text-sm font-bold text-muted"
          aria-hidden="true"
        >
          {String(index + 1).padStart(2, "0")}
        </span>
        <div className="flex-1">
          <h3 className="text-sm font-bold text-text">{meta.label}</h3>
          <p className="text-xs text-muted">{meta.description}</p>
          <code className="text-[11px] text-muted/80">{signal.code}</code>
        </div>
        <Badge tone={riskTone(signal.score)}>{Math.round(signal.score)}/100</Badge>
      </header>

      <div className="space-y-4 px-5 py-4">
        {metrics.length > 0 && (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
            {metrics.map(([key, value]) => (
              <div key={key} className="min-w-0">
                <dt className="truncate text-[11px] text-muted">
                  {humanizeKey(key)}
                </dt>
                <dd className="font-mono text-sm text-text">
                  {formatMetricValue(value)}
                </dd>
              </div>
            ))}
          </dl>
        )}

        {thresholds && (
          <div className="rounded-lg border border-border bg-surface-2 px-4 py-3">
            <p className="mb-1 text-[11px] font-semibold uppercase text-muted">
              임계값
            </p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
              {Object.entries(thresholds).map(([key, value]) => (
                <div key={key} className="min-w-0">
                  <dt className="truncate text-[11px] text-muted">
                    {humanizeKey(key)}
                  </dt>
                  <dd className="font-mono text-xs text-text">
                    {formatMetricValue(value)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        <details className="text-xs">
          <summary className="cursor-pointer text-muted hover:text-text">
            원본 근거(JSON) 보기
          </summary>
          <pre className="mt-2 overflow-x-auto rounded-lg bg-surface-2 p-3 font-mono text-[11px] text-text">
            {formatEvidenceValue(signal.evidence)}
          </pre>
        </details>
      </div>
    </Card>
  );
}

function Meta({ term, value }: { term: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] uppercase text-muted">{term}</dt>
      <dd className="truncate font-mono text-xs text-text">{value}</dd>
    </div>
  );
}
