from app.domain import SessionEvent
from app.preprocessing import deduplicate_and_sort, extract_key_timings


def event(event_id: str, event_type: str, timestamp: int, **fields) -> SessionEvent:
    return SessionEvent(
        id=event_id,
        type=event_type,
        timestamp=timestamp,
        editor_revision=1,
        **fields,
    )


def test_extracts_hold_times_and_inter_key_gaps() -> None:
    events = [
        event("up-a", "keyup", 180, key="a", code="KeyA"),
        event("down-a", "keydown", 100, key="a", code="KeyA"),
        event("down-b", "keydown", 220, key="b", code="KeyB"),
        event("up-b", "keyup", 280, key="b", code="KeyB"),
    ]
    ordered, _ = deduplicate_and_sort(events)

    result = extract_key_timings(ordered)

    assert result.hold_times_ms == [80, 60]
    assert result.inter_key_gaps_ms == [120]
    assert result.unmatched_keydown_count == 0
    assert result.unmatched_keyup_count == 0


def test_reports_unmatched_repeated_and_duplicate_events() -> None:
    duplicate = event("same", "keydown", 100, key="a", code="KeyA")
    events = [
        duplicate,
        event("same", "keydown", 110, key="a", code="KeyA"),
        event("repeat", "keydown", 120, key="a", code="KeyA"),
        event("orphan-up", "keyup", 130, key="x", code="KeyX"),
    ]

    ordered, duplicate_count = deduplicate_and_sort(events)
    result = extract_key_timings(ordered)

    assert duplicate_count == 1
    assert result.repeated_keydown_count == 1
    assert result.unmatched_keydown_count == 1
    assert result.unmatched_keyup_count == 1
