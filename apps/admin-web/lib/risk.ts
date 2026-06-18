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
