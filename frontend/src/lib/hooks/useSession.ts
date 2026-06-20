"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { DEFAULT_STARTERS, INITIAL_CODE, PLATFORM_API_URL } from "../constants";
import type {
  CandidateProblem,
  CandidateProblemSummary,
  SessionInfo,
  SupportedLanguage,
} from "../types";

/** (문제 id, 언어) 조합을 작성 코드 저장 키로 만든다. */
const keyOf = (problemId: string, language: SupportedLanguage) =>
  `${problemId}::${language}`;

/**
 * 세션 정보 + 문제 목록(해금 상태) + 현재 문제 상세를 관리한다.
 *
 * - 문제 목록은 요약(상태)만 받고, 잠긴 문제는 내용이 없다.
 * - 현재 문제는 별도 상세 엔드포인트로 로드한다(잠겼으면 423).
 * - refreshProblems()로 제출 후 해금 상태를 갱신한다.
 */
export function useSession(
  sessionId: string,
  addAlert: (message: string) => void,
) {
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [problems, setProblems] = useState<CandidateProblemSummary[]>([]);
  const [currentProblemId, setCurrentProblemId] = useState("");
  const [problem, setProblem] = useState<CandidateProblem | null>(null);
  const [selectedLanguage, setSelectedLanguage] =
    useState<SupportedLanguage>("python");
  const [code, setCodeState] = useState(INITIAL_CODE);

  // (문제, 언어)별 작성 코드와 문제별 마지막 선택 언어를 세션 동안 기억한다.
  const codeByKeyRef = useRef<Record<string, string>>({});
  const languageByProblemRef = useRef<Record<string, SupportedLanguage>>({});

  // 편집할 때마다 현재 (문제, 언어) 키에 코드를 저장하면서 상태를 갱신한다.
  const setCode = useCallback(
    (value: string) => {
      setCodeState(value);
      if (currentProblemId) {
        codeByKeyRef.current[keyOf(currentProblemId, selectedLanguage)] = value;
      }
    },
    [currentProblemId, selectedLanguage],
  );

  const loadProblems = useCallback(
    async (signal?: AbortSignal): Promise<CandidateProblemSummary[]> => {
      const response = await fetch(
        `${PLATFORM_API_URL}/sessions/${encodeURIComponent(sessionId)}/problems`,
        { signal },
      );
      if (!response.ok) {
        throw new Error("문제 목록을 불러올 수 없습니다.");
      }
      return (await response.json()) as CandidateProblemSummary[];
    },
    [sessionId],
  );

  // 세션 정보 + 문제 목록 로드, 첫 해금 문제를 현재 문제로 선택
  useEffect(() => {
    if (!sessionId) return;

    const controller = new AbortController();
    async function load() {
      try {
        const sessionResponse = await fetch(
          `${PLATFORM_API_URL}/sessions/${encodeURIComponent(sessionId)}`,
          { signal: controller.signal },
        );
        if (!sessionResponse.ok) {
          throw new Error("세션 정보를 불러올 수 없습니다.");
        }
        setSessionInfo((await sessionResponse.json()) as SessionInfo);

        const list = await loadProblems(controller.signal);
        setProblems(list);
        const firstOpen =
          list.find((item) => item.status === "unlocked") ??
          list.find((item) => item.status !== "locked") ??
          list[0];
        if (firstOpen) {
          setCurrentProblemId(firstOpen.id);
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        addAlert(
          error instanceof Error
            ? error.message
            : "세션 정보를 불러올 수 없습니다.",
        );
      }
    }
    void load();
    return () => controller.abort();
  }, [addAlert, loadProblems, sessionId]);

  // 현재 문제 상세 로드
  useEffect(() => {
    if (!sessionId || !currentProblemId) return;

    const controller = new AbortController();
    async function loadDetail() {
      try {
        const response = await fetch(
          `${PLATFORM_API_URL}/sessions/${encodeURIComponent(sessionId)}/problems/${encodeURIComponent(currentProblemId)}`,
          { signal: controller.signal },
        );
        if (response.status === 423) {
          addAlert("아직 잠긴 문제입니다. 이전 문제를 먼저 푸세요.");
          return;
        }
        if (!response.ok) {
          throw new Error("문제를 불러올 수 없습니다.");
        }
        const detail = (await response.json()) as CandidateProblem;
        setProblem(detail);
        // 이 문제에서 마지막에 쓰던 언어를 복원(없으면 기본 언어)
        const language =
          languageByProblemRef.current[currentProblemId] ??
          detail.allowed_languages[0] ??
          "python";
        setSelectedLanguage(language);
        // 작성하던 코드가 있으면 그대로 복원, 없으면 starter
        const saved = codeByKeyRef.current[keyOf(currentProblemId, language)];
        setCodeState(
          saved ?? detail.starter_code[language] ?? DEFAULT_STARTERS[language],
        );
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        addAlert(
          error instanceof Error ? error.message : "문제를 불러올 수 없습니다.",
        );
      }
    }
    void loadDetail();
    return () => controller.abort();
  }, [addAlert, currentProblemId, sessionId]);

  const selectProblem = useCallback((problemId: string) => {
    setCurrentProblemId(problemId);
  }, []);

  const refreshProblems = useCallback(async (): Promise<
    CandidateProblemSummary[]
  > => {
    try {
      const list = await loadProblems();
      setProblems(list);
      return list;
    } catch {
      return [];
    }
  }, [loadProblems]);

  const selectLanguage = useCallback(
    (language: SupportedLanguage) => {
      if (currentProblemId) {
        // 현재 언어의 코드를 저장하고, 새 언어를 이 문제의 선택으로 기록
        codeByKeyRef.current[keyOf(currentProblemId, selectedLanguage)] = code;
        languageByProblemRef.current[currentProblemId] = language;
      }
      setSelectedLanguage(language);
      const saved = currentProblemId
        ? codeByKeyRef.current[keyOf(currentProblemId, language)]
        : undefined;
      setCodeState(
        saved ?? problem?.starter_code[language] ?? DEFAULT_STARTERS[language],
      );
    },
    [code, currentProblemId, problem, selectedLanguage],
  );

  return {
    sessionInfo,
    problems,
    currentProblemId,
    selectProblem,
    problem,
    selectedLanguage,
    code,
    setCode,
    selectLanguage,
    refreshProblems,
  };
}
