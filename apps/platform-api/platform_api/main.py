from __future__ import annotations

import os
import secrets
from datetime import timezone
from typing import Annotated
from uuid import uuid4

import httpx
from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .auth import (
    TokenError,
    hash_password,
    issue_access_token,
    verify_access_token,
    verify_password,
)
from .detection import HttpRiskAssessor, RiskAssessor
from .judge import HttpJudgeClient, JudgeClient
from .models import (
    AdminApproval,
    AdminLogin,
    AdminSignup,
    AdminToken,
    AdminUser,
    AdminUserRecord,
    Assessment,
    AssessmentCreate,
    CandidateInvite,
    CandidateInviteCreate,
    CandidateInvitePreview,
    CandidateInviteRedeemed,
    CandidateProblem,
    EventBatch,
    EventBatchAccepted,
    EventBatchCreate,
    HealthResponse,
    JudgeResult,
    Problem,
    ProblemCreate,
    RiskAssessment,
    Session,
    SessionCreate,
    Submission,
    SubmissionAccepted,
    SubmissionCreate,
    TestCase,
    utc_now,
)
from .repositories import (
    InMemoryPlatformRepository,
    PlatformRepository,
    SequenceConflictError,
)


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid4().hex}"


def get_repository(request: Request) -> PlatformRepository:
    return request.app.state.repository


