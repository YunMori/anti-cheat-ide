"use client";

import Editor, { type OnMount } from "@monaco-editor/react";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  SessionEventClient,
  type TransportState,
  type TransportStatus,
} from "@/lib/session-event-client";

const INITIAL_CODE =
  "// 코딩 테스트를 시작하세요.\nfunction solution(n) {\n    return n;\n}";
const PLATFORM_API_URL =
  process.env.NEXT_PUBLIC_PLATFORM_API_URL ?? "http://localhost:8001";

type SupportedLanguage = "python" | "javascript" | "cpp" | "java";

interface SessionInfo {
  id: string;
  assessment_id: string;
  candidate_id: string;
  status: string;
}

interface CandidateProblem {
  id: string;
  title: string;
  statement: string;
  allowed_languages: SupportedLanguage[];
  starter_code: Partial<Record<SupportedLanguage, string>>;
  time_limit_ms: number;
  memory_limit_mb: number;
  public_test_cases: Array<{
    id: string;
    stdin: string;
    expected_stdout: string;
  }>;
}

interface InvitePreview {
  assessment_id: string;
  assessment_title: string;
  candidate_id: string;
  expires_at: string;
  used: boolean;
}

interface JudgeResult {
  status: string;
  passed_count: number;
  total_count: number;
  duration_ms: number;
  test_cases: Array<{
    id: string;
    status: string;
    stdout: string;
    expected_stdout: string;
    stderr: string;
    duration_ms: number;
  }>;
}

interface SubmissionAccepted {
  id: string;
  status: "queued" | "judged" | "judge_failed";
  judge_result: JudgeResult | null;
}

const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  python: "Python 3.12",
  javascript: "JavaScript ES2022",
  cpp: "C++20",
  java: "Java 21",
};

const MONACO_LANGUAGES: Record<SupportedLanguage, string> = {
  python: "python",
  javascript: "javascript",
  cpp: "cpp",
  java: "java",
};

const DEFAULT_STARTERS: Record<SupportedLanguage, string> = {
  python: "# 코딩 테스트를 시작하세요.\n",
  javascript: INITIAL_CODE,
  cpp: "#include <iostream>\nusing namespace std;\n\nint main() {\n    return 0;\n}\n",
  java: "public class Main {\n    public static void main(String[] args) {\n    }\n}\n",
};

interface Alert {
  id: string;
  message: string;
}

const INITIAL_TRANSPORT_STATE: TransportState = {
  status: "idle",
  clientId: "not-configured",
  pendingEvents: 0,
};

const STATUS_LABELS: Record<TransportStatus, string> = {
  idle: "대기 중",
  queued: "전송 대기",
  sending: "전송 중",
  synced: "동기화 완료",
  retrying: "재시도 중",
  error: "설정 오류",
};

const STATUS_COLORS: Record<TransportStatus, string> = {
  idle: "text-gray-400",
  queued: "text-yellow-400",
  sending: "text-cyan-400",
  synced: "text-green-400",
  retrying: "text-orange-400",
  error: "text-red-400",
};

function readInitialInviteToken(): string {
  if (typeof window === "undefined") {
    return "";
  }
  return new URLSearchParams(window.location.search).get("invite") ?? "";
}

