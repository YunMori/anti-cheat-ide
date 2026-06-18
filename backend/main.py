from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import json
import asyncio
import sys
import os
from pathlib import Path
from typing import Dict, List
from schemas import KeystrokeEvent, SessionData, PasteEvent

# ai_engine 경로 추가
sys.path.append(str(Path(__file__).parent.parent / "ai_engine"))
from detector import AntiCheatDetector

app = FastAPI(title="Anti-Cheat IDE Backend")

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# AI 감지기 초기화 (가중치 파일은 ai_engine/models에 있다고 가정)
detector = AntiCheatDetector(model_dir=str(Path(__file__).parent.parent / "ai_engine" / "models"))

class SessionManager:
    def __init__(self):
        self.active_sessions: Dict[str, Dict] = {}

    async def connect(self, websocket: WebSocket, session_id: str):
        await websocket.accept()
        self.active_sessions[session_id] = {
            "ws": websocket,
            "events": [],
            "paste_count": 0,
            "human_score": 100.0
        }

    def disconnect(self, session_id: str):
        if session_id in self.active_sessions:
            del self.active_sessions[session_id]

    async def process_data(self, session_id: str, data: dict):
        session = self.active_sessions.get(session_id)
        if not session: return

        # 붙여넣기 이벤트 처리
        if data.get("type") == "PASTE_EVENT":
            session["paste_count"] += 1
            session["human_score"] = max(0, session["human_score"] - 15.0) # 패널티
            return {
                "status": "warning", 
                "message": "Paste detected", 
                "human_score": session["human_score"],
                "total_pastes": session["paste_count"]
            }

        # 키스트로크 데이터 처리
        events = data.get("events", [])
        if not events: return {"status": "ok", "human_score": session["human_score"]}
        
        # 전체 세션 이벤트 누적
        session["events"].extend(events)
        
        # AI 판별기 호출 (최근 이벤트를 바탕으로 인간 유사성 측정)
        # 딕셔너리 리스트를 detector에 전달
        new_score = detector.predict_human_score(session["events"])
        session["human_score"] = new_score

        return {
            "status": "ok",
            "event_count": len(events),
            "human_score": session["human_score"]
        }

manager = SessionManager()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    session_id = f"user_{id(websocket)}"
    await manager.connect(websocket, session_id)
    try:
        while True:
            raw_data = await websocket.receive_text()
            data = json.loads(raw_data)
            result = await manager.process_data(session_id, data)
            await websocket.send_json(result)
    except WebSocketDisconnect:
        manager.disconnect(session_id)
    except Exception as e:
        print(f"Error: {e}")
        manager.disconnect(session_id)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
