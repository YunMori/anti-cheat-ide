import base64
import shlex
import subprocess
import time
import uuid

from app.runners.base import ExecutionRequest, ExecutionResult, SandboxRunner


class DockerSandboxRunner(SandboxRunner):
    """Runs submissions in short-lived, resource-constrained Docker containers."""

    def __init__(self, docker_binary: str = "docker") -> None:
        self._docker_binary = docker_binary

    def execute(self, request: ExecutionRequest) -> ExecutionResult:
        container_name = f"judge-{uuid.uuid4().hex}"
        command = self._build_command(container_name, request)
        started_at = time.monotonic()

        try:
            completed = subprocess.run(
                command,
                input=request.stdin,
                capture_output=True,
                text=True,
                timeout=request.limits.time_ms / 1000,
                check=False,
            )
            return ExecutionResult(
                stdout=completed.stdout,
                stderr=completed.stderr,
                exit_code=completed.returncode,
                duration_ms=self._elapsed_ms(started_at),
                internal_error=completed.returncode == 125,
            )
        except subprocess.TimeoutExpired as exc:
            self._remove_container(container_name)
            return ExecutionResult(
                stdout=self._decode_timeout_output(exc.stdout),
                stderr=self._decode_timeout_output(exc.stderr),
                exit_code=None,
                duration_ms=self._elapsed_ms(started_at),
                timed_out=True,
            )
        except (OSError, subprocess.SubprocessError) as exc:
            return ExecutionResult(
                stdout="",
                stderr=f"Docker sandbox failed: {exc}",
                exit_code=None,
                duration_ms=self._elapsed_ms(started_at),
                internal_error=True,
            )

    def _build_command(
        self, container_name: str, request: ExecutionRequest
    ) -> list[str]:
        encoded_source = base64.b64encode(request.source_code.encode()).decode()
        profile = request.profile
        run_command = shlex.join(profile.run_command)
        compile_command = (
            f" && {shlex.join(profile.compile_command)}"
            if profile.compile_command
            else ""
        )
        wrapper = (
            f"printf '%s' \"$JUDGE_SOURCE_B64\" | base64 -d > /tmp/{profile.filename}"
            f"{compile_command} && exec {run_command}"
        )

        return [
            self._docker_binary,
            "run",
            "--rm",
            "--name",
            container_name,
            "--network",
            "none",
            "--read-only",
            "--cap-drop",
            "ALL",
            "--security-opt",
            "no-new-privileges",
            "--user",
            "65534:65534",
            "--pids-limit",
            "64",
            "--memory",
            f"{request.limits.memory_mb}m",
            "--memory-swap",
            f"{request.limits.memory_mb}m",
            "--cpus",
            "1",
            "--tmpfs",
            "/tmp:rw,exec,nosuid,size=64m",
            "--env",
            f"JUDGE_SOURCE_B64={encoded_source}",
            "--interactive",
            profile.image,
            "sh",
            "-c",
            wrapper,
        ]

    def _remove_container(self, container_name: str) -> None:
        try:
            subprocess.run(
                [self._docker_binary, "rm", "--force", container_name],
                capture_output=True,
                timeout=5,
                check=False,
            )
        except (OSError, subprocess.SubprocessError):
            pass

    @staticmethod
    def _decode_timeout_output(value: bytes | str | None) -> str:
        if value is None:
            return ""
        return value.decode(errors="replace") if isinstance(value, bytes) else value

    @staticmethod
    def _elapsed_ms(started_at: float) -> int:
        return max(0, round((time.monotonic() - started_at) * 1000))
