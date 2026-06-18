from __future__ import annotations

import json
import os
from urllib.request import Request, urlopen

import pytest


JUDGE_RUNTIME_URL = os.getenv("JUDGE_RUNTIME_URL", "").rstrip("/")

pytestmark = pytest.mark.skipif(
    not JUDGE_RUNTIME_URL,
    reason="set JUDGE_RUNTIME_URL to run real Docker Judge tests",
)


def post_judge(payload: dict) -> dict:
    request = Request(
        f"{JUDGE_RUNTIME_URL}/judge",
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urlopen(request, timeout=15) as response:
        return json.load(response)


def test_python_submission_runs_in_docker_sandbox() -> None:
    result = post_judge(
        {
            "submission_id": "runtime-python",
            "language": "python",
            "source_code": "a, b = map(int, input().split()); print(a + b)",
            "test_cases": [
                {"id": "sum", "stdin": "20 22\n", "expected_stdout": "42\n"}
            ],
            "limits": {"time_ms": 3000, "memory_mb": 128},
        }
    )

    assert result["status"] == "accepted"
    assert result["passed_count"] == 1


def test_infinite_loop_is_terminated() -> None:
    result = post_judge(
        {
            "submission_id": "runtime-timeout",
            "language": "python",
            "source_code": "while True: pass",
            "test_cases": [{"id": "loop", "stdin": "", "expected_stdout": ""}],
            "limits": {"time_ms": 500, "memory_mb": 64},
        }
    )

    assert result["status"] == "time_limit_exceeded"


def test_network_and_root_filesystem_are_blocked() -> None:
    network = post_judge(
        {
            "submission_id": "runtime-network",
            "language": "python",
            "source_code": (
                'import socket; s=socket.socket(); s.settimeout(0.2); '
                's.connect(("1.1.1.1", 80)); print("connected")'
            ),
            "test_cases": [
                {"id": "network", "stdin": "", "expected_stdout": "connected\n"}
            ],
            "limits": {"time_ms": 3000, "memory_mb": 128},
        }
    )
    filesystem = post_judge(
        {
            "submission_id": "runtime-readonly",
            "language": "python",
            "source_code": 'open("/judge-proof", "w").write("x")',
            "test_cases": [{"id": "root", "stdin": "", "expected_stdout": ""}],
            "limits": {"time_ms": 3000, "memory_mb": 128},
        }
    )

    assert network["status"] == "runtime_error"
    assert "Network unreachable" in network["test_cases"][0]["stderr"]
    assert filesystem["status"] == "runtime_error"
    assert "Read-only file system" in filesystem["test_cases"][0]["stderr"]

