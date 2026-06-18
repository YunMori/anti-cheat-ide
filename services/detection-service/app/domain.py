from dataclasses import dataclass, field
from typing import Any, Literal


EventType = Literal["keydown", "keyup", "paste", "code_change", "focus_change"]


@dataclass(frozen=True)
class SessionEvent:
    id: str
    type: EventType
    timestamp: int
    editor_revision: int
    key: str | None = None
    code: str | None = None
    cursor_offset: int | None = None
    inserted_character_count: int | None = None
    deleted_character_count: int | None = None
    focused: bool | None = None


@dataclass(frozen=True)
class EventBatch:
    schema_version: str
    session_id: str
    sequence_start: int
    sent_at: int
    events: list[SessionEvent]


@dataclass
class RiskSignal:
    code: str
    score: float
    evidence: dict[str, Any] = field(default_factory=dict)


@dataclass
class RiskAssessment:
    session_id: str
    risk_score: float
    review_recommended: bool
    signals: list[RiskSignal]
