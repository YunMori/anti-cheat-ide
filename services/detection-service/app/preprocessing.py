from collections import Counter
from dataclasses import dataclass
from math import sqrt

from .domain import SessionEvent


@dataclass(frozen=True)
class KeyTimingFeatures:
    hold_times_ms: list[int]
    inter_key_gaps_ms: list[int]
    keydown_count: int
    keyup_count: int
    unmatched_keydown_count: int
    unmatched_keyup_count: int
    repeated_keydown_count: int


def deduplicate_and_sort(events: list[SessionEvent]) -> tuple[list[SessionEvent], int]:
    """Remove retried event IDs and order browser events deterministically."""
    seen_ids: set[str] = set()
    unique: list[tuple[int, SessionEvent]] = []
    duplicate_count = 0

    for index, event in enumerate(events):
        if event.id in seen_ids:
            duplicate_count += 1
            continue
        seen_ids.add(event.id)
        unique.append((index, event))

    unique.sort(key=lambda item: (item[1].timestamp, item[0]))
    return [event for _, event in unique], duplicate_count


def extract_key_timings(events: list[SessionEvent]) -> KeyTimingFeatures:
    """Pair keydown/keyup events and calculate hold and inter-key timings."""
    active_keys: dict[str, int] = {}
    hold_times: list[int] = []
    keydown_timestamps: list[int] = []
    keydown_count = 0
    keyup_count = 0
    unmatched_keyup_count = 0
    repeated_keydown_count = 0

    for event in events:
        if event.type not in {"keydown", "keyup"}:
            continue

        identity = event.code or event.key or ""
        if event.type == "keydown":
            keydown_count += 1
            if identity in active_keys:
                repeated_keydown_count += 1
                continue
            active_keys[identity] = event.timestamp
            keydown_timestamps.append(event.timestamp)
            continue

        keyup_count += 1
        started_at = active_keys.pop(identity, None)
        if started_at is None:
            unmatched_keyup_count += 1
            continue

        hold_time = event.timestamp - started_at
        if hold_time >= 0:
            hold_times.append(hold_time)

    inter_key_gaps = [
        current - previous
        for previous, current in zip(keydown_timestamps, keydown_timestamps[1:])
        if current >= previous
    ]

    return KeyTimingFeatures(
        hold_times_ms=hold_times,
        inter_key_gaps_ms=inter_key_gaps,
        keydown_count=keydown_count,
        keyup_count=keyup_count,
        unmatched_keydown_count=len(active_keys),
        unmatched_keyup_count=unmatched_keyup_count,
        repeated_keydown_count=repeated_keydown_count,
    )


def mean(values: list[int]) -> float:
    return sum(values) / len(values) if values else 0.0


def population_stddev(values: list[int]) -> float:
    if not values:
        return 0.0
    average = mean(values)
    return sqrt(sum((value - average) ** 2 for value in values) / len(values))


def most_common_bucket_ratio(values: list[int], bucket_size_ms: int = 10) -> float:
    if not values:
        return 0.0
    buckets = Counter(round(value / bucket_size_ms) * bucket_size_ms for value in values)
    return max(buckets.values()) / len(values)
