from abc import ABC, abstractmethod
from dataclasses import dataclass

from app.models import Limits
from app.profiles import LanguageProfile


@dataclass(frozen=True)
class ExecutionRequest:
    profile: LanguageProfile
    source_code: str
    stdin: str
    limits: Limits


@dataclass(frozen=True)
class ExecutionResult:
    stdout: str
    stderr: str
    exit_code: int | None
    duration_ms: int
    timed_out: bool = False
    internal_error: bool = False


class SandboxRunner(ABC):
    @abstractmethod
    def execute(self, request: ExecutionRequest) -> ExecutionResult:
        """Execute untrusted code within an isolated sandbox."""
