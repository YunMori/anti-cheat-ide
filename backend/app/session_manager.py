"""WebSocket 세션별 상태와 점수 계산 로직."""
from __future__ import annotations

from fastapi import WebSocket

from .config import BackendConfig
from .detector_adapter import HumanScorer


class SessionManager:
    def __init__(self, scorer: HumanScorer, config: BackendConfig) -> None:
        self._scorer = scorer
        self._config = config
        self.active_sessions: dict[str, dict] = {}

    async def connect(self, websocket: WebSocket, session_id: str) -> None:
        await websocket.accept()
        self.active_sessions[session_id] = {
            "ws": websocket,
            "events": [],
            "paste_count": 0,
            "human_score": self._config.initial_human_score,
        }

    def disconnect(self, session_id: str) -> None:
        self.active_sessions.pop(session_id, None)

    async def process_data(self, session_id: str, data: dict) -> dict | None:
        session = self.active_sessions.get(session_id)
        if not session:
            return None

        # 붙여넣기 이벤트: 인간 점수에 패널티 부과
        if data.get("type") == "PASTE_EVENT":
            session["paste_count"] += 1
            session["human_score"] = max(
                self._config.min_human_score,
                session["human_score"] - self._config.paste_penalty,
            )
            return {
                "status": "warning",
                "message": "Paste detected",
                "human_score": session["human_score"],
                "total_pastes": session["paste_count"],
            }

        # 키스트로크 이벤트: 누적 후 판별기로 점수 갱신
        events = data.get("events", [])
        if not events:
            return {"status": "ok", "human_score": session["human_score"]}

        session["events"].extend(events)
        session["human_score"] = self._scorer.predict_human_score(session["events"])
        return {
            "status": "ok",
            "event_count": len(events),
            "human_score": session["human_score"],
        }
