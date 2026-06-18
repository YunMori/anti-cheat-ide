"use client";

import { useCallback, useEffect, useState } from "react";

import { DEFAULT_STARTERS, INITIAL_CODE, PLATFORM_API_URL } from "../constants";
import type {
  CandidateProblem,
  SessionInfo,
  SupportedLanguage,
} from "../types";

/**
 * session_id로 세션 정보와 첫 문제를 로드하고, 풀이 언어/코드 상태를 관리한다.
 */
export function useSession(
  sessionId: string,
  addAlert: (message: string) => void,
) {
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [problem, setProblem] = useState<CandidateProblem | null>(null);
  const [selectedLanguage, setSelectedLanguage] =
    useState<SupportedLanguage>("javascript");
  const [code, setCode] = useState(INITIAL_CODE);

  useEffect(() => {
    if (!sessionId) return;

    const controller = new AbortController();
    async function loadSession() {
      try {
        const [sessionResponse, problemResponse] = await Promise.all([
          fetch(`${PLATFORM_API_URL}/sessions/${encodeURIComponent(sessionId)}`, {
            signal: controller.signal,
          }),
          fetch(
            `${PLATFORM_API_URL}/sessions/${encodeURIComponent(sessionId)}/problems`,
            { signal: controller.signal },
          ),
        ]);
        if (!sessionResponse.ok || !problemResponse.ok) {
          throw new Error("세션 또는 문제 정보를 불러올 수 없습니다.");
        }
        const loadedSession = (await sessionResponse.json()) as SessionInfo;
        const loadedProblems =
          (await problemResponse.json()) as CandidateProblem[];
        setSessionInfo(loadedSession);
        if (loadedProblems[0]) {
          const loadedProblem = loadedProblems[0];
          const language = loadedProblem.allowed_languages[0];
          setProblem(loadedProblem);
          setSelectedLanguage(language);
          setCode(
            loadedProblem.starter_code[language] ?? DEFAULT_STARTERS[language],
          );
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
    void loadSession();
    return () => controller.abort();
  }, [addAlert, sessionId]);

  const selectLanguage = useCallback(
    (language: SupportedLanguage) => {
      setSelectedLanguage(language);
      setCode(problem?.starter_code[language] ?? DEFAULT_STARTERS[language]);
    },
    [problem],
  );

  return {
    sessionInfo,
    problem,
    selectedLanguage,
    code,
    setCode,
    selectLanguage,
  };
}
