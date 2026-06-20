from __future__ import annotations

from datetime import datetime, timezone
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class HealthResponse(StrictModel):
    status: Literal["ok"] = "ok"
    service: Literal["platform-api"] = "platform-api"


# --- 관리자/인증 (admin & auth) ---

AdminRole = Literal["admin", "reviewer"]
UserStatus = Literal["pending", "active"]


class AdminSignup(StrictModel):
    email: str = Field(min_length=3)
    password: str = Field(min_length=8)
    display_name: str = Field(min_length=1)


class AdminLogin(StrictModel):
    email: str = Field(min_length=3)
    password: str = Field(min_length=1)


class AdminToken(StrictModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    user: "AdminUser"


class AdminUser(StrictModel):
    id: str
    email: str
    display_name: str
    role: AdminRole | None = None
    status: UserStatus
    created_at: datetime
    approved_at: datetime | None = None


class AdminUserRecord(AdminUser):
    password_hash: str


class AdminApproval(StrictModel):
    role: AdminRole


# --- 시험/문제 (assessments & problems) ---


class AssessmentCreate(StrictModel):
    organization_id: str = Field(min_length=1)
    title: str = Field(min_length=1)
    starts_at: datetime
    ends_at: datetime

    @model_validator(mode="after")
    def validate_schedule(self) -> AssessmentCreate:
        if self.ends_at <= self.starts_at:
            raise ValueError("ends_at must be after starts_at")
        return self


class Assessment(AssessmentCreate):
    id: str


SupportedLanguage = Literal["python", "javascript", "cpp", "java"]
ProblemProgressStatus = Literal["locked", "unlocked", "solved"]


class TestCaseCreate(StrictModel):
    stdin: str
    expected_stdout: str
    hidden: bool = True


class TestCase(TestCaseCreate):
    id: str


class ProblemCreate(StrictModel):
    assessment_id: str = Field(min_length=1)
    title: str = Field(min_length=1)
    statement: str = Field(min_length=1)
    allowed_languages: list[SupportedLanguage] = Field(min_length=1)
    starter_code: dict[SupportedLanguage, str] = Field(default_factory=dict)
    time_limit_ms: int = Field(default=2000, gt=0, le=30_000)
    memory_limit_mb: int = Field(default=128, ge=16, le=1024)
    # 다음 문제 해금에 필요한 통과율(0~1). 1.0 = 전체 테스트 통과.
    pass_threshold: float = Field(default=1.0, ge=0, le=1)
    test_cases: list[TestCaseCreate] = Field(min_length=1)

    @model_validator(mode="after")
    def validate_languages(self) -> ProblemCreate:
        if len(set(self.allowed_languages)) != len(self.allowed_languages):
            raise ValueError("allowed_languages must not contain duplicates")
        unsupported_starters = set(self.starter_code) - set(
            self.allowed_languages
        )
        if unsupported_starters:
            raise ValueError(
                "starter_code languages must be included in allowed_languages"
            )
        return self


class Problem(StrictModel):
    id: str
    assessment_id: str
    title: str
    statement: str
    allowed_languages: list[SupportedLanguage]
    starter_code: dict[SupportedLanguage, str]
    time_limit_ms: int
    memory_limit_mb: int
    pass_threshold: float = 1.0
    order_index: int = 0
    test_cases: list[TestCase]


class CandidateProblem(StrictModel):
    """해금된 문제의 전체 내용(응시자용 상세)."""

    id: str
    assessment_id: str
    title: str
    statement: str
    allowed_languages: list[SupportedLanguage]
    starter_code: dict[SupportedLanguage, str]
    time_limit_ms: int
    memory_limit_mb: int
    pass_threshold: float
    order_index: int
    status: ProblemProgressStatus
    public_test_cases: list[TestCase]


class CandidateProblemSummary(StrictModel):
    """문제 목록 항목. 잠긴 문제는 title을 포함해 내용을 노출하지 않는다."""

    id: str
    order_index: int
    status: ProblemProgressStatus
    pass_threshold: float
    title: str | None = None


# --- 세션/초대 (sessions & invites) ---


class SessionCreate(StrictModel):
    assessment_id: str = Field(min_length=1)
    candidate_id: str = Field(min_length=1)


class Session(StrictModel):
    id: str
    assessment_id: str
    candidate_id: str
    status: Literal["active", "submitted", "finished"] = "active"
    started_at: datetime
    finished_at: datetime | None = None


class CandidateInviteCreate(StrictModel):
    candidate_id: str = Field(min_length=1)
    expires_at: datetime


class CandidateInvite(StrictModel):
    id: str
    assessment_id: str
    candidate_id: str
    token: str
    invite_url: str
    expires_at: datetime
    created_at: datetime
    created_by_user_id: str
    used_at: datetime | None = None
    session_id: str | None = None


class CandidateInvitePreview(StrictModel):
    assessment_id: str
    assessment_title: str
    candidate_id: str
    expires_at: datetime
    used: bool


class CandidateInviteRedeemed(StrictModel):
    session: Session


class ParticipantStatus(StrictModel):
    """admin 모니터링용 참가자 1명의 응시 현황 집계."""

    candidate_id: str
    invited_at: datetime
    expires_at: datetime
    redeemed: bool
    session_id: str | None = None
    session_status: str | None = None
    risk_score: float | None = None
    review_recommended: bool | None = None
    solved_count: int = 0
    total_problems: int = 0


# --- 행동 이벤트 (behavioral events) ---


class EventBase(StrictModel):
    id: str = Field(min_length=1)
    timestamp: int = Field(ge=0)
    editor_revision: int = Field(ge=0)


class KeyEvent(EventBase):
    type: Literal["keydown", "keyup"]
    key: str
    code: str
    cursor_offset: int = Field(ge=0)


class PasteEvent(EventBase):
    type: Literal["paste"]
    inserted_character_count: int = Field(ge=0)
    cursor_offset: int = Field(ge=0)


class CodeChangeEvent(EventBase):
    type: Literal["code_change"]
    inserted_character_count: int = Field(ge=0)
    deleted_character_count: int = Field(ge=0)
    cursor_offset: int = Field(ge=0)


class FocusChangeEvent(EventBase):
    type: Literal["focus_change"]
    focused: bool


SessionEvent = Annotated[
    KeyEvent | PasteEvent | CodeChangeEvent | FocusChangeEvent,
    Field(discriminator="type"),
]


class EventBatchCreate(StrictModel):
    schema_version: Literal["1.0"]
    session_id: str = Field(min_length=1)
    sequence_start: int = Field(ge=0)
    sent_at: int = Field(ge=0)
    events: list[SessionEvent] = Field(min_length=1)


class EventBatch(EventBatchCreate):
    id: str
    received_at: datetime


class EventBatchAccepted(StrictModel):
    batch_id: str
    accepted_events: int
    next_sequence: int


# --- 제출/채점 (submissions & judging) ---


class SubmissionCreate(StrictModel):
    problem_id: str = Field(min_length=1)
    language: str = Field(min_length=1)
    source_code: str


class Submission(SubmissionCreate):
    id: str
    session_id: str
    created_at: datetime
    status: Literal["queued", "judged", "judge_failed"] = "queued"


class JudgeTestCaseResult(StrictModel):
    id: str
    status: str
    stdout: str
    expected_stdout: str
    stderr: str
    duration_ms: int
    exit_code: int | None


class JudgeResult(StrictModel):
    id: str
    submission_id: str
    status: str
    passed_count: int
    total_count: int
    duration_ms: int
    test_cases: list[JudgeTestCaseResult]
    created_at: datetime


class SubmissionAccepted(Submission):
    judge_result: JudgeResult | None = None


# --- 위험 평가 (risk) ---


class RiskSignal(StrictModel):
    code: str = Field(min_length=1)
    score: float = Field(ge=0, le=100)
    evidence: dict[str, Any] = Field(min_length=1)


class RiskAssessment(StrictModel):
    id: str
    session_id: str
    risk_score: float = Field(ge=0, le=100)
    review_recommended: bool
    signals: list[RiskSignal]
    model_version: str = Field(min_length=1)
