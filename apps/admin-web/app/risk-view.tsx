"use client";

import {
  formatEvidenceValue,
  getRiskBand,
  getRiskBandLabel,
  RiskAssessment,
} from "../lib/risk";

/** 세션 위험 평가(점수 + 신호별 근거) 표시. 모니터 행 펼침과 공용. */
export function AssessmentView({ assessment }: { assessment: RiskAssessment }) {
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
