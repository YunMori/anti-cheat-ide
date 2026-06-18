"""WebSocket 흐름 회귀 테스트.

가짜(fake) 점수기를 주입해 ai_engine/torch 없이 WS 동작을 검증한다.
"""
from fastapi.testclient import TestClient

from app.config import BackendConfig
from app.main import create_app


class FakeScorer:
    def __init__(self, score: float = 42.0) -> None:
        self.score = score
        self.calls: list[list[dict]] = []

    def predict_human_score(self, events: list[dict]) -> float:
        self.calls.append(list(events))
        return self.score


def make_client(scorer: FakeScorer) -> TestClient:
    return TestClient(create_app(scorer=scorer, config=BackendConfig()))


def test_keystroke_events_return_scorer_result():
    scorer = FakeScorer(score=73.0)
    with make_client(scorer).websocket_connect("/ws") as ws:
        ws.send_json({"events": [{"key": "a", "timestamp": 1}]})
        response = ws.receive_json()

    assert response == {"status": "ok", "event_count": 1, "human_score": 73.0}
    assert len(scorer.calls) == 1


def test_paste_event_applies_penalty_without_scoring():
    scorer = FakeScorer()
    with make_client(scorer).websocket_connect("/ws") as ws:
        ws.send_json({"type": "PASTE_EVENT", "range": {}, "timestamp": 1})
        response = ws.receive_json()

    assert response["status"] == "warning"
    assert response["message"] == "Paste detected"
    assert response["total_pastes"] == 1
    # 기본 설정: 100 - 15 패널티
    assert response["human_score"] == 85.0
    # 붙여넣기는 판별기를 호출하지 않는다
    assert scorer.calls == []


def test_empty_events_keep_current_score():
    scorer = FakeScorer()
    with make_client(scorer).websocket_connect("/ws") as ws:
        ws.send_json({"events": []})
        response = ws.receive_json()

    assert response == {"status": "ok", "human_score": 100.0}
    assert scorer.calls == []
