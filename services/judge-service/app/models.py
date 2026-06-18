from enum import Enum

from pydantic import BaseModel, ConfigDict, Field


class Language(str, Enum):
    PYTHON = "python"
    JAVASCRIPT = "javascript"
    CPP = "cpp"
    JAVA = "java"


class JudgeStatus(str, Enum):
    ACCEPTED = "accepted"
    WRONG_ANSWER = "wrong_answer"
    RUNTIME_ERROR = "runtime_error"
    TIME_LIMIT_EXCEEDED = "time_limit_exceeded"
    INTERNAL_ERROR = "internal_error"


class Limits(BaseModel):
    model_config = ConfigDict(extra="forbid")

    time_ms: int = Field(default=2000, gt=0, le=30_000)
    memory_mb: int = Field(default=128, ge=16, le=1024)


class TestCase(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=1)
    stdin: str
    expected_stdout: str


class JudgeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    submission_id: str = Field(min_length=1)
    language: Language
    source_code: str
    test_cases: list[TestCase]
    limits: Limits = Field(default_factory=Limits)


class TestCaseResult(BaseModel):
    id: str
    status: JudgeStatus
    stdout: str
    expected_stdout: str
    stderr: str
    duration_ms: int
    exit_code: int | None


class JudgeResponse(BaseModel):
    submission_id: str
    status: JudgeStatus
    passed_count: int
    total_count: int
    duration_ms: int
    test_cases: list[TestCaseResult]
