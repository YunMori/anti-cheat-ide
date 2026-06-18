import torch
import numpy as np
from pathlib import Path
from loguru import logger
import sys
import os

# ai_engine 경로를 시스템 패스에 추가하여 내부 모듈 참조 가능케 함
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from layer3_dynamics.gan.discriminator import TimingDiscriminator

class AntiCheatDetector:
    def __init__(self, model_dir: str = "models", config: dict = None):
        self.config = config or {
            "gan": {"noise_dim": 64, "context_dim": 32, "hidden_size": 64, "num_layers": 2}
        }
        self.device = torch.device("mps" if torch.backends.mps.is_available() else "cpu")
        
        # 판별기(Discriminator) 로드
        self.D = TimingDiscriminator(
            context_dim=self.config["gan"]["context_dim"],
            hidden_size=self.config["gan"]["hidden_size"],
            num_layers=self.config["gan"]["num_layers"],
            use_proj=True  # Model G의 특징인 Projection Term 사용
        ).to(self.device)
        
        model_path = Path(model_dir) / "gan_discriminator.pth"
        if model_path.exists():
            self.D.load_state_dict(torch.load(model_path, map_location=self.device))
            logger.info(f"Anti-Cheat Detector: Loaded model from {model_path}")
        else:
            logger.warning("No discriminator model found. Using untrained weights (Inaccurate).")
        
        self.D.eval()

    def predict_human_score(self, events: list) -> float:
        """
        키스트로크 이벤트 리스트를 분석하여 0~100 사이의 '인간 유사도' 점수를 반환.
        """
        if len(events) < 5:
            return 100.0  # 데이터가 너무 적으면 일단 신뢰
            
        # 1. 전처리: [keydown_delay, keyhold, gap] 시퀀스 추출 (최근 32개 기준)
        # (실제 구현에서는 프론트엔드 타임스탬프 기반으로 정밀 계산)
        sequence = self._preprocess_events(events[-32:])
        
        # 2. 컨텍스트 벡터 생성 (여기서는 평균적인 환경값 사용)
        # [0-31] index 중 HMM 상태를 'NORMAL'로 가정하여 6번 인덱스 활성화
        ctx = np.zeros(32, dtype=np.float32)
        ctx[4] = 0.5 # 중간 복잡도
        ctx[6] = 1.0 # NORMAL state
        
        with torch.no_grad():
            x = torch.as_tensor(sequence, dtype=torch.float32).unsqueeze(0).to(self.device)
            c = torch.as_tensor(ctx, dtype=torch.float32).unsqueeze(0).to(self.device)
            
            # Discriminator score (Hinge loss 기준이므로 양수일수록 'Real' 확률 높음)
            raw_score = self.D(x, c).item()
            
            # Sigmoid 스타일로 0~100 점수화 (휴리스틱 맵핑)
            human_prob = torch.sigmoid(torch.tensor(raw_score)).item()
            return round(human_prob * 100.0, 2)

    def _preprocess_events(self, events: list) -> np.ndarray:
        """이벤트 리스트를 (seq_len, 3) 텐서용 배열로 변환"""
        seq_len = 32
        data = np.zeros((seq_len, 3), dtype=np.float32)
        
        for i in range(min(len(events), seq_len)):
            # 단순화를 위해 고정값 또는 랜덤 샘플링 (실제 타임스탬프 차이 계산 로직 필요)
            # [delay_s, hold_s, gap_s]
            data[i] = [0.15, 0.08, 0.07] 
            
            if i > 0:
                delay = (events[i]['timestamp'] - events[i-1]['timestamp']) / 1000.0
                data[i][0] = np.clip(delay, 0.01, 2.0)
                
        return data