RepositoryDependency = Annotated[PlatformRepository, Depends(get_repository)]
bearer_scheme = HTTPBearer(auto_error=False)


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

    @app.post(
        "/auth/signup",
        response_model=AdminUser,
        status_code=status.HTTP_201_CREATED,
    )
    def signup(payload: AdminSignup, repository: RepositoryDependency) -> AdminUser:
        active_admin_count = repository.count_active_admin_users()
        user = AdminUserRecord(
            id=new_id("usr"),
            email=payload.email.lower(),
            display_name=payload.display_name,
            role="admin" if active_admin_count == 0 else None,
            status="active" if active_admin_count == 0 else "pending",
            created_at=utc_now(),
            approved_at=utc_now() if active_admin_count == 0 else None,
            password_hash=hash_password(payload.password),
        )
        try:
            created = repository.create_admin_user(user)
        except ValueError as exc:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="email already registered",
            ) from exc
        return public_admin_user(created)

    @app.post("/auth/login", response_model=AdminToken)
    def login(payload: AdminLogin, repository: RepositoryDependency) -> AdminToken:
        user = repository.get_admin_user_by_email(payload.email)
        if (
            user is None
            or user.status != "active"
            or user.role is None
            or not verify_password(payload.password, user.password_hash)
        ):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="invalid credentials",
            )
        return AdminToken(
            access_token=issue_access_token(user.id),
            user=public_admin_user(user),
        )

    @app.get("/auth/me", response_model=AdminUser)
    def me(current_user: Annotated[AdminUserRecord, Depends(require_authenticated_admin)]) -> AdminUser:
        return public_admin_user(current_user)

    @app.get("/admin/users/pending", response_model=list[AdminUser])
    def list_pending_users(
        repository: RepositoryDependency,
        current_user: Annotated[AdminUserRecord, Depends(require_role("admin"))],
    ) -> list[AdminUser]:
        del current_user
        return [public_admin_user(user) for user in repository.list_pending_admin_users()]

    @app.post("/admin/users/{user_id}/approve", response_model=AdminUser)
    def approve_user(
        user_id: str,
        payload: AdminApproval,
        repository: RepositoryDependency,
        current_user: Annotated[AdminUserRecord, Depends(require_role("admin"))],
    ) -> AdminUser:
        del current_user
        user = repository.approve_admin_user(user_id, payload.role, utc_now())
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="user not found",
            )
        return public_admin_user(user)

    @app.post(
        "/assessments",
        response_model=Assessment,
        status_code=status.HTTP_201_CREATED,
    )
    def create_assessment(
        payload: AssessmentCreate,
        repository: RepositoryDependency,
        current_user: Annotated[
            AdminUserRecord | None, Depends(require_role("admin"))
        ],
    ) -> Assessment:
        del current_user
        assessment = Assessment(id=new_id("asm"), **payload.model_dump())
        return repository.create_assessment(assessment)

    @app.get("/assessments", response_model=list[Assessment])
    def list_assessments(
        repository: RepositoryDependency,
        current_user: Annotated[
            AdminUserRecord | None, Depends(require_authenticated_admin)
        ],
    ) -> list[Assessment]:
        del current_user
        return repository.list_assessments()

    @app.get("/assessments/{assessment_id}", response_model=Assessment)
    def get_assessment(
        assessment_id: str,
        repository: RepositoryDependency,
        current_user: Annotated[
            AdminUserRecord | None, Depends(require_authenticated_admin)
        ],
    ) -> Assessment:
        del current_user
        assessment = repository.get_assessment(assessment_id)
        if assessment is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="assessment not found",
            )
        return assessment

    @app.post(
        "/problems",
        response_model=Problem,
        status_code=status.HTTP_201_CREATED,
    )
    def create_problem(
        payload: ProblemCreate,
        repository: RepositoryDependency,
        current_user: Annotated[
            AdminUserRecord | None, Depends(require_role("admin"))
        ],
    ) -> Problem:
        del current_user
        if repository.get_assessment(payload.assessment_id) is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="assessment not found",
            )
        problem = Problem(
            id=new_id("prb"),
            test_cases=[
                TestCase(id=new_id("tc"), **test_case.model_dump())
                for test_case in payload.test_cases
            ],
            **payload.model_dump(exclude={"test_cases"}),
        )
        return repository.create_problem(problem)

    @app.get("/problems", response_model=list[Problem])
    def list_problems(
        repository: RepositoryDependency,
        current_user: Annotated[
            AdminUserRecord | None, Depends(require_authenticated_admin)
        ],
        assessment_id: str | None = None,
    ) -> list[Problem]:
        del current_user
        return repository.list_problems(assessment_id)

    @app.get("/problems/{problem_id}", response_model=Problem)
    def get_problem(
        problem_id: str,
        repository: RepositoryDependency,
        current_user: Annotated[
            AdminUserRecord | None, Depends(require_authenticated_admin)
        ],
    ) -> Problem:
        del current_user
        problem = repository.get_problem(problem_id)
        if problem is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="problem not found",
            )
        return problem

    @app.post(
        "/sessions",
        response_model=Session,
        status_code=status.HTTP_201_CREATED,
    )
    def create_session(
        payload: SessionCreate,
        repository: RepositoryDependency,
        current_user: Annotated[
            AdminUserRecord | None, Depends(require_role("admin"))
        ],
    ) -> Session:
        del current_user
        if repository.get_assessment(payload.assessment_id) is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="assessment not found",
            )

        session = Session(
            id=new_id("ses"),
            assessment_id=payload.assessment_id,
            candidate_id=payload.candidate_id,
            started_at=utc_now(),
        )
        initial_risk = RiskAssessment(
            id=new_id("risk"),
            session_id=session.id,
            risk_score=0,
            review_recommended=False,
            signals=[],
            model_version="unassessed",
        )
        return repository.create_session(session, initial_risk)

    @app.post(
        "/assessments/{assessment_id}/invites",
        response_model=CandidateInvite,
        status_code=status.HTTP_201_CREATED,
    )
    def create_candidate_invite(
        assessment_id: str,
        payload: CandidateInviteCreate,
        repository: RepositoryDependency,
        current_user: Annotated[
            AdminUserRecord | None, Depends(require_role("admin"))
        ],
    ) -> CandidateInvite:
        assessment = repository.get_assessment(assessment_id)
        if assessment is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="assessment not found",
            )
        if payload.expires_at <= utc_now():
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="expires_at must be in the future",
            )
        token = secrets.token_urlsafe(24)
        invite = CandidateInvite(
            id=new_id("inv"),
            assessment_id=assessment_id,
            candidate_id=payload.candidate_id,
            token=token,
            invite_url=build_invite_url(token),
            expires_at=payload.expires_at,
            created_at=utc_now(),
            created_by_user_id=current_user.id if current_user else "auth-disabled",
        )
        return repository.create_candidate_invite(invite)

    @app.get("/invites/{token}", response_model=CandidateInvitePreview)
    def preview_candidate_invite(
        token: str, repository: RepositoryDependency
    ) -> CandidateInvitePreview:
        invite = require_valid_invite(repository, token, allow_used=True)
        assessment = repository.get_assessment(invite.assessment_id)
        if assessment is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="assessment not found",
            )
        return CandidateInvitePreview(
            assessment_id=assessment.id,
            assessment_title=assessment.title,
            candidate_id=invite.candidate_id,
            expires_at=invite.expires_at,
            used=invite.used_at is not None,
        )

    @app.post("/invites/{token}/redeem", response_model=CandidateInviteRedeemed)
    def redeem_candidate_invite(
        token: str, repository: RepositoryDependency
    ) -> CandidateInviteRedeemed:
        invite = require_valid_invite(repository, token, allow_used=False)
        session = Session(
            id=new_id("ses"),
            assessment_id=invite.assessment_id,
            candidate_id=invite.candidate_id,
            started_at=utc_now(),
        )
        used = repository.mark_candidate_invite_used(token, utc_now(), session)
        if used is None or used.session_id != session.id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="invite already used",
            )
        return CandidateInviteRedeemed(session=session)

    @app.get("/sessions/{session_id}", response_model=Session)
    def get_session(
        session_id: str, repository: RepositoryDependency
    ) -> Session:
        return require_session(repository, session_id)

    @app.get(
        "/sessions/{session_id}/problems",
        response_model=list[CandidateProblem],
    )
    def list_session_problems(
        session_id: str, repository: RepositoryDependency
    ) -> list[CandidateProblem]:
        session = require_session(repository, session_id)
        return [
            CandidateProblem(
                id=problem.id,
                assessment_id=problem.assessment_id,
                title=problem.title,
                statement=problem.statement,
                allowed_languages=problem.allowed_languages,
                starter_code=problem.starter_code,
                time_limit_ms=problem.time_limit_ms,
                memory_limit_mb=problem.memory_limit_mb,
                public_test_cases=[
                    test_case
                    for test_case in problem.test_cases
                    if not test_case.hidden
                ],
            )
            for problem in repository.list_problems(session.assessment_id)
        ]

    @app.post(
        "/sessions/{session_id}/events",
        response_model=EventBatchAccepted,
        status_code=status.HTTP_202_ACCEPTED,
    )
    def ingest_session_events(
        session_id: str,
        payload: EventBatchCreate,
        repository: RepositoryDependency,
    ) -> EventBatchAccepted:
        require_session(repository, session_id)
        if payload.session_id != session_id:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="payload session_id must match path session_id",
            )

        batch = EventBatch(
            id=new_id("batch"),
            received_at=utc_now(),
            **payload.model_dump(),
        )
        try:
            next_sequence = repository.append_event_batch(batch)
        except SequenceConflictError as exc:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "message": "duplicate or out-of-order sequence",
                    "expected_sequence_start": exc.expected,
                    "received_sequence_start": exc.received,
                },
            ) from exc

        assessor: RiskAssessor | None = request_risk_assessor(repository, app)
        if assessor is not None:
            try:
                repository.save_risk_assessment(assessor.assess(payload))
            except (httpx.HTTPError, KeyError, TypeError, ValueError):
                # Event ingestion remains available when Detection Service is down.
                pass

        return EventBatchAccepted(
            batch_id=batch.id,
            accepted_events=len(batch.events),
            next_sequence=next_sequence,
        )

    @app.post(
        "/sessions/{session_id}/submissions",
        response_model=SubmissionAccepted,
        status_code=status.HTTP_202_ACCEPTED,
    )
    def create_submission(
        session_id: str,
        payload: SubmissionCreate,
        repository: RepositoryDependency,
    ) -> Submission:
        session = require_session(repository, session_id)
        problem = repository.get_problem(payload.problem_id)
        if problem is None or problem.assessment_id != session.assessment_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="problem not found for session assessment",
            )
        if payload.language not in problem.allowed_languages:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="language is not allowed for this problem",
            )
        submission = Submission(
            id=new_id("sub"),
            session_id=session_id,
            created_at=utc_now(),
            **payload.model_dump(),
        )
        stored_submission = repository.append_submission(submission)
        judge_result: JudgeResult | None = None
        judge_client: JudgeClient | None = app.state.judge_client
        if judge_client is not None:
            try:
                judge_result = repository.save_judge_result(
                    judge_client.judge(stored_submission, problem)
                )
                stored_submission = (
                    repository.update_submission_status(
                        session_id, stored_submission.id, "judged"
                    )
                    or stored_submission
                )
            except (httpx.HTTPError, KeyError, TypeError, ValueError):
                stored_submission = (
                    repository.update_submission_status(
                        session_id, stored_submission.id, "judge_failed"
                    )
                    or stored_submission
                )
        return SubmissionAccepted(
            **stored_submission.model_dump(),
            judge_result=judge_result,
        )

    @app.get(
        "/sessions/{session_id}/submissions",
        response_model=list[SubmissionAccepted],
    )
    def list_session_submissions(
        session_id: str,
        repository: RepositoryDependency,
        current_user: Annotated[
            AdminUserRecord | None, Depends(require_authenticated_admin)
        ],
    ) -> list[SubmissionAccepted]:
        del current_user
        require_session(repository, session_id)
        return [
            SubmissionAccepted(
                **submission.model_dump(),
                judge_result=repository.get_judge_result(submission.id),
            )
            for submission in repository.list_submissions(session_id)
        ]

    @app.get(
        "/submissions/{submission_id}/judge-result",
        response_model=JudgeResult,
    )
    def get_submission_judge_result(
        submission_id: str,
        repository: RepositoryDependency,
    ) -> JudgeResult:
        result = repository.get_judge_result(submission_id)
        if result is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="judge result not found",
            )
        return result

    @app.get(
        "/sessions/{session_id}/risk",
        response_model=RiskAssessment,
    )
    def get_session_risk(
        session_id: str,
        repository: RepositoryDependency,
        current_user: Annotated[
            AdminUserRecord | None, Depends(require_authenticated_admin)
        ],
    ) -> RiskAssessment:
        del current_user
        require_session(repository, session_id)
        assessment = repository.get_risk_assessment(session_id)
        if assessment is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="risk assessment not found",
            )
        return assessment

    return app


