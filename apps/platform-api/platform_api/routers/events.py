"""세션 행동 이벤트 배치 수집.

이벤트는 먼저 영속화한 뒤 Detection Service에 위험 평가를 요청한다.
Detection 실패가 수집을 막지 않도록 예외는 흡수한다(아키텍처 규칙).
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request, status
import httpx

from ..dependencies import RepositoryDependency, new_id, require_session
from ..models import (
    EventBatch,
    EventBatchAccepted,
    EventBatchCreate,
    utc_now,
)
from ..repositories import SequenceConflictError

router = APIRouter(tags=["events"])


@router.post(
    "/sessions/{session_id}/events",
    response_model=EventBatchAccepted,
    status_code=status.HTTP_202_ACCEPTED,
)
def ingest_session_events(
    session_id: str,
    payload: EventBatchCreate,
    repository: RepositoryDependency,
    request: Request,
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

    assessor = request.app.state.risk_assessor
    if assessor is not None:
        try:
            repository.save_risk_assessment(assessor.assess(payload))
        except (httpx.HTTPError, KeyError, TypeError, ValueError):
            # Detection Service가 죽어도 이벤트 수집은 계속 가능해야 한다.
            pass

    return EventBatchAccepted(
        batch_id=batch.id,
        accepted_events=len(batch.events),
        next_sequence=next_sequence,
    )