export default function AntiCheatIDE() {
  const [sessionId, setSessionId] = useState("");
  const [inviteToken] = useState(readInitialInviteToken);
  const [invite, setInvite] = useState<InvitePreview | null>(null);
  const [inviteError, setInviteError] = useState(() =>
    readInitialInviteToken() ? "" : "초대 링크에 invite token이 없습니다.",
  );
  const [redeeming, setRedeeming] = useState(false);
  const [code, setCode] = useState(INITIAL_CODE);
  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null);
  const [problem, setProblem] = useState<CandidateProblem | null>(null);
  const [selectedLanguage, setSelectedLanguage] =
    useState<SupportedLanguage>("javascript");
  const [transport, setTransport] = useState(INITIAL_TRANSPORT_STATE);
  const [submitting, setSubmitting] = useState(false);
  const [submission, setSubmission] = useState<SubmissionAccepted | null>(null);
  const [online, setOnline] = useState(true);
  const [editorRevision, setEditorRevision] = useState(0);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const eventClientRef = useRef<SessionEventClient | null>(null);
  const editorRevisionRef = useRef(0);
  const editorDisposablesRef = useRef<Array<{ dispose: () => void }>>([]);
  const lastFocusRef = useRef<boolean | null>(null);

  const addAlert = useCallback((message: string) => {
    const id = crypto.randomUUID();
    setAlerts((current) => [...current, { id, message }]);
    window.setTimeout(() => {
      setAlerts((current) => current.filter((alert) => alert.id !== id));
    }, 5_000);
  }, []);

  useEffect(() => {
    if (!inviteToken) {
      return;
    }

    const controller = new AbortController();
    fetch(`${PLATFORM_API_URL}/invites/${encodeURIComponent(inviteToken)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(
            response.status === 410
              ? "만료된 초대 링크입니다."
              : response.status === 404
                ? "존재하지 않는 초대 링크입니다."
                : "초대 링크를 확인할 수 없습니다.",
          );
        }
        return response.json() as Promise<InvitePreview>;
      })
      .then((loadedInvite) => {
        setInvite(loadedInvite);
        if (loadedInvite.used) {
          setInviteError("이미 사용된 초대 링크입니다.");
        }
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setInviteError(error instanceof Error ? error.message : "초대 링크 확인에 실패했습니다.");
    });
    return () => controller.abort();
  }, [inviteToken]);

  const redeemInvite = useCallback(async () => {
    if (!inviteToken || invite?.used) {
      return;
    }
    setRedeeming(true);
    setInviteError("");
    try {
      const response = await fetch(
        `${PLATFORM_API_URL}/invites/${encodeURIComponent(inviteToken)}/redeem`,
        { method: "POST" },
      );
      if (!response.ok) {
        throw new Error(
          response.status === 409
            ? "이미 사용된 초대 링크입니다."
            : response.status === 410
              ? "만료된 초대 링크입니다."
              : "초대 링크를 사용할 수 없습니다.",
        );
      }
      const redeemed = (await response.json()) as { session: SessionInfo };
      setSessionId(redeemed.session.id);
      window.history.replaceState(null, "", window.location.pathname);
    } catch (error) {
      setInviteError(error instanceof Error ? error.message : "시험 시작에 실패했습니다.");
    } finally {
      setRedeeming(false);
    }
  }, [invite?.used, inviteToken]);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    const initialStatusTimer = window.setTimeout(
      () => setOnline(navigator.onLine),
      0,
    );
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.clearTimeout(initialStatusTimer);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

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
        const loadedProblems = (await problemResponse.json()) as CandidateProblem[];
        setSessionInfo(loadedSession);
        if (loadedProblems[0]) {
          const loadedProblem = loadedProblems[0];
          const language = loadedProblem.allowed_languages[0];
          setProblem(loadedProblem);
          setSelectedLanguage(language);
          setCode(loadedProblem.starter_code[language] ?? DEFAULT_STARTERS[language]);
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        addAlert(error instanceof Error ? error.message : "세션 정보를 불러올 수 없습니다.");
      }
    }
    void loadSession();
    return () => controller.abort();
  }, [addAlert, sessionId]);

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    const client = new SessionEventClient({
      apiBaseUrl: PLATFORM_API_URL,
      sessionId,
      onStateChange: setTransport,
    });
    eventClientRef.current = client;
    client.start();

    const captureFocus = (focused: boolean) => {
      if (lastFocusRef.current === focused) {
        return;
      }

      lastFocusRef.current = focused;
      client.capture({
        type: "focus_change",
        timestamp: Date.now(),
        editor_revision: editorRevisionRef.current,
        focused,
      });
    };

    const handleFocus = () => captureFocus(true);
    const handleBlur = () => captureFocus(false);
    const handleVisibilityChange = () => {
      captureFocus(
        document.visibilityState === "visible" && document.hasFocus(),
      );
    };

    captureFocus(document.visibilityState === "visible" && document.hasFocus());
    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      client.stop();
      eventClientRef.current = null;
    };
  }, [sessionId]);

  useEffect(
    () => () => {
      editorDisposablesRef.current.forEach((disposable) => disposable.dispose());
      editorDisposablesRef.current = [];
    },
    [],
  );

  const handleEditorDidMount: OnMount = useCallback((editor) => {
    editorDisposablesRef.current.forEach((disposable) => disposable.dispose());

    const cursorOffset = () => {
      const model = editor.getModel();
      const position = editor.getPosition();
      return model && position ? model.getOffsetAt(position) : 0;
    };

    editorDisposablesRef.current = [
      editor.onKeyDown((event) => {
        eventClientRef.current?.capture({
          type: "keydown",
          timestamp: Date.now(),
          editor_revision: editorRevisionRef.current,
          key: event.browserEvent.key,
          code: event.browserEvent.code,
          cursor_offset: cursorOffset(),
        });
      }),
      editor.onKeyUp((event) => {
        eventClientRef.current?.capture({
          type: "keyup",
          timestamp: Date.now(),
          editor_revision: editorRevisionRef.current,
          key: event.browserEvent.key,
          code: event.browserEvent.code,
          cursor_offset: cursorOffset(),
        });
      }),
      editor.onDidPaste((event) => {
        const model = editor.getModel();
        const insertedCharacterCount =
          model?.getValueInRange(event.range).length ?? 0;

        eventClientRef.current?.capture({
          type: "paste",
          timestamp: Date.now(),
          editor_revision: editorRevisionRef.current,
          inserted_character_count: insertedCharacterCount,
          cursor_offset: cursorOffset(),
        });
      }),
      editor.onDidChangeModelContent((event) => {
        editorRevisionRef.current += 1;
        setEditorRevision(editorRevisionRef.current);
        const insertedCharacterCount = event.changes.reduce(
          (total, change) => total + change.text.length,
          0,
        );
        const deletedCharacterCount = event.changes.reduce(
          (total, change) => total + change.rangeLength,
          0,
        );

        eventClientRef.current?.capture({
          type: "code_change",
          timestamp: Date.now(),
          editor_revision: editorRevisionRef.current,
          inserted_character_count: insertedCharacterCount,
          deleted_character_count: deletedCharacterCount,
          cursor_offset: cursorOffset(),
        });
      }),
    ];
  }, []);

  const flushEvents = useCallback(async () => {
    const client = eventClientRef.current;
    if (!client) {
      addAlert("세션 ID를 설정한 뒤 이벤트를 전송할 수 있습니다.");
      return;
    }

    await client.flushNow();
    addAlert(
      client.pendingEvents === 0
        ? "모든 응시 이벤트가 전송되었습니다."
        : "전송하지 못한 이벤트는 보관 후 자동 재시도합니다.",
    );
  }, [addAlert]);

  const submitCode = useCallback(async () => {
    if (!problem) {
      addAlert("문제를 불러온 뒤 제출할 수 있습니다.");
      return;
    }
    setSubmitting(true);
    setSubmission(null);
    try {
      await eventClientRef.current?.flushNow();
      const response = await fetch(
        `${PLATFORM_API_URL}/sessions/${encodeURIComponent(sessionId)}/submissions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            problem_id: problem.id,
            language: selectedLanguage,
            source_code: code,
          }),
        },
      );
      if (!response.ok) {
        throw new Error(`제출 요청이 HTTP ${response.status}로 실패했습니다.`);
      }
      const accepted = (await response.json()) as SubmissionAccepted;
      setSubmission(accepted);
      addAlert(
        accepted.judge_result
          ? `채점 완료: ${accepted.judge_result.passed_count}/${accepted.judge_result.total_count}`
          : accepted.status === "judge_failed"
            ? "제출은 저장됐지만 채점 서비스 호출에 실패했습니다."
            : "제출이 저장됐고 채점을 기다리고 있습니다.",
      );
    } catch (error) {
      addAlert(error instanceof Error ? error.message : "제출에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }, [addAlert, code, problem, selectedLanguage, sessionId]);

  if (!sessionId) {
    return (
      <main className="flex h-screen items-center justify-center bg-gray-900 p-8 font-sans text-white">
        <section className="w-full max-w-xl rounded-2xl border border-gray-700 bg-gray-800 p-8 shadow-2xl">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500 font-bold text-gray-900">
              AS
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-cyan-400">
                Candidate invite
              </p>
              <h1 className="text-2xl font-bold">코딩 테스트 입장</h1>
            </div>
          </div>

          {invite ? (
            <div className="space-y-4 text-sm text-gray-300">
              <p>
                <strong className="text-white">{invite.assessment_title}</strong> 시험에
                응시합니다.
              </p>
              <div className="rounded-lg border border-gray-700 bg-gray-900 p-4 font-mono text-xs">
                <p>Candidate: {invite.candidate_id}</p>
                <p>Expires: {new Date(invite.expires_at).toLocaleString()}</p>
              </div>
              <button
                type="button"
                disabled={redeeming || invite.used || Boolean(inviteError)}
                onClick={() => void redeemInvite()}
                className="w-full rounded-md bg-cyan-600 px-5 py-3 font-bold text-gray-900 shadow-lg transition-all hover:bg-cyan-500 disabled:cursor-not-allowed disabled:bg-gray-600"
              >
                {redeeming ? "세션 생성 중..." : "시험 시작"}
              </button>
            </div>
          ) : (
            <p className="text-sm text-gray-400">초대 링크를 확인하는 중입니다.</p>
          )}

          {inviteError && (
            <div className="mt-5 rounded-lg border border-red-900 bg-red-950/40 p-4 text-sm text-red-300">
              {inviteError}
            </div>
          )}
        </section>
      </main>
    );
  }

  return (
    <main className="flex h-screen flex-col bg-gray-900 font-sans text-white">
      <div className="fixed right-4 top-20 z-50 flex flex-col gap-2">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className="rounded border border-cyan-700 bg-gray-800 px-4 py-3 text-sm text-cyan-100 shadow-lg"
          >
            {alert.message}
          </div>
        ))}
      </div>

      <header className="flex items-center justify-between border-b border-gray-700 bg-gray-800 p-4 shadow-md">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500 font-bold text-gray-900">
            AS
          </div>
          <h1 className="text-xl font-bold tracking-tight">
            Anti-Cheat <span className="text-cyan-400">Web IDE</span>
          </h1>
        </div>

        <div className="flex items-center gap-5">
          <div className="hidden flex-col items-end text-xs lg:flex">
            <span className="text-[10px] font-bold uppercase text-gray-500">
              Candidate
            </span>
            <strong className="font-mono text-cyan-300">
              {sessionInfo?.candidate_id ?? "확인 중"}
            </strong>
          </div>
          <div className="h-10 w-px bg-gray-700" />
          <div className="flex flex-col items-end">
            <span className="text-[10px] font-bold uppercase text-gray-500">
              Editor revision
            </span>
            <span className="font-mono text-xl font-bold text-cyan-400">
              {editorRevision}
            </span>
          </div>
          <div className="h-10 w-px bg-gray-700" />
          <div className="flex flex-col gap-1 text-xs">
            <span
              className={online ? "text-green-400" : "text-red-400"}
              title="브라우저 네트워크 상태"
            >
              Platform: {online ? "Online" : "Offline"}
            </span>
            <span
              className={STATUS_COLORS[transport.status]}
              title={transport.lastError}
            >
              Events: {STATUS_LABELS[transport.status]} (
              {transport.pendingEvents})
            </span>
          </div>
          <button
            type="button"
            onClick={() => void flushEvents()}
            className="rounded-md bg-cyan-600 px-5 py-2.5 font-bold text-gray-900 shadow-lg transition-all hover:bg-cyan-500 active:scale-95"
          >
            SEND EVENTS
          </button>
          <button
            type="button"
            disabled={submitting || !problem}
            onClick={() => void submitCode()}
            className="rounded-md bg-green-500 px-5 py-2.5 font-bold text-gray-900 shadow-lg transition-all hover:bg-green-400 disabled:cursor-not-allowed disabled:bg-gray-600"
          >
            {submitting ? "SUBMITTING" : "SUBMIT"}
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="custom-scrollbar w-80 overflow-y-auto border-r border-gray-700 bg-gray-800 p-6">
          <div className="mb-6">
            <span className="rounded bg-cyan-900 px-2 py-1 text-[10px] font-bold text-cyan-300">
              LEVEL 2
            </span>
            <h2 className="mt-2 text-xl font-bold text-gray-100">
              {problem?.title ?? "Fibonacci Series"}
            </h2>
          </div>

          <div className="space-y-4 text-sm leading-relaxed text-gray-400">
            {problem ? (
              <>
                <p className="whitespace-pre-wrap">{problem.statement}</p>
                <div className="rounded-lg border border-gray-700 bg-gray-900 p-4 font-mono text-xs">
                  제한: {problem.time_limit_ms}ms / {problem.memory_limit_mb}MB
                </div>
                {problem.public_test_cases.map((testCase, index) => (
                  <div key={testCase.id} className="rounded-lg border border-gray-700 bg-gray-900 p-4 font-mono text-xs">
                    <strong className="mb-2 block text-cyan-400">예제 {index + 1}</strong>
                    <pre className="whitespace-pre-wrap">입력: {testCase.stdin || "(없음)"}</pre>
                    <pre className="mt-2 whitespace-pre-wrap">출력: {testCase.expected_stdout || "(없음)"}</pre>
                  </div>
                ))}
              </>
            ) : (
              <>
                <p>피보나치 수는 수학에서 매우 유명한 수열입니다.</p>
                <div className="rounded-lg border border-gray-700 bg-gray-900 p-4 font-mono text-xs italic">
                  F(n) = F(n-1) + F(n-2)
                </div>
                <p>
                  인자 n(0 ≤ n ≤ 30)을 받아 n번째 피보나치 수를 반환하는
                  효율적인 알고리즘을 작성하세요.
                </p>
              </>
            )}
          </div>

          <div className="mt-8 space-y-4">
            <label className="block text-xs font-bold text-gray-300">
              풀이 언어
              <select
                value={selectedLanguage}
                onChange={(event) => {
                  const language = event.target.value as SupportedLanguage;
                  setSelectedLanguage(language);
                  setCode(problem?.starter_code[language] ?? DEFAULT_STARTERS[language]);
                }}
                className="mt-2 w-full rounded border border-gray-600 bg-gray-900 px-3 py-2 text-sm text-cyan-300"
              >
                {(problem?.allowed_languages ?? (Object.keys(LANGUAGE_LABELS) as SupportedLanguage[])).map(
                  (language) => (
                    <option key={language} value={language}>{LANGUAGE_LABELS[language]}</option>
                  ),
                )}
              </select>
            </label>
            <div className="rounded-lg border-l-4 border-yellow-500 bg-gray-900 p-4">
              <h3 className="mb-2 text-xs font-bold uppercase text-gray-300">
                Attention
              </h3>
              <p className="text-[11px] text-gray-500">
                키 입력, 붙여넣기 횟수, 코드 변경 및 포커스 변경이 시험
                무결성 검토를 위해 기록됩니다. 클립보드 내용은 수집하지
                않습니다.
              </p>
            </div>
            {transport.lastError && (
              <div className="rounded-lg border border-red-900 bg-red-950/40 p-4 text-xs text-red-300">
                {transport.lastError}
              </div>
            )}
            {submission && (
              <section className="rounded-lg border border-gray-700 bg-gray-900 p-4 text-xs text-gray-300">
                <h3 className="mb-2 font-bold uppercase text-cyan-300">
                  Submission
                </h3>
                <p>ID: {submission.id}</p>
                <p>Status: {submission.status}</p>
                {submission.judge_result ? (
                  <>
                    <p>
                      Result: {submission.judge_result.status} (
                      {submission.judge_result.passed_count}/
                      {submission.judge_result.total_count})
                    </p>
                    <p>Duration: {submission.judge_result.duration_ms}ms</p>
                  </>
                ) : (
                  <p>Judge result is not available yet.</p>
                )}
              </section>
            )}
          </div>
        </aside>

        <div className="relative flex-1">
          <Editor
            height="100%"
            language={MONACO_LANGUAGES[selectedLanguage]}
            theme="vs-dark"
            value={code}
            onChange={(value) => setCode(value ?? "")}
            onMount={handleEditorDidMount}
            options={{
              fontSize: 15,
              fontFamily: "Fira Code, Menlo, Monaco, Consolas, monospace",
              fontLigatures: true,
              minimap: { enabled: false },
              padding: { top: 20 },
              smoothScrolling: true,
              cursorBlinking: "smooth",
              cursorSmoothCaretAnimation: "on",
              lineNumbers: "on",
              renderLineHighlight: "all",
            }}
          />
        </div>
      </div>

      <footer className="flex h-8 items-center justify-between border-t border-gray-800 bg-gray-900 px-4 text-[10px] text-gray-600">
        <div className="flex gap-4">
          <span>Session: {sessionId || "not-configured"}</span>
          <span>Candidate: {sessionInfo?.candidate_id ?? "unknown"}</span>
          <span>Client: {transport.clientId.slice(0, 8)}</span>
          <span>{LANGUAGE_LABELS[selectedLanguage]}</span>
        </div>
        <div>Candidate Event Client v1.0</div>
      </footer>
    </main>
  );
}
