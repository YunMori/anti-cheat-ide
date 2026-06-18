from dataclasses import asdict
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from .domain import EventBatch as DomainEventBatch
from .domain import RiskAssessment as DomainRiskAssessment
from .domain import SessionEvent as DomainSessionEvent


EventType = Literal["keydown", "keyup", "paste", "code_change", "focus_change"]


class SessionEvent(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=1)
    type: EventType
    timestamp: int = Field(ge=0)
    editor_revision: int = Field(ge=0)
    key: str | None = None
    code: str | None = None
    cursor_offset: int | None = Field(default=None, ge=0)
    inserted_character_count: int | None = Field(default=None, ge=0)
    deleted_character_count: int | None = Field(default=None, ge=0)
    focused: bool | None = None

    @model_validator(mode="after")
    def validate_type_specific_fields(self) -> "SessionEvent":
        if self.type in {"keydown", "keyup"} and (self.key is None or self.code is None):
            raise ValueError("key events require key and code")
        if self.type == "paste" and self.inserted_character_count is None:
            raise ValueError("paste events require inserted_character_count")
        if self.type == "code_change" and (
            self.inserted_character_count is None
            or self.deleted_character_count is None
        ):
            raise ValueError(
                "code_change events require inserted_character_count and "
                "deleted_character_count"
            )
        if self.type == "focus_change" and self.focused is None:
            raise ValueError("focus_change events require focused")
        return self

    def to_domain(self) -> DomainSessionEvent:
        return DomainSessionEvent(**self.model_dump())


class EventBatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schema_version: Literal["1.0"]
    session_id: str = Field(min_length=1)
    sequence_start: int = Field(ge=0)
    sent_at: int = Field(ge=0)
    events: list[SessionEvent]

    def to_domain(self) -> DomainEventBatch:
        return DomainEventBatch(
            schema_version=self.schema_version,
            session_id=self.session_id,
            sequence_start=self.sequence_start,
            sent_at=self.sent_at,
            events=[event.to_domain() for event in self.events],
        )


class RiskSignal(BaseModel):
    code: str
    score: float = Field(ge=0, le=100)
    evidence: dict[str, Any]


class RiskAssessment(BaseModel):
    session_id: str
    risk_score: float = Field(ge=0, le=100)
    review_recommended: bool
    signals: list[RiskSignal]

    @classmethod
    def from_domain(cls, assessment: DomainRiskAssessment) -> "RiskAssessment":
        return cls.model_validate(asdict(assessment))


class HealthResponse(BaseModel):
    status: Literal["ok"]
    service: Literal["detection-service"]
    version: str
