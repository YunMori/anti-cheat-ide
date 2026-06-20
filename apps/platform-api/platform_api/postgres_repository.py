from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    Column,
    JSON,
    DateTime,
    Integer,
    MetaData,
    String,
    Table,
    Text,
    UniqueConstraint,
    create_engine,
    delete,
    insert,
    select,
    update,
)
from sqlalchemy.engine import Engine

from .models import (
    AdminUserRecord,
    Assessment,
    CandidateInvite,
    EventBatch,
    JudgeResult,
    Problem,
    RiskAssessment,
    Session,
    Submission,
)
from .repositories import SequenceConflictError


metadata = MetaData()

admin_users = Table(
    "admin_users",
    metadata,
    *[
        Column("id", String, primary_key=True),
        Column("email", String, nullable=False, unique=True),
        Column("display_name", String, nullable=False),
        Column("role", String, nullable=True),
        Column("status", String, nullable=False),
        Column("created_at", DateTime(timezone=True), nullable=False),
        Column("approved_at", DateTime(timezone=True), nullable=True),
        Column("password_hash", Text, nullable=False),
    ],
)

assessments = Table(
    "assessments",
    metadata,
    Column("id", String, primary_key=True),
    Column("organization_id", String, nullable=False),
    Column("title", String, nullable=False),
    Column("starts_at", DateTime(timezone=True), nullable=False),
    Column("ends_at", DateTime(timezone=True), nullable=False),
)

problems = Table(
    "problems",
    metadata,
    Column("id", String, primary_key=True),
    Column("payload", JSON, nullable=False),
)

sessions = Table(
    "sessions",
    metadata,
    Column("id", String, primary_key=True),
    Column("payload", JSON, nullable=False),
)

event_batches = Table(
    "session_event_batches",
    metadata,
    Column("id", String, primary_key=True),
    Column("session_id", String, nullable=False),
    Column("sequence_start", Integer, nullable=False),
    Column("payload", JSON, nullable=False),
    UniqueConstraint("session_id", "sequence_start", name="uq_event_batch_sequence"),
)

next_sequences = Table(
    "session_next_sequences",
    metadata,
    Column("session_id", String, primary_key=True),
    Column("next_sequence", Integer, nullable=False),
)

submissions = Table(
    "submissions",
    metadata,
    Column("id", String, primary_key=True),
    Column("session_id", String, nullable=False),
    Column("payload", JSON, nullable=False),
)

judge_results = Table(
    "judge_results",
    metadata,
    Column("submission_id", String, primary_key=True),
    Column("payload", JSON, nullable=False),
)

risk_assessments = Table(
    "risk_assessments",
    metadata,
    Column("session_id", String, primary_key=True),
    Column("payload", JSON, nullable=False),
    Column("risk_score", Integer, nullable=False),
)

candidate_invites = Table(
    "candidate_invites",
    metadata,
    Column("id", String, primary_key=True),
    Column("token", String, nullable=False, unique=True),
    Column("payload", JSON, nullable=False),
)


