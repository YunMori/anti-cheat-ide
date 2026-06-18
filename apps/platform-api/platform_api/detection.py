from __future__ import annotations

from typing import Protocol

import httpx

from .models import EventBatchCreate, RiskAssessment, RiskSignal


class RiskAssessor(Protocol):
    def assess(self, batch: EventBatchCreate) -> RiskAssessment: ...


class HttpRiskAssessor:
    """Adapter for the stateless Detection Service contract."""

    def __init__(self, base_url: str, timeout_seconds: float = 3.0) -> None:
        self._base_url = base_url.rstrip("/")
        self._timeout_seconds = timeout_seconds

    def assess(self, batch: EventBatchCreate) -> RiskAssessment:
        response = httpx.post(
            f"{self._base_url}/assess",
            json=batch.model_dump(mode="json"),
            timeout=self._timeout_seconds,
        )
        response.raise_for_status()
        payload = response.json()
        return RiskAssessment(
            id=f"risk_{batch.session_id}",
            session_id=batch.session_id,
            risk_score=payload["risk_score"],
            review_recommended=payload["review_recommended"],
            signals=[
                RiskSignal.model_validate(signal)
                for signal in payload.get("signals", [])
            ],
            model_version="rules-0.1.0",
        )

