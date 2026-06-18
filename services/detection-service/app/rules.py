from dataclasses import asdict
from typing import Any

from .domain import EventBatch, RiskAssessment, RiskSignal, SessionEvent
from .preprocessing import (
    KeyTimingFeatures,
    deduplicate_and_sort,
    extract_key_timings,
    mean,
    most_common_bucket_ratio,
    population_stddev,
)


SIGNAL_WEIGHTS = {
    "paste_spike": 0.30,
    "code_burst": 0.30,
    "typing_regularity": 0.25,
    "focus_loss": 0.15,
}
REVIEW_THRESHOLD = 50.0


def _score(value: float) -> float:
    return round(max(0.0, min(100.0, value)), 2)


def _threshold_score(value: float, threshold: float, ceiling: float) -> float:
    if value < threshold:
        return 0.0
    if ceiling <= threshold:
        return 100.0
    return _score(25 + (value - threshold) / (ceiling - threshold) * 75)


def _signal(code: str, score: float, evidence: dict[str, Any]) -> RiskSignal:
    return RiskSignal(
        code=code,
        score=_score(score),
        evidence={
            "weight": SIGNAL_WEIGHTS[code],
            **evidence,
        },
    )


def assess_paste_spike(events: list[SessionEvent]) -> RiskSignal:
    paste_counts = [
        event.inserted_character_count or 0 for event in events if event.type == "paste"
    ]
    suspicious_counts = [count for count in paste_counts if count >= 40]
    total_suspicious = sum(suspicious_counts)
    maximum = max(paste_counts, default=0)
    score = max(
        _threshold_score(maximum, threshold=40, ceiling=200),
        _threshold_score(total_suspicious, threshold=80, ceiling=400),
        _threshold_score(len(suspicious_counts), threshold=2, ceiling=5),
    )
    return _signal(
        "paste_spike",
        score,
        {
            "paste_event_count": len(paste_counts),
            "suspicious_paste_count": len(suspicious_counts),
            "total_suspicious_inserted_characters": total_suspicious,
            "maximum_inserted_characters": maximum,
            "thresholds": {
                "suspicious_paste_characters": 40,
                "total_characters": 80,
                "event_count": 2,
            },
        },
    )


def _max_insertions_in_window(
    events: list[SessionEvent], window_ms: int
) -> tuple[int, int | None]:
    changes = [
        event
        for event in events
        if event.type == "code_change" and (event.inserted_character_count or 0) > 0
    ]
    maximum = 0
    maximum_start: int | None = None
    left = 0
    running_total = 0

    for right, event in enumerate(changes):
        running_total += event.inserted_character_count or 0
        while event.timestamp - changes[left].timestamp > window_ms:
            running_total -= changes[left].inserted_character_count or 0
            left += 1
        if running_total > maximum:
            maximum = running_total
            maximum_start = changes[left].timestamp

    return maximum, maximum_start


def assess_code_burst(events: list[SessionEvent]) -> RiskSignal:
    insertions = [
        event.inserted_character_count or 0
        for event in events
        if event.type == "code_change"
    ]
    maximum_single = max(insertions, default=0)
    maximum_window, window_start = _max_insertions_in_window(events, window_ms=2_000)
    score = max(
        _threshold_score(maximum_single, threshold=80, ceiling=300),
        _threshold_score(maximum_window, threshold=160, ceiling=500),
    )
    return _signal(
        "code_burst",
        score,
        {
            "code_change_count": len(insertions),
            "maximum_single_insertion": maximum_single,
            "maximum_inserted_in_2000ms": maximum_window,
            "maximum_window_started_at": window_start,
            "thresholds": {
                "single_insertion_characters": 80,
                "window_ms": 2_000,
                "window_insertion_characters": 160,
            },
        },
    )


