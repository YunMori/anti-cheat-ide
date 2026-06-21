export type RiskSignal = {
  code: string;
  score: number;
  evidence: Record<string, unknown>;
};

export type RiskAssessment = {
  id: string;
  session_id: string;
  risk_score: number;
  review_recommended: boolean;
  signals: RiskSignal[];
  model_version: string;
};

export class RiskLookupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RiskLookupError";
  }
}

export async function fetchRiskAssessment(
  sessionId: string,
  signal?: AbortSignal,
): Promise<RiskAssessment> {
  const response = await fetch(`/api/risk/${encodeURIComponent(sessionId)}`, { signal });

  if (response.status === 404) {
    throw new RiskLookupError("해당 세션을 찾을 수 없습니다. 세션 ID를 확인하세요.");
  }

  if (!response.ok) {
    throw new RiskLookupError(`위험 평가를 불러오지 못했습니다. (HTTP ${response.status})`);
  }

  return (await response.json()) as RiskAssessment;
}

export function formatEvidenceValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === null) return "null";
  if (typeof value === "object") return JSON.stringify(value, null, 2);
  return String(value);
}

export function getRiskBand(score: number): "low" | "medium" | "high" {
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}

export function getRiskBandLabel(score: number): string {
  const band = getRiskBand(score);
  if (band === "high") return "높은 위험";
  if (band === "medium") return "주의 필요";
  return "낮은 위험";
}

/** Human-readable label and description for each detection signal code. */
export const SIGNAL_META: Record<string, { label: string; description: string }> = {
  paste_spike: {
    label: "붙여넣기 급증",
    description: "대량 붙여넣기 이벤트가 외부 코드 반입 가능성을 시사합니다.",
  },
  code_burst: {
    label: "코드 폭증",
    description: "짧은 시간에 많은 코드가 한꺼번에 삽입되었습니다.",
  },
  typing_regularity: {
    label: "타이핑 규칙성",
    description: "키 입력 간격이 비정상적으로 일정해 자동 입력이 의심됩니다.",
  },
  focus_loss: {
    label: "포커스 이탈",
    description: "응시 창을 벗어난 횟수·시간이 많습니다.",
  },
};

export function getSignalMeta(code: string): { label: string; description: string } {
  return (
    SIGNAL_META[code] ?? {
      label: code,
      description: "탐지 규칙이 기록한 검토 근거입니다.",
    }
  );
}

/** Split a signal's evidence into headline metrics and the thresholds block. */
export function partitionEvidence(evidence: Record<string, unknown>): {
  metrics: Array<[string, unknown]>;
  thresholds: Record<string, unknown> | null;
} {
  const metrics: Array<[string, unknown]> = [];
  let thresholds: Record<string, unknown> | null = null;
  for (const [key, value] of Object.entries(evidence)) {
    if (key === "thresholds" && value && typeof value === "object") {
      thresholds = value as Record<string, unknown>;
    } else {
      metrics.push([key, value]);
    }
  }
  return { metrics, thresholds };
}

/** Turn a snake_case evidence key into a readable label. */
export function humanizeKey(key: string): string {
  return key.replace(/_/g, " ").replace(/\bms\b/g, "(ms)");
}

/** Compact display value for a single evidence metric. */
export function formatMetricValue(value: unknown): string {
  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
  }
  if (typeof value === "boolean") return value ? "예" : "아니오";
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