class PostgresPlatformRepository:
    def __init__(self, database_url: str) -> None:
        self._engine = create_engine(database_url, future=True)
        metadata.create_all(self._engine)

    def count_active_admin_users(self) -> int:
        with self._engine.begin() as conn:
            return len(
                conn.execute(
                    select(admin_users.c.id).where(
                        admin_users.c.status == "active",
                        admin_users.c.role == "admin",
                    )
                ).all()
            )

    def create_admin_user(self, user: AdminUserRecord) -> AdminUserRecord:
        payload = user.model_dump()
        with self._engine.begin() as conn:
            existing = conn.execute(
                select(admin_users.c.id).where(admin_users.c.email == user.email.lower())
            ).first()
            if existing:
                raise ValueError("email already registered")
            conn.execute(insert(admin_users).values(**payload))
        return user

    def get_admin_user(self, user_id: str) -> AdminUserRecord | None:
        return self._get_admin_user(admin_users.c.id == user_id)

    def get_admin_user_by_email(self, email: str) -> AdminUserRecord | None:
        return self._get_admin_user(admin_users.c.email == email.lower())

    def list_pending_admin_users(self) -> list[AdminUserRecord]:
        with self._engine.begin() as conn:
            rows = conn.execute(
                select(admin_users).where(admin_users.c.status == "pending")
            ).mappings()
            return [AdminUserRecord.model_validate(dict(row)) for row in rows]

    def approve_admin_user(
        self, user_id: str, role: str, approved_at: datetime
    ) -> AdminUserRecord | None:
        with self._engine.begin() as conn:
            conn.execute(
                update(admin_users)
                .where(admin_users.c.id == user_id)
                .values(role=role, status="active", approved_at=approved_at)
            )
        return self.get_admin_user(user_id)

    def create_assessment(self, assessment: Assessment) -> Assessment:
        with self._engine.begin() as conn:
            conn.execute(insert(assessments).values(**assessment.model_dump()))
        return assessment

    def get_assessment(self, assessment_id: str) -> Assessment | None:
        with self._engine.begin() as conn:
            row = conn.execute(
                select(assessments).where(assessments.c.id == assessment_id)
            ).mappings().first()
            return Assessment.model_validate(dict(row)) if row else None

    def list_assessments(self) -> list[Assessment]:
        with self._engine.begin() as conn:
            rows = conn.execute(select(assessments)).mappings()
            return [Assessment.model_validate(dict(row)) for row in rows]

    def create_problem(self, problem: Problem) -> Problem:
        with self._engine.begin() as conn:
            conn.execute(
                insert(problems).values(
                    id=problem.id,
                    payload=problem.model_dump(mode="json"),
                )
            )
        return problem

    def get_problem(self, problem_id: str) -> Problem | None:
        return self._get_payload(problems, problem_id, Problem)

    def list_problems(self, assessment_id: str | None = None) -> list[Problem]:
        with self._engine.begin() as conn:
            rows = conn.execute(select(problems.c.payload)).scalars()
            items = [Problem.model_validate(row) for row in rows]
        if assessment_id is not None:
            items = [item for item in items if item.assessment_id == assessment_id]
        return items

    def create_session(
        self, session: Session, initial_risk: RiskAssessment
    ) -> Session:
        with self._engine.begin() as conn:
            self._insert_session(conn, session)
            conn.execute(
                insert(risk_assessments).values(
                    session_id=session.id,
                    payload=initial_risk.model_dump(mode="json"),
                    risk_score=round(initial_risk.risk_score),
                )
            )
        return session

    def get_session(self, session_id: str) -> Session | None:
        return self._get_payload(sessions, session_id, Session)

    def append_event_batch(self, batch: EventBatch) -> int:
        with self._engine.begin() as conn:
            row = conn.execute(
                select(next_sequences.c.next_sequence)
                .where(next_sequences.c.session_id == batch.session_id)
                .with_for_update()
            ).first()
            expected = row[0] if row else 0
            if batch.sequence_start != expected:
                raise SequenceConflictError(expected, batch.sequence_start)
            conn.execute(
                insert(event_batches).values(
                    id=batch.id,
                    session_id=batch.session_id,
                    sequence_start=batch.sequence_start,
                    payload=batch.model_dump(mode="json"),
                )
            )
            next_sequence = expected + len(batch.events)
            conn.execute(
                update(next_sequences)
                .where(next_sequences.c.session_id == batch.session_id)
                .values(next_sequence=next_sequence)
            )
            return next_sequence

    def append_submission(self, submission: Submission) -> Submission:
        with self._engine.begin() as conn:
            conn.execute(
                insert(submissions).values(
                    id=submission.id,
                    session_id=submission.session_id,
                    payload=submission.model_dump(mode="json"),
                )
            )
        return submission

    def update_submission_status(
        self, session_id: str, submission_id: str, status: str
    ) -> Submission | None:
        submissions_for_session = self.list_submissions(session_id)
        target = next(
            (item for item in submissions_for_session if item.id == submission_id),
            None,
        )
        if target is None:
            return None
        updated = target.model_copy(update={"status": status})
        with self._engine.begin() as conn:
            conn.execute(
                update(submissions)
                .where(submissions.c.id == submission_id)
                .values(payload=updated.model_dump(mode="json"))
            )
        return updated

    def list_submissions(self, session_id: str) -> list[Submission]:
        with self._engine.begin() as conn:
            rows = conn.execute(
                select(submissions.c.payload).where(
                    submissions.c.session_id == session_id
                )
            ).scalars()
            return [Submission.model_validate(row) for row in rows]

    def save_judge_result(self, result: JudgeResult) -> JudgeResult:
        with self._engine.begin() as conn:
            existing = conn.execute(
                select(judge_results.c.submission_id).where(
                    judge_results.c.submission_id == result.submission_id
                )
            ).first()
            if existing:
                conn.execute(
                    update(judge_results)
                    .where(judge_results.c.submission_id == result.submission_id)
                    .values(payload=result.model_dump(mode="json"))
                )
            else:
                conn.execute(
                    insert(judge_results).values(
                        submission_id=result.submission_id,
                        payload=result.model_dump(mode="json"),
                    )
                )
        return result

    def get_judge_result(self, submission_id: str) -> JudgeResult | None:
        with self._engine.begin() as conn:
            payload = conn.execute(
                select(judge_results.c.payload)
                .where(judge_results.c.submission_id == submission_id)
            ).scalar_one_or_none()
            return JudgeResult.model_validate(payload) if payload else None

    def get_risk_assessment(self, session_id: str) -> RiskAssessment | None:
        with self._engine.begin() as conn:
            payload = conn.execute(
                select(risk_assessments.c.payload)
                .where(risk_assessments.c.session_id == session_id)
            ).scalar_one_or_none()
            return RiskAssessment.model_validate(payload) if payload else None

    def save_risk_assessment(
        self, assessment: RiskAssessment
    ) -> RiskAssessment:
        existing = self.get_risk_assessment(assessment.session_id)
        if existing and existing.risk_score >= assessment.risk_score:
            return existing
        with self._engine.begin() as conn:
            conn.execute(
                delete(risk_assessments).where(
                    risk_assessments.c.session_id == assessment.session_id
                )
            )
            conn.execute(
                insert(risk_assessments).values(
                    session_id=assessment.session_id,
                    payload=assessment.model_dump(mode="json"),
                    risk_score=round(assessment.risk_score),
                )
            )
        return assessment

    def create_candidate_invite(
        self, invite: CandidateInvite
    ) -> CandidateInvite:
        with self._engine.begin() as conn:
            conn.execute(
                insert(candidate_invites).values(
                    id=invite.id,
                    token=invite.token,
                    payload=invite.model_dump(mode="json"),
                )
            )
        return invite

    def get_candidate_invite_by_token(
        self, token: str
    ) -> CandidateInvite | None:
        with self._engine.begin() as conn:
            payload = conn.execute(
                select(candidate_invites.c.payload)
                .where(candidate_invites.c.token == token)
            ).scalar_one_or_none()
            return CandidateInvite.model_validate(payload) if payload else None

    def mark_candidate_invite_used(
        self, token: str, used_at: datetime, session: Session
    ) -> CandidateInvite | None:
        with self._engine.begin() as conn:
            row = conn.execute(
                select(candidate_invites.c.id, candidate_invites.c.payload)
                .where(candidate_invites.c.token == token)
                .with_for_update()
            ).first()
            if row is None:
                return None
            invite = CandidateInvite.model_validate(row.payload)
            if invite.used_at is not None:
                return invite
            self._insert_session(conn, session)
            initial_risk = RiskAssessment(
                id=f"risk_{session.id}",
                session_id=session.id,
                risk_score=0,
                review_recommended=False,
                signals=[],
                model_version="unassessed",
            )
            conn.execute(
                insert(risk_assessments).values(
                    session_id=session.id,
                    payload=initial_risk.model_dump(mode="json"),
                    risk_score=0,
                )
            )
            updated = invite.model_copy(
                update={"used_at": used_at, "session_id": session.id}
            )
            conn.execute(
                update(candidate_invites)
                .where(candidate_invites.c.id == row.id)
                .values(payload=updated.model_dump(mode="json"))
            )
            return updated

    def list_candidate_invites(
        self, assessment_id: str
    ) -> list[CandidateInvite]:
        with self._engine.begin() as conn:
            payloads = (
                conn.execute(
                    select(candidate_invites.c.payload).where(
                        candidate_invites.c.payload["assessment_id"].astext
                        == assessment_id
                    )
                )
                .scalars()
                .all()
            )
        invites = [CandidateInvite.model_validate(p) for p in payloads]
        invites.sort(key=lambda item: item.created_at)
        return invites

    def _get_admin_user(self, where_clause) -> AdminUserRecord | None:
        with self._engine.begin() as conn:
            row = conn.execute(select(admin_users).where(where_clause)).mappings().first()
            return AdminUserRecord.model_validate(dict(row)) if row else None

    def _get_payload(self, table: Table, item_id: str, model):
        with self._engine.begin() as conn:
            payload = conn.execute(
                select(table.c.payload).where(table.c.id == item_id)
            ).scalar_one_or_none()
            return model.model_validate(payload) if payload else None

    def _insert_session(self, conn, session: Session) -> None:
        conn.execute(
            insert(sessions).values(
                id=session.id,
                payload=session.model_dump(mode="json"),
            )
        )
        conn.execute(
            insert(next_sequences).values(session_id=session.id, next_sequence=0)
        )
