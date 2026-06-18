from app.domain import EventBatch, SessionEvent
from app.rules import REVIEW_THRESHOLD, SIGNAL_WEIGHTS, assess_batch


def batch(events: list[dict], sent_at: int = 100_000) -> EventBatch:
    return EventBatch(
        schema_version="1.0",
        session_id="ses_test",
        sequence_start=0,
        sent_at=sent_at,
        events=[SessionEvent(**event) for event in events],
    )


def common(event_id: str, event_type: str, timestamp: int, **fields) -> dict:
    return {
        "id": event_id,
        "type": event_type,
        "timestamp": timestamp,
        "editor_revision": 1,
        **fields,
    }


def signal_map(result):
    return {signal.code: signal for signal in result.signals}


def test_benign_session_has_zero_risk() -> None:
    events = []
    timestamp = 1_000
    for index in range(12):
        events.extend(
            [
                common(
                    f"down-{index}",
                    "keydown",
                    timestamp,
                    key="a",
                    code="KeyA",
                ),
                common(
                    f"up-{index}",
                    "keyup",
                    timestamp + 60,
                    key="a",
                    code="KeyA",
                ),
                common(
                    f"change-{index}",
                    "code_change",
                    timestamp + 70,
                    inserted_character_count=1,
                    deleted_character_count=0,
                ),
            ]
        )
        timestamp += 100 + (index * 17)

    result = assess_batch(batch(events))

    assert result.risk_score == 0
    assert result.review_recommended is False
    assert all(signal.score == 0 for signal in result.signals)


def test_paste_spike_and_code_burst_are_explained() -> None:
    events = [
        common(
            "paste",
            "paste",
            1_000,
            inserted_character_count=400,
            cursor_offset=0,
        ),
        common(
            "burst",
            "code_change",
            1_010,
            inserted_character_count=500,
            deleted_character_count=0,
            cursor_offset=500,
        ),
    ]

    result = assess_batch(batch(events))
    signals = signal_map(result)

    assert signals["paste_spike"].score == 100
    assert signals["code_burst"].score == 100
    assert signals["paste_spike"].evidence["maximum_inserted_characters"] == 400
    assert signals["code_burst"].evidence["maximum_single_insertion"] == 500
    assert result.risk_score == 60
    assert result.review_recommended is True


def test_regular_typing_is_flagged_after_minimum_sample_count() -> None:
    events = []
    for index in range(21):
        timestamp = 1_000 + index * 100
        events.extend(
            [
                common(
                    f"down-{index}",
                    "keydown",
                    timestamp,
                    key=str(index),
                    code=f"Key{index}",
                ),
                common(
                    f"up-{index}",
                    "keyup",
                    timestamp + 50,
                    key=str(index),
                    code=f"Key{index}",
                ),
            ]
        )

    result = assess_batch(batch(events))
    typing = signal_map(result)["typing_regularity"]

    assert typing.score == 100
    assert typing.evidence["paired_hold_count"] == 21
    assert typing.evidence["usable_inter_key_gap_count"] == 20
    assert typing.evidence["mean_hold_ms"] == 50


def test_focus_loss_uses_count_and_duration() -> None:
    events = [
        common("blur-1", "focus_change", 1_000, focused=False),
        common("focus-1", "focus_change", 61_000, focused=True),
        common("blur-2", "focus_change", 62_000, focused=False),
        common("focus-2", "focus_change", 122_000, focused=True),
        common("blur-3", "focus_change", 123_000, focused=False),
        common("focus-3", "focus_change", 183_000, focused=True),
    ]

    result = assess_batch(batch(events, sent_at=183_000))
    focus = signal_map(result)["focus_loss"]

    assert focus.score == 100
    assert focus.evidence["focus_loss_count"] == 3
    assert focus.evidence["total_focus_loss_ms"] == 180_000


def test_threshold_reaching_events_start_with_nonzero_signal_score() -> None:
    events = [
        common("paste", "paste", 1_000, inserted_character_count=40),
        common(
            "change",
            "code_change",
            2_000,
            inserted_character_count=80,
            deleted_character_count=0,
        ),
        common("blur-1", "focus_change", 3_000, focused=False),
        common("focus-1", "focus_change", 3_100, focused=True),
        common("blur-2", "focus_change", 4_000, focused=False),
        common("focus-2", "focus_change", 4_100, focused=True),
        common("blur-3", "focus_change", 5_000, focused=False),
        common("focus-3", "focus_change", 5_100, focused=True),
    ]

    signals = signal_map(assess_batch(batch(events)))

    assert signals["paste_spike"].score == 25
    assert signals["code_burst"].score == 25
    assert signals["focus_loss"].score == 25


def test_risk_score_is_weighted_and_review_threshold_is_explicit() -> None:
    assert sum(SIGNAL_WEIGHTS.values()) == 1
    assert REVIEW_THRESHOLD == 50
