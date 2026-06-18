"""탐지(블루팀) 패키지.

생성 파이프라인(레드팀, layer1~4)과 대비되는, 부정행위 판별기를 모은다.
"""
from .detector import AntiCheatDetector

__all__ = ["AntiCheatDetector"]
