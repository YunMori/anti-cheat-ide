"""WebSocket 메시지 스키마.

필드명은 docs/contracts/event-schema.md 의 snake_case 규약에 맞춘다.
"""
from pydantic import BaseModel


class KeystrokeEvent(BaseModel):
    key: str
    type: str  # 'keydown' or 'keyup'
    timestamp: int
    cursor_offset: int


class SessionData(BaseModel):
    events: list[KeystrokeEvent]
    timestamp: int


class PasteEvent(BaseModel):
    type: str = "PASTE_EVENT"
    range: dict
    timestamp: int
