from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
EVENT_CLIENT = ROOT / "frontend" / "src" / "lib" / "session-event-client.ts"


def test_sequence_conflict_keeps_unacknowledged_events_queued() -> None:
    source = EVENT_CLIENT.read_text()
    success_branch_start = source.index("if (response.ok)")
    conflict_branch_start = source.index("if (response.status === 409)")
    next_error_start = source.index(
        'throw new Error(`Platform API가 HTTP ${response.status}로 응답했습니다.`)'
    )

    success_branch = source[success_branch_start:conflict_branch_start]
    conflict_branch = source[conflict_branch_start:next_error_start]

    assert "this.acceptBatch(events, accepted.next_sequence)" in success_branch
    assert "this.acceptBatch(" not in conflict_branch
    assert "throw new Error(" in conflict_branch