def create_default_repository() -> PlatformRepository:
    database_url = os.getenv("DATABASE_URL", "").strip()
    if not database_url:
        return InMemoryPlatformRepository()

    from .postgres_repository import PostgresPlatformRepository

    return PostgresPlatformRepository(database_url)


def public_admin_user(user: AdminUserRecord) -> AdminUser:
    return AdminUser.model_validate(user.model_dump(exclude={"password_hash"}))


def require_authenticated_admin(
    request: Request,
    repository: RepositoryDependency,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> AdminUserRecord | None:
    if not request.app.state.require_admin_auth:
        return None
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="authentication required",
        )
    try:
        user_id = verify_access_token(credentials.credentials)
    except TokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid token",
        ) from exc
    user = repository.get_admin_user(user_id)
    if user is None or user.status != "active" or user.role is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid token",
        )
    return user


def require_role(role: str):
    def dependency(
        current_user: Annotated[
            AdminUserRecord | None, Depends(require_authenticated_admin)
        ],
        request: Request,
    ) -> AdminUserRecord | None:
        if not request.app.state.require_admin_auth:
            return None
        if current_user is None or current_user.role != role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="insufficient role",
            )
        return current_user

    return dependency


def require_valid_invite(
    repository: PlatformRepository, token: str, allow_used: bool
) -> CandidateInvite:
    invite = repository.get_candidate_invite_by_token(token)
    if invite is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="invite not found",
        )
    expires_at = invite.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at <= utc_now():
        raise HTTPException(
            status_code=status.HTTP_410_GONE,
            detail="invite expired",
        )
    if invite.used_at is not None and not allow_used:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="invite already used",
        )
    return invite


def build_invite_url(token: str) -> str:
    base_url = os.getenv("INVITE_PUBLIC_BASE_URL", "http://localhost:3000").rstrip("/")
    return f"{base_url}/?invite={token}"


def request_risk_assessor(
    repository: PlatformRepository, app: FastAPI
) -> RiskAssessor | None:
    # Keeping this lookup isolated makes the integration replaceable in tests
    # and avoids coupling the repository to network concerns.
    del repository
    return app.state.risk_assessor


def require_session(
    repository: PlatformRepository, session_id: str
) -> Session:
    session = repository.get_session(session_id)
    if session is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="session not found",
        )
    return session


app = create_app()
