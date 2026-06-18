from __future__ import annotations

import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import httpx
from fastapi.testclient import TestClient


ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "apps" / "platform-api"))
sys.path.insert(0, str(ROOT / "services" / "detection-service"))

from app.main import assess_risk as detect_risk
from app.models import EventBatch as DetectionEventBatch
from platform_api.main import create_app
from platform_api.models import (
    EventBatchCreate,
    RiskAssessment,
    RiskSignal,
)
from platform_api.repositories import InMemoryPlatformRepository


class InProcessRiskAssessor:
    """Runs the real Detection Service contract without an external server."""

    def assess(self, batch: EventBatchCreate) -> RiskAssessment:
        detected = detect_risk(
            DetectionEventBatch.model_validate(batch.model_dump(mode="json"))
        )
        return RiskAssessment(
            id=f"risk_{batch.session_id}",
            session_id=detected.session_id,
            risk_score=detected.risk_score,
            review_recommended=detected.review_recommended,
            signals=[
                RiskSignal.model_validate(signal.model_dump())
                for signal in detected.signals
            ],
            model_version="rules-in-process",
        )


class UnavailableRiskAssessor:
    def assess(self, batch: EventBatchCreate) -> RiskAssessment:
        del batch
        raise httpx.ConnectError("detection service unavailable")


def create_session(client: TestClient) -> str:
    starts_at = datetime.now(timezone.utc)
    assessment = client.post(
        "/assessments",
        json={
            "organization_id": "org_qa",
            "title": "QA assessment",
            "starts_at": starts_at.isoformat(),
            "ends_at": (starts_at + timedelta(hours=1)).isoformat(),
        },
    )
    assert assessment.status_code == 201

    session = client.post(
        "/sessions",
        json={
            "assessment_id": assessment.json()["id"],
            "candidate_id": "candidate_qa",
        },
    )
    assert session.status_code == 201
    return session.json()["id"]


def suspicious_batch(session_id: str) -> dict:
    return {
        "schema_version": "1.0",
        "session_id": session_id,
        "sequence_start": 0,
        "sent_at": 1_000,
        "events": [
            {
                "id": "evt_paste",
                "type": "paste",
                "timestamp": 900,
                "editor_revision": 1,
                "inserted_character_count": 400,
                "cursor_offset": 0,
            },
            {
                "id": "evt_change",
                "type": "code_change",
                "timestamp": 901,
                "editor_revision": 2,
                "inserted_character_count": 400,
                "deleted_character_count": 0,
                "cursor_offset": 400,
            },
        ],
    }


def benign_batch(session_id: str) -> dict:
    return {
        "schema_version": "1.0",
        "session_id": session_id,
        "sequence_start": 2,
        "sent_at": 2_000,
        "events": [
            {
                "id": "evt_keydown",
                "type": "keydown",
                "timestamp": 1_900,
                "editor_revision": 3,
                "key": "a",
                "code": "KeyA",
                "cursor_offset": 401,
            }
        ],
    }


def test_event_ingest_runs_real_detection_and_stores_reviewable_risk() -> None:
    repository = InMemoryPlatformRepository()
    client = TestClient(create_app(repository, InProcessRiskAssessor()))
    session_id = create_session(client)

    ingest = client.post(
        f"/sessions/{session_id}/events",
        json=suspicious_batch(session_id),
    )
    risk = client.get(f"/sessions/{session_id}/risk")

    assert ingest.status_code == 202
    assert risk.status_code == 200
    assert risk.json()["risk_score"] == 60
    assert risk.json()["review_recommended"] is True
    assert {signal["code"] for signal in risk.json()["signals"]} == {
        "paste_spike",
        "code_burst",
        "typing_regularity",
        "focus_loss",
    }
    assert all(signal["evidence"] for signal in risk.json()["signals"])


def test_session_risk_does_not_lose_prior_high_risk_evidence() -> None:
    repository = InMemoryPlatformRepository()
    client = TestClient(create_app(repository, InProcessRiskAssessor()))
    session_id = create_session(client)

    first = client.post(
        f"/sessions/{session_id}/events",
        json=suspicious_batch(session_id),
    )
    first_risk = client.get(f"/sessions/{session_id}/risk").json()
    second = client.post(
        f"/sessions/{session_id}/events",
        json=benign_batch(session_id),
    )
    final_risk = client.get(f"/sessions/{session_id}/risk").json()

    assert first.status_code == 202
    assert second.status_code == 202
    assert final_risk["risk_score"] >= first_risk["risk_score"]
    assert any(
        signal["code"] == "paste_spike" and signal["score"] > 0
        for signal in final_risk["signals"]
    )


def test_event_ingest_remains_available_when_detection_is_down() -> None:
    repository = InMemoryPlatformRepository()
    client = TestClient(
        create_app(repository, UnavailableRiskAssessor()),
        raise_server_exceptions=False,
    )
    session_id = create_session(client)

    ingest = client.post(
        f"/sessions/{session_id}/events",
        json=suspicious_batch(session_id),
    )

    assert ingest.status_code == 202
    assert ingest.json()["next_sequence"] == 2
