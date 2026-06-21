/** 콘솔 전반에서 공유하는 도메인 타입. */

export type AssessmentStatus = "draft" | "live" | "archived";

export interface Assessment {
  id: string;
  organization_id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  status: AssessmentStatus;
}

export interface TestCase {
  id?: string;
  stdin: string;
  expected_stdout: string;
  hidden: boolean;
}

export interface Problem {
  id: string;
  assessment_id: string;
  title: string;
  statement: string;
  allowed_languages: string[];
  starter_code: Record<string, string>;
  time_limit_ms: number;
  memory_limit_mb: number;
  pass_threshold: number;
  order_index: number;
  test_cases: TestCase[];
}

export interface ParticipantStatus {
  candidate_id: string;
  invited_at: string;
  expires_at: string;
  redeemed: boolean;
  session_id: string | null;
  session_status: string | null;
  risk_score: number | null;
  review_recommended: boolean | null;
  solved_count: number;
  total_problems: number;
}

export interface AdminUser {
  id: string;
  email: string;
  display_name: string;
  role: "admin" | "reviewer" | null;
  status: "pending" | "active";
}

export const LANGUAGE_OPTIONS: ReadonlyArray<readonly [string, string]> = [
  ["python", "Python 3.12"],
  ["javascript", "JavaScript ES2022"],
  ["cpp", "C++20"],
  ["java", "Java 21"],
];

export const STATUS_META: Record<
  AssessmentStatus,
  { label: string; tone: "low" | "medium" | "neutral"; note: string }
> = {
  draft: { label: "시작 전", tone: "medium", note: "출제 편집 가능" },
  live: { label: "진행 중", tone: "low", note: "문제 잠김" },
  archived: { label: "보관됨", tone: "neutral", note: "읽기 전용" },
};
