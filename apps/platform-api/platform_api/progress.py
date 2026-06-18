"""세션별 문제 해금 진행도 계산.

응시자가 현재 문제를 일정 통과율 이상으로 풀어야 다음 문제가 해금된다.
통과율은 Judge 채점 결과(passed_count/total_count)에서 가져온다.
"""
from __future__ import annotations

from .models import Problem, ProblemProgressStatus, Session
from .repositories import PlatformRepository


def compute_problem_status(
    repository: PlatformRepository,
    session: Session,
    problems: list[Problem],
) -> dict[str, ProblemProgressStatus]:
    """문제 id → 상태(locked/unlocked/solved) 매핑을 반환한다.

    - solved:   해당 문제의 최고 통과율 >= pass_threshold
    - unlocked: 첫 문제이거나 직전(order_index) 문제가 solved
    - locked:   그 외
    """
    best_ratio: dict[str, float] = {}
    for submission in repository.list_submissions(session.id):
        result = repository.get_judge_result(submission.id)
        if result is None or result.total_count <= 0:
            continue
        ratio = result.passed_count / result.total_count
        best_ratio[submission.problem_id] = max(
            best_ratio.get(submission.problem_id, 0.0), ratio
        )

    statuses: dict[str, ProblemProgressStatus] = {}
    previous_solved = True  # 첫 문제는 항상 해금
    for problem in sorted(problems, key=lambda item: item.order_index):
        solved = best_ratio.get(problem.id, 0.0) >= problem.pass_threshold
        if solved:
            statuses[problem.id] = "solved"
        elif previous_solved:
            statuses[problem.id] = "unlocked"
        else:
            statuses[problem.id] = "locked"
        previous_solved = solved
    return statuses
