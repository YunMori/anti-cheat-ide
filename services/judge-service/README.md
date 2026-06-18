# Judge Service

FastAPI-based synchronous MVP judge service. It accepts Python, JavaScript,
C++20, and Java 21 submissions and returns an overall result plus a result for
every test case.

## Safety boundary

The default runner is `DockerSandboxRunner`. The service never executes submitted
source code directly on the host. Each test case runs in a new Docker container
with:

- no network
- a read-only root filesystem and isolated `/tmp`
- an unprivileged user, all Linux capabilities dropped, and `no-new-privileges`
- memory, CPU, and PID limits
- a host-side execution timeout

Docker must be available to the service process. In production, mount the Docker
socket only into a dedicated Judge Service host or replace the runner with a
stronger remote sandbox. Do not colocate the service with trusted workloads.
When running the service image, it needs access to the dedicated host's Docker
socket, for example `-v /var/run/docker.sock:/var/run/docker.sock`.
The service image installs only the Docker CLI and communicates with that
dedicated daemon; it does not run a nested Docker daemon.

## Run locally

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8002
```

The default development port is `8002`.

```bash
curl http://localhost:8002/health
```

To run the service image on a dedicated Judge host:

```bash
docker build -t judge-service .
docker run --rm -p 8002:8002 \
  -v /var/run/docker.sock:/var/run/docker.sock judge-service
```

The Docker runner pulls these language images when first used:

- Python: `python:3.12-alpine`
- JavaScript: `node:22-alpine`
- C++20: `gcc:14-bookworm`
- Java 21: `eclipse-temurin:21-jdk-jammy`

## API

`POST /judge` follows `docs/contracts/judge-api.yaml`. Example:

```json
{
  "submission_id": "submission-1",
  "language": "python",
  "source_code": "a, b = map(int, input().split()); print(a + b)",
  "test_cases": [
    {"id": "sample-1", "stdin": "1 2\n", "expected_stdout": "3\n"}
  ],
  "limits": {"time_ms": 2000, "memory_mb": 128}
}
```

Output comparison is exact after converting CRLF line endings to LF. Trailing
spaces and trailing newlines remain significant.

## Test

Tests use a safe fake runner and do not execute submitted code:

```bash
pip install -r requirements-dev.txt
pytest
```

## MVP limitations

- Judging is synchronous and test cases run sequentially.
- Language images are tags rather than immutable digests.
- The first judge request may include image-pull startup time; pre-pull approved
  language images before accepting traffic.
- Captured stdout/stderr do not yet have an output-size limit.
- Docker isolation is weaker than a dedicated microVM sandbox.
