from fastapi import FastAPI, Request

from app.models import JudgeRequest, JudgeResponse
from app.runners import DockerSandboxRunner, SandboxRunner
from app.service import JudgeService


def create_app(runner: SandboxRunner | None = None) -> FastAPI:
    app = FastAPI(title="Judge Service API", version="0.1.0")
    app.state.runner = runner or DockerSandboxRunner()

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.post("/judge", response_model=JudgeResponse)
    def create_judge_job(payload: JudgeRequest, request: Request) -> JudgeResponse:
        return JudgeService(request.app.state.runner).judge(payload)

    return app


app = create_app()
