from __future__ import annotations

from copy import deepcopy
from threading import RLock
from typing import Protocol

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


class SequenceConflictError(Exception):
    def __init__(self, expected: int, received: int) -> None:
        self.expected = expected
        self.received = received
        super().__init__(
            f"expected sequence_start {expected}, received {received}"
        )


class PlatformRepository(Protocol):
    def count_active_admin_users(self) -> int: ...

    def create_admin_user(self, user: AdminUserRecord) -> AdminUserRecord: ...

    def get_admin_user(self, user_id: str) -> AdminUserRecord | None: ...

    def get_admin_user_by_email(self, email: str) -> AdminUserRecord | None: ...

    def list_pending_admin_users(self) -> list[AdminUserRecord]: ...

    def approve_admin_user(
        self, user_id: str, role: str, approved_at
    ) -> AdminUserRecord | None: ...

    def create_assessment(self, assessment: Assessment) -> Assessment: ...

    def get_assessment(self, assessment_id: str) -> Assessment | None: ...

    def list_assessments(self) -> list[Assessment]: ...

    def create_problem(self, problem: Problem) -> Problem: ...

    def update_problem(self, problem: Problem) -> Problem: ...

    def get_problem(self, problem_id: str) -> Problem | None: ...

    def list_problems(self, assessment_id: str | None = None) -> list[Problem]: ...

    def create_session(
        self, session: Session, initial_risk: RiskAssessment
    ) -> Session: ...

    def get_session(self, session_id: str) -> Session | None: ...

    def finish_session(
        self, session_id: str, finished_at
    ) -> Session | None: ...

    def append_event_batch(self, batch: EventBatch) -> int: ...

    def append_submission(self, submission: Submission) -> Submission: ...

    def update_submission_status(
        self, session_id: str, submission_id: str, status: str
    ) -> Submission | None: ...

    def list_submissions(self, session_id: str) -> list[Submission]: ...

    def save_judge_result(self, result: JudgeResult) -> JudgeResult: ...

    def get_judge_result(self, submission_id: str) -> JudgeResult | None: ...

    def get_risk_assessment(self, session_id: str) -> RiskAssessment | None: ...

    def save_risk_assessment(
        self, assessment: RiskAssessment
    ) -> RiskAssessment: ...

    def create_candidate_invite(
        self, invite: CandidateInvite
    ) -> CandidateInvite: ...

    def get_candidate_invite_by_token(
        self, token: str
    ) -> CandidateInvite | None: ...

    def mark_candidate_invite_used(
        self, token: str, used_at, session: Session
    ) -> CandidateInvite | None: ...

    def list_candidate_invites(
        self, assessment_id: str
    ) -> list[CandidateInvite]: ...


