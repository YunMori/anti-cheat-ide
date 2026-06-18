"""부정행위 탐지기 (블루팀, PoC).

생성 파이프라인(레드팀, layer1~4)이 만든 타이핑을 거꾸로 판별하는 쪽이다.
GAN의 Discriminator를 재사용해 키스트로크 시퀀스의 '인간 유사도'를 0~100으로
점수화한다.

⚠️ PoC 한계 (향후 발전 지점):
- 전처리에서 hold/gap은 실측이 아니라 고정 placeholder 값을 쓴다.
  delay만 이벤트 timestamp 차이로 계산한다. → 실제 keydown/keyup 기반 정밀
  타이밍 추출로 교체해야 정확도가 올라간다.
- 컨텍스트 벡터는 'NORMAL 상태·중간 복잡도'를 가정한 고정값이다.
  → 실제 세그먼트 복잡도/HMM 상태를 반영해야 한다.
- 점수 매핑은 휴리스틱 sigmoid다. → 보정(calibration) 필요.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

import numpy as np
import torch
from loguru import logger

# layer3_dynamics 등을 절대 경로로 import 할 수 있도록 ai_engine 루트를 경로에 추가
_AI_ENGINE_ROOT = Path(__file__).resolve().parent.parent
if str(_AI_ENGINE_ROOT) not in sys.path:
    sys.path.append(str(_AI_ENGINE_ROOT))

from layer3_dynamics.gan.discriminator import TimingDiscriminator

# --- PoC 상수 (위 docstring의 한계와 직접 연결됨) ---
SEQUENCE_LENGTH = 32
MIN_EVENTS_FOR_SCORING = 5
# 실측 전 placeholder 타이밍 [delay_s, hold_s, gap_s]
_PLACEHOLDER_TIMING = (0.15, 0.08, 0.07)
_DELAY_CLIP_RANGE_S = (0.01, 2.0)

_DEFAULT_GAN_CONFIG = {
    "noise_dim": 64,
    "context_dim": 32,
    "hidden_size": 64,
    "num_layers": 2,
}


class AntiCheatDetector:
    def __init__(self, model_dir: str = "models", config: dict | None = None):
        self.config = config or {"gan": dict(_DEFAULT_GAN_CONFIG)}
        self.device = torch.device(
            "mps" if torch.backends.mps.is_available() else "cpu"
        )

        # 판별기(Discriminator) 로드
        self.D = TimingDiscriminator(
            context_dim=self.config["gan"]["context_dim"],
            hidden_size=self.config["gan"]["hidden_size"],
            num_layers=self.config["gan"]["num_layers"],
            use_proj=True,  # Model G의 특징인 Projection Term 사용
        ).to(self.device)

        model_path = Path(model_dir) / "gan_discriminator.pth"
        if model_path.exists():
            self.D.load_state_dict(torch.load(model_path, map_location=self.device))
            logger.info(f"Anti-Cheat Detector: Loaded model from {model_path}")
        else:
            logger.warning(
                "No discriminator model found. Using untrained weights (Inaccurate)."
            )

        self.D.eval()

    def predict_human_score(self, events: list) -> float:
        """키스트로크 이벤트 리스트 → 0~100 '인간 유사도' 점수."""
        if len(events) < MIN_EVENTS_FOR_SCORING:
            return 100.0  # 데이터가 너무 적으면 일단 신뢰

        sequence = self._build_sequence(events[-SEQUENCE_LENGTH:])
        context = self._default_context()

        with torch.no_grad():
            x = (
                torch.as_tensor(sequence, dtype=torch.float32)
                .unsqueeze(0)
                .to(self.device)
            )
            c = (
                torch.as_tensor(context, dtype=torch.float32)
                .unsqueeze(0)
                .to(self.device)
            )

            # Discriminator score (Hinge loss 기준이므로 양수일수록 'Real' 확률 높음)
            raw_score = self.D(x, c).item()

            # Sigmoid 스타일로 0~100 점수화 (휴리스틱 맵핑)
            human_prob = torch.sigmoid(torch.tensor(raw_score)).item()
            return round(human_prob * 100.0, 2)

    def _build_sequence(self, events: list) -> np.ndarray:
        """이벤트 리스트를 (SEQUENCE_LENGTH, 3) 배열로 변환.

        ⚠️ PoC: hold/gap은 placeholder 고정값, delay만 timestamp로 계산한다.
        """
        data = np.zeros((SEQUENCE_LENGTH, 3), dtype=np.float32)
        low, high = _DELAY_CLIP_RANGE_S

        for i in range(min(len(events), SEQUENCE_LENGTH)):
            data[i] = _PLACEHOLDER_TIMING
            if i > 0:
                delay = (events[i]["timestamp"] - events[i - 1]["timestamp"]) / 1000.0
                data[i][0] = np.clip(delay, low, high)

        return data

    def _default_context(self) -> np.ndarray:
        """컨텍스트 벡터.

        ⚠️ PoC: 'NORMAL 상태·중간 복잡도'를 가정한 고정값.
        index 4 = 중간 복잡도, index 6 = NORMAL state.
        """
        ctx = np.zeros(self.config["gan"]["context_dim"], dtype=np.float32)
        ctx[4] = 0.5
        ctx[6] = 1.0
        return ctx
