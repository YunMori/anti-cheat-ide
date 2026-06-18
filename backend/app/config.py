"""백엔드 설정. 하드코딩된 값들을 환경변수로 조정 가능하게 모은다."""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

# 저장소 루트 기준 ai_engine/models 경로
_DEFAULT_MODEL_DIR = str(
    Path(__file__).resolve().parent.parent.parent / "ai_engine" / "models"
)


@dataclass(frozen=True)
class BackendConfig:
    model_dir: str = _DEFAULT_MODEL_DIR
    initial_human_score: float = 100.0
    min_human_score: float = 0.0
    paste_penalty: float = 15.0
    cors_allowed_origins: tuple[str, ...] = field(default_factory=lambda: ("*",))

    @classmethod
    def from_env(cls) -> "BackendConfig":
        origins = os.getenv("BACKEND_CORS_ALLOWED_ORIGINS", "*")
        return cls(
            model_dir=os.getenv("BACKEND_MODEL_DIR", _DEFAULT_MODEL_DIR),
            initial_human_score=float(
                os.getenv("BACKEND_INITIAL_HUMAN_SCORE", "100.0")
            ),
            min_human_score=float(os.getenv("BACKEND_MIN_HUMAN_SCORE", "0.0")),
            paste_penalty=float(os.getenv("BACKEND_PASTE_PENALTY", "15.0")),
            cors_allowed_origins=tuple(
                origin.strip() for origin in origins.split(",") if origin.strip()
            ),
        )
