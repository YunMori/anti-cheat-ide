from __future__ import annotations

import ast
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
JUDGE_ROOT = ROOT / "services" / "judge-service"
APP_ROOT = JUDGE_ROOT / "app"
DOCKER_RUNNER = APP_ROOT / "runners" / "docker.py"
DOCKERFILE = JUDGE_ROOT / "Dockerfile"


def parse(path: Path) -> ast.AST:
    return ast.parse(path.read_text())


def test_judge_defaults_to_docker_sandbox_runner() -> None:
    main_source = (APP_ROOT / "main.py").read_text()

    assert "runner or DockerSandboxRunner()" in main_source
    assert "app = create_app()" in main_source


def test_judge_service_image_installs_docker_cli() -> None:
    source = DOCKERFILE.read_text()

    assert "docker-cli" in source
    assert "docker.io" not in source


def test_host_execution_apis_only_exist_in_docker_runner() -> None:
    forbidden_imports = {"subprocess", "commands"}
    forbidden_calls = {"eval", "exec", "compile"}
    forbidden_attributes = {
        ("os", "system"),
        ("os", "popen"),
        ("subprocess", "run"),
        ("subprocess", "Popen"),
        ("subprocess", "call"),
        ("asyncio", "create_subprocess_exec"),
        ("asyncio", "create_subprocess_shell"),
    }

    for path in APP_ROOT.rglob("*.py"):
        if path == DOCKER_RUNNER:
            continue

        tree = parse(path)
        imported_modules = {
            alias.name.split(".")[0]
            for node in ast.walk(tree)
            if isinstance(node, ast.Import)
            for alias in node.names
        }
        called_names = {
            node.func.id
            for node in ast.walk(tree)
            if isinstance(node, ast.Call) and isinstance(node.func, ast.Name)
        }
        called_attributes = {
            (node.func.value.id, node.func.attr)
            for node in ast.walk(tree)
            if isinstance(node, ast.Call)
            and isinstance(node.func, ast.Attribute)
            and isinstance(node.func.value, ast.Name)
        }

        assert not imported_modules.intersection(forbidden_imports), path
        assert not called_names.intersection(forbidden_calls), path
        assert not called_attributes.intersection(forbidden_attributes), path


def test_docker_runner_does_not_use_shell_true() -> None:
    tree = parse(DOCKER_RUNNER)
    subprocess_calls = [
        node
        for node in ast.walk(tree)
        if isinstance(node, ast.Call)
        and isinstance(node.func, ast.Attribute)
        and isinstance(node.func.value, ast.Name)
        and node.func.value.id == "subprocess"
        and node.func.attr == "run"
    ]

    assert subprocess_calls
    for call in subprocess_calls:
        shell_keywords = [
            keyword
            for keyword in call.keywords
            if keyword.arg == "shell"
        ]
        assert not shell_keywords or all(
            isinstance(keyword.value, ast.Constant)
            and keyword.value.value is False
            for keyword in shell_keywords
        )


def test_docker_runner_declares_required_isolation_flags() -> None:
    source = DOCKER_RUNNER.read_text()

    for expected in (
        '"--network",\n            "none"',
        '"--read-only"',
        '"--cap-drop",\n            "ALL"',
        '"no-new-privileges"',
        '"--user"',
        '"--pids-limit"',
        '"--memory"',
        '"--memory-swap"',
        '"--cpus"',
        '"--tmpfs"',
    ):
        assert expected in source

    assert '"/tmp:rw,exec,nosuid,size=64m"' in source
