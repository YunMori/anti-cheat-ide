"""WebSocket 진입점 및 앱 팩토리.

실행: `cd backend && uvicorn app.main:app --reload --port 8000`
"""
from __future__ import annotations

import json
import logging

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from .config import BackendConfig
from .detector_adapter import HumanScorer, LazyAiEngineDetector
from .session_manager import SessionManager

logger = logging.getLogger(__name__)


def create_app(
    scorer: HumanScorer | None = None,
    config: BackendConfig | None = None,
) -> FastAPI:
    config = config or BackendConfig.from_env()
    scorer = scorer or LazyAiEngineDetector(config.model_dir)
    manager = SessionManager(scorer, config)

    app = FastAPI(title="Anti-Cheat IDE Backend (prototype)")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(config.cors_allowed_origins),
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.websocket("/ws")
    async def websocket_endpoint(websocket: WebSocket) -> None:
        session_id = f"user_{id(websocket)}"
        await manager.connect(websocket, session_id)
        try:
            while True:
                data = json.loads(await websocket.receive_text())
                result = await manager.process_data(session_id, data)
                if result is not None:
                    await websocket.send_json(result)
        except WebSocketDisconnect:
            manager.disconnect(session_id)
        except Exception:
            logger.exception("WebSocket session %s failed", session_id)
            manager.disconnect(session_id)

    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