class InMemoryPlatformRepository:
    """Thread-safe MVP repository matching the eventual PostgreSQL entities."""

    def __init__(self) -> None:
        self._assessments: dict[str, Assessment] = {}
        self._admin_users: dict[str, AdminUserRecord] = {}
        self._admin_users_by_email: dict[str, str] = {}
        self._problems: dict[str, Problem] = {}
        self._sessions: dict[str, Session] = {}
        self._candidate_invites: dict[str, CandidateInvite] = {}
        self._candidate_invites_by_token: dict[str, str] = {}
        self._event_batches: dict[str, list[EventBatch]] = {}
        self._next_sequences: dict[str, int] = {}
        self._submissions: dict[str, list[Submission]] = {}
        self._judge_results: dict[str, JudgeResult] = {}
        self._risks: dict[str, RiskAssessment] = {}
        self._lock = RLock()

    def count_active_admin_users(self) -> int:
        with self._lock:
            return sum(
                1
                for user in self._admin_users.values()
                if user.status == "active" and user.role == "admin"
            )

    def create_admin_user(self, user: AdminUserRecord) -> AdminUserRecord:
        with self._lock:
            email_key = user.email.lower()
            if email_key in self._admin_users_by_email:
                raise ValueError("email already registered")
            self._admin_users[user.id] = deepcopy(user)
            self._admin_users_by_email[email_key] = user.id
            return deepcopy(user)

    def get_admin_user(self, user_id: str) -> AdminUserRecord | None:
        with self._lock:
            user = self._admin_users.get(user_id)
            return deepcopy(user) if user else None

    def get_admin_user_by_email(self, email: str) -> AdminUserRecord | None:
        with self._lock:
            user_id = self._admin_users_by_email.get(email.lower())
            if user_id is None:
                return None
            return deepcopy(self._admin_users[user_id])

    def list_pending_admin_users(self) -> list[AdminUserRecord]:
        with self._lock:
            return [
                deepcopy(user)
                for user in self._admin_users.values()
                if user.status == "pending"
            ]

    def approve_admin_user(
        self, user_id: str, role: str, approved_at
    ) -> AdminUserRecord | None:
        with self._lock:
            user = self._admin_users.get(user_id)
            if user is None:
                return None
            updated = user.model_copy(
                update={
                    "role": role,
                    "status": "active",
                    "approved_at": approved_at,
                }
            )
            self._admin_users[user_id] = updated
            return deepcopy(updated)

    def create_assessment(self, assessment: Assessment) -> Assessment:
        with self._lock:
            self._assessments[assessment.id] = deepcopy(assessment)
            return deepcopy(assessment)

    def get_assessment(self, assessment_id: str) -> Assessment | None:
        with self._lock:
            assessment = self._assessments.get(assessment_id)
            return deepcopy(assessment) if assessment else None

    def list_assessments(self) -> list[Assessment]:
        with self._lock:
            return [deepcopy(item) for item in self._assessments.values()]

    def create_problem(self, problem: Problem) -> Problem:
        with self._lock:
            self._problems[problem.id] = deepcopy(problem)
            return deepcopy(problem)

    def update_problem(self, problem: Problem) -> Problem:
        with self._lock:
            self._problems[problem.id] = deepcopy(problem)
            return deepcopy(problem)

    def get_problem(self, problem_id: str) -> Problem | None:
        with self._lock:
            problem = self._problems.get(problem_id)
            return deepcopy(problem) if problem else None

    def list_problems(self, assessment_id: str | None = None) -> list[Problem]:
        with self._lock:
            problems = self._problems.values()
            if assessment_id is not None:
                problems = (
                    problem
                    for problem in problems
                    if problem.assessment_id == assessment_id
                )
            return [deepcopy(item) for item in problems]

    def create_session(
        self, session: Session, initial_risk: RiskAssessment
    ) -> Session:
        with self._lock:
            self._sessions[session.id] = deepcopy(session)
            self._event_batches[session.id] = []
            self._next_sequences[session.id] = 0
            self._submissions[session.id] = []
            self._risks[session.id] = deepcopy(initial_risk)
            return deepcopy(session)

    def get_session(self, session_id: str) -> Session | None:
        with self._lock:
            session = self._sessions.get(session_id)
            return deepcopy(session) if session else None

    def finish_session(
        self, session_id: str, finished_at
    ) -> Session | None:
        with self._lock:
            session = self._sessions.get(session_id)
            if session is None:
                return None
            if session.status != "finished":
                session = session.model_copy(
                    update={"status": "finished", "finished_at": finished_at}
                )
                self._sessions[session_id] = session
            return deepcopy(session)

    def append_event_batch(self, batch: EventBatch) -> int:
        with self._lock:
            expected = self._next_sequences[batch.session_id]
            if batch.sequence_start != expected:
                raise SequenceConflictError(expected, batch.sequence_start)

            self._event_batches[batch.session_id].append(deepcopy(batch))
            next_sequence = expected + len(batch.events)
            self._next_sequences[batch.session_id] = next_sequence
            return next_sequence

    def append_submission(self, submission: Submission) -> Submission:
        with self._lock:
            self._submissions[submission.session_id].append(deepcopy(submission))
            return deepcopy(submission)

    def update_submission_status(
        self, session_id: str, submission_id: str, status: str
    ) -> Submission | None:
        with self._lock:
            submissions = self._submissions.get(session_id, [])
            for index, submission in enumerate(submissions):
                if submission.id == submission_id:
                    updated = submission.model_copy(update={"status": status})
                    submissions[index] = updated
                    return deepcopy(updated)
            return None

    def list_submissions(self, session_id: str) -> list[Submission]:
        with self._lock:
            return [deepcopy(item) for item in self._submissions.get(session_id, [])]

    def save_judge_result(self, result: JudgeResult) -> JudgeResult:
        with self._lock:
            self._judge_results[result.submission_id] = deepcopy(result)
            return deepcopy(result)

    def get_judge_result(self, submission_id: str) -> JudgeResult | None:
        with self._lock:
            result = self._judge_results.get(submission_id)
            return deepcopy(result) if result else None

    def get_risk_assessment(self, session_id: str) -> RiskAssessment | None:
        with self._lock:
            assessment = self._risks.get(session_id)
            return deepcopy(assessment) if assessment else None

    def save_risk_assessment(
        self, assessment: RiskAssessment
    ) -> RiskAssessment:
        with self._lock:
            existing = self._risks.get(assessment.session_id)
            if existing and existing.risk_score >= assessment.risk_score:
                return deepcopy(existing)
            self._risks[assessment.session_id] = deepcopy(assessment)
            return deepcopy(assessment)

    def create_candidate_invite(
        self, invite: CandidateInvite
    ) -> CandidateInvite:
        with self._lock:
            self._candidate_invites[invite.id] = deepcopy(invite)
            self._candidate_invites_by_token[invite.token] = invite.id
            return deepcopy(invite)

    def get_candidate_invite_by_token(
        self, token: str
    ) -> CandidateInvite | None:
        with self._lock:
            invite_id = self._candidate_invites_by_token.get(token)
            if invite_id is None:
                return None
            invite = self._candidate_invites.get(invite_id)
            return deepcopy(invite) if invite else None

    def mark_candidate_invite_used(
        self, token: str, used_at, session: Session
    ) -> CandidateInvite | None:
        with self._lock:
            invite_id = self._candidate_invites_by_token.get(token)
            if invite_id is None:
                return None
            invite = self._candidate_invites[invite_id]
            if invite.used_at is not None:
                return deepcopy(invite)

            self._sessions[session.id] = deepcopy(session)
            self._event_batches[session.id] = []
            self._next_sequences[session.id] = 0
            self._submissions[session.id] = []
            self._risks[session.id] = RiskAssessment(
                id=f"risk_{session.id}",
                session_id=session.id,
                risk_score=0,
                review_recommended=False,
                signals=[],
                model_version="unassessed",
            )
            updated = invite.model_copy(
                update={"used_at": used_at, "session_id": session.id}
            )
            self._candidate_invites[invite_id] = updated
            return deepcopy(updated)

    def list_candidate_invites(
        self, assessment_id: str
    ) -> list[CandidateInvite]:
        with self._lock:
            invites = [
                deepcopy(invite)
                for invite in self._candidate_invites.values()
                if invite.assessment_id == assessment_id
            ]
            invites.sort(key=lambda item: item.created_at)
            return invites
