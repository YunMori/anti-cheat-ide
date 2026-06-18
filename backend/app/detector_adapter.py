"""ai_engine 판별기 연동을 한 곳에 캡슐화한다.

torch 등 무거운 의존성은 첫 점수 계산 시점에만 로드되도록 지연(lazy)시킨다.
ai_engine 쪽 경로/모듈이 바뀌면 이 파일의 import 한 줄만 수정하면 된다.
"""
from __future__ import annotations

import sys
from pathlib import Path
from typing import Protocol


class HumanScorer(Protocol):
    """키스트로크 이벤트 목록으로 0~100 인간 유사도 점수를 반환."""

    def predict_human_score(self, events: list[dict]) -> float: ...


def _load_ai_engine_detector(model_dir: str):
    ai_engine_path = Path(__file__).resolve().parent.parent.parent / "ai_engine"
    if str(ai_engine_path) not in sys.path:
        sys.path.append(str(ai_engine_path))
    # ai_engine의 PoC 판별기 (detection 패키지).
    from detection import AntiCheatDetector

    return AntiCheatDetector(model_dir=model_dir)


class LazyAiEngineDetector:
    """첫 호출 때 ai_engine 판별기를 로드하는 지연 어댑터."""

    def __init__(self, model_dir: str) -> None:
        self._model_dir = model_dir
        self._impl: HumanScorer | None = None

    def predict_human_score(self, events: list[dict]) -> float:
        if self._impl is None:
            self._impl = _load_ai_engine_detector(self._model_dir)
        return self._impl.predict_human_score(events)
