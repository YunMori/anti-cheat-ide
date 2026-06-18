"""Platform API 앱 팩토리.

라우트 핸들러는 `routers/` 아래 도메인별 모듈로 분리되어 있고, 공통 의존성은
`dependencies.py`에 있다. 이 모듈은 미들웨어 구성과 라우터 등록, 외부 서비스
어댑터(Detection/Judge) 연결만 담당한다.
"""
from __future__ import annotations

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .detection import HttpRiskAssessor, RiskAssessor
from .judge import HttpJudgeClient, JudgeClient
from .models import HealthResponse
from .repositories import InMemoryPlatformRepository, PlatformRepository
from .routers import (
    admin_users,
    assessments,
    auth,
    events,
    invites,
    problems,
    risk,
    sessions,
    submissions,
)


def create_app(
    repository: PlatformRepository | None = None,
    risk_assessor: RiskAssessor | None = None,
    judge_client: JudgeClient | None = None,
    require_admin_auth: bool | None = None,
) -> FastAPI:
    app = FastAPI(title="Web IDE Platform API", version="0.1.0")
    app.state.repository = repository or create_default_repository()
    app.state.require_admin_auth = (
        require_admin_auth
        if require_admin_auth is not None
        else repository is None
        and os.getenv("ADMIN_AUTH_REQUIRED", "true").lower() != "false"
    )
    detection_service_url = os.getenv("DETECTION_SERVICE_URL", "").strip()
    app.state.risk_assessor = risk_assessor or (
        HttpRiskAssessor(detection_service_url) if detection_service_url else None
    )
    judge_service_url = os.getenv("JUDGE_SERVICE_URL", "").strip()
    app.state.judge_client = judge_client or (
        HttpJudgeClient(judge_service_url) if judge_service_url else None
    )
    allowed_origins = [
        origin.strip()
        for origin in os.getenv(
            "CORS_ALLOWED_ORIGINS",
            "http://localhost:3000,http://localhost:3001",
        ).split(",")
        if origin.strip()
    ]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization"],
    )

    @app.get("/health", response_model=HealthResponse)
    def health() -> HealthResponse:
        return HealthResponse()

    for module in (
        auth,
        admin_users,
        assessments,
        problems,
        sessions,
        invites,
        events,
        submissions,
        risk,
    ):
        app.include_router(module.router)

    return app


def create_default_repository() -> PlatformRepository:
    database_url = os.getenv("DATABASE_URL", "").strip()
    if not database_url:
        return InMemoryPlatformRepository()

    from .postgres_repository import PostgresPlatformRepository

    return PostgresPlatformRepository(database_url)


app = create_app()
