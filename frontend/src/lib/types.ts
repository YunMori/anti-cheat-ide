export type SupportedLanguage = "python" | "javascript" | "cpp" | "java";

export interface SessionInfo {
  id: string;
  assessment_id: string;
  candidate_id: string;
  status: string;
}

export interface CandidateProblem {
  id: string;
  title: string;
  statement: string;
  allowed_languages: SupportedLanguage[];
  starter_code: Partial<Record<SupportedLanguage, string>>;
  time_limit_ms: number;
  memory_limit_mb: number;
  public_test_cases: Array<{
    id: string;
    stdin: string;
    expected_stdout: string;
  }>;
}

export interface InvitePreview {
  assessment_id: string;
  assessment_title: string;
  candidate_id: string;
  expires_at: string;
  used: boolean;
}

export interface JudgeResult {
  status: string;
  passed_count: number;
  total_count: number;
  duration_ms: number;
  test_cases: Array<{
    id: string;
    status: string;
    stdout: string;
    expected_stdout: string;
    stderr: string;
    duration_ms: number;
  }>;
}

export interface SubmissionAccepted {
  id: string;
  status: "queued" | "judged" | "judge_failed";
  judge_result: JudgeResult | null;
}

export interface Alert {
  id: string;
  message: string;
}
