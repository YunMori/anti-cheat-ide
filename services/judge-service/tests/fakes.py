from collections import deque

from app.runners.base import ExecutionRequest, ExecutionResult, SandboxRunner


class FakeRunner(SandboxRunner):
    def __init__(self, results: list[ExecutionResult]) -> None:
        self.results = deque(results)
        self.requests: list[ExecutionRequest] = []

    def execute(self, request: ExecutionRequest) -> ExecutionResult:
        self.requests.append(request)
        return self.results.popleft()