def assess_typing_regularity(features: KeyTimingFeatures) -> RiskSignal:
    usable_gaps = [gap for gap in features.inter_key_gaps_ms if 20 <= gap <= 2_000]
    average_gap = mean(usable_gaps)
    stddev_gap = population_stddev(usable_gaps)
    coefficient_of_variation = stddev_gap / average_gap if average_gap else 0.0
    common_bucket_ratio = most_common_bucket_ratio(usable_gaps)

    score = 0.0
    if len(usable_gaps) >= 20:
        cv_score = (
            _score((0.22 - coefficient_of_variation) / (0.22 - 0.05) * 100)
            if coefficient_of_variation < 0.22
            else 0.0
        )
        bucket_score = _threshold_score(common_bucket_ratio, threshold=0.35, ceiling=0.8)
        score = max(cv_score, bucket_score)

    timing_summary = asdict(features)
    timing_summary.pop("hold_times_ms")
    timing_summary.pop("inter_key_gaps_ms")
    return _signal(
        "typing_regularity",
        score,
        {
            **timing_summary,
            "paired_hold_count": len(features.hold_times_ms),
            "mean_hold_ms": round(mean(features.hold_times_ms), 2),
            "usable_inter_key_gap_count": len(usable_gaps),
            "mean_inter_key_gap_ms": round(average_gap, 2),
            "inter_key_gap_stddev_ms": round(stddev_gap, 2),
            "inter_key_gap_coefficient_of_variation": round(
                coefficient_of_variation, 4
            ),
            "most_common_10ms_bucket_ratio": round(common_bucket_ratio, 4),
            "thresholds": {
                "minimum_gap_samples": 20,
                "usable_gap_ms": [20, 2_000],
                "suspicious_coefficient_of_variation_below": 0.22,
                "suspicious_common_bucket_ratio": 0.35,
            },
        },
    )


def assess_focus_loss(events: list[SessionEvent], sent_at: int) -> RiskSignal:
    focus_events = [event for event in events if event.type == "focus_change"]
    focused = True
    loss_started_at: int | None = None
    durations: list[int] = []
    loss_count = 0

    for event in focus_events:
        if event.focused is False and focused:
            focused = False
            loss_started_at = event.timestamp
            loss_count += 1
        elif event.focused is True and not focused:
            focused = True
            if loss_started_at is not None:
                durations.append(max(0, event.timestamp - loss_started_at))
            loss_started_at = None

    open_focus_loss = loss_started_at is not None
    if loss_started_at is not None:
        end_timestamp = max(sent_at, events[-1].timestamp if events else sent_at)
        durations.append(max(0, end_timestamp - loss_started_at))

    total_duration = sum(durations)
    score = max(
        _threshold_score(loss_count, threshold=3, ceiling=8),
        _threshold_score(total_duration, threshold=30_000, ceiling=180_000),
    )
    return _signal(
        "focus_loss",
        score,
        {
            "focus_loss_count": loss_count,
            "total_focus_loss_ms": total_duration,
            "maximum_focus_loss_ms": max(durations, default=0),
            "open_focus_loss": open_focus_loss,
            "thresholds": {
                "loss_count": 3,
                "total_focus_loss_ms": 30_000,
            },
        },
    )


def assess_batch(batch: EventBatch) -> RiskAssessment:
    events, duplicate_count = deduplicate_and_sort(batch.events)
    key_features = extract_key_timings(events)
    signals = [
        assess_paste_spike(events),
        assess_code_burst(events),
        assess_typing_regularity(key_features),
        assess_focus_loss(events, batch.sent_at),
    ]

    for signal in signals:
        signal.evidence["duplicate_event_count"] = duplicate_count

    risk_score = _score(
        sum(signal.score * SIGNAL_WEIGHTS[signal.code] for signal in signals)
    )
    return RiskAssessment(
        session_id=batch.session_id,
        risk_score=risk_score,
        review_recommended=risk_score >= REVIEW_THRESHOLD,
        signals=signals,
    )
