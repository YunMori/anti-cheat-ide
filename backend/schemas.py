from pydantic import BaseModel
from typing import List, Optional, Union

class KeystrokeEvent(BaseModel):
    key: str
    type: str  # 'keydown' or 'keyup'
    timestamp: int
    cursorOffset: int

class SessionData(BaseModel):
    events: List[KeystrokeEvent]
    timestamp: int

class PasteEvent(BaseModel):
    type: str = "PASTE_EVENT"
    range: dict
    timestamp: int
