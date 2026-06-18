import pytest


pytest.importorskip("fastapi")
pytest.importorskip("pydantic")

from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_health() -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "detection-service",
        "version": "0.1.0",
    }


def test_assess_contract() -> None:
    response = client.post(
        "/assess",
        json={
            "schema_version": "1.0",
            "session_id": "ses_123",
            "sequence_start": 42,
            "sent_at": 1781510400000,
            "events": [],
        },
    )

    assert response.status_code == 200
    assert response.json() == {
        "session_id": "ses_123",
        "risk_score": 0.0,
        "review_recommended": False,
        "signals": [
            {
                "code": "paste_spike",
                "score": 0.0,
                "evidence": {
                    "weight": 0.3,
                    "paste_event_count": 0,
                    "suspicious_paste_count": 0,
                    "total_suspicious_inserted_characters": 0,
                    "maximum_inserted_characters": 0,
                    "thresholds": {
                        "suspicious_paste_characters": 40,
                        "total_characters": 80,
                        "event_count": 2,
                    },
                    "duplicate_event_count": 0,
                },
            },
            {
                "code": "code_burst",
                "score": 0.0,
                "evidence": {
                    "weight": 0.3,
                    "code_change_count": 0,
                    "maximum_single_insertion": 0,
                    "maximum_inserted_in_2000ms": 0,
                    "maximum_window_started_at": None,
                    "thresholds": {
                        "single_insertion_characters": 80,
                        "window_ms": 2000,
                        "window_insertion_characters": 160,
                    },
                    "duplicate_event_count": 0,
                },
            },
            {
                "code": "typing_regularity",
                "score": 0.0,
                "evidence": {
                    "weight": 0.25,
                    "keydown_count": 0,
                    "keyup_count": 0,
                    "unmatched_keydown_count": 0,
                    "unmatched_keyup_count": 0,
                    "repeated_keydown_count": 0,
                    "paired_hold_count": 0,
                    "mean_hold_ms": 0.0,
                    "usable_inter_key_gap_count": 0,
                    "mean_inter_key_gap_ms": 0.0,
                    "inter_key_gap_stddev_ms": 0.0,
                    "inter_key_gap_coefficient_of_variation": 0.0,
                    "most_common_10ms_bucket_ratio": 0.0,
                    "thresholds": {
                        "minimum_gap_samples": 20,
                        "usable_gap_ms": [20, 2000],
                        "suspicious_coefficient_of_variation_below": 0.22,
                        "suspicious_common_bucket_ratio": 0.35,
                    },
                    "duplicate_event_count": 0,
                },
            },
            {
                "code": "focus_loss",
                "score": 0.0,
                "evidence": {
                    "weight": 0.15,
                    "focus_loss_count": 0,
                    "total_focus_loss_ms": 0,
                    "maximum_focus_loss_ms": 0,
                    "open_focus_loss": False,
                    "thresholds": {
                        "loss_count": 3,
                        "total_focus_loss_ms": 30000,
                    },
                    "duplicate_event_count": 0,
                },
            },
        ],
    }


def test_assess_rejects_invalid_event_contract() -> None:
    response = client.post(
        "/assess",
        json={
            "schema_version": "1.0",
            "session_id": "ses_123",
            "sequence_start": 0,
            "sent_at": 1000,
            "events": [
                {
                    "id": "evt_1",
                    "type": "keydown",
                    "timestamp": 1000,
                    "editor_revision": 1,
                }
            ],
        },
    )

    assert response.status_code == 422
