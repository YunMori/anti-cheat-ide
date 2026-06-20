"use client";

import { useCallback, useState } from "react";

import { AlertStack } from "@/components/AlertStack";
import { EditorPane } from "@/components/EditorPane";
import { IdeHeader } from "@/components/IdeHeader";
import { InviteScreen } from "@/components/InviteScreen";
import { ProblemSidebar } from "@/components/ProblemSidebar";
import { LANGUAGE_LABELS, PLATFORM_API_URL } from "@/lib/constants";
import { useAlerts } from "@/lib/hooks/useAlerts";
import { useEventCapture } from "@/lib/hooks/useEventCapture";
import { useInvite } from "@/lib/hooks/useInvite";
import { useOnlineStatus } from "@/lib/hooks/useOnlineStatus";
import { useSession } from "@/lib/hooks/useSession";
import type { SubmissionAccepted } from "@/lib/types";

export default function AntiCheatIDE() {
  const { alerts, addAlert } = useAlerts();
  const online = useOnlineStatus();
  const { sessionId, invite, inviteError, redeeming, redeemInvite } =
    useInvite();
  const {
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
  } = useSession(sessionId, addAlert);
  const [finished, setFinished] = useState(false);
  const isFinished = finished || sessionInfo?.status === "finished";
  const { transport, editorRevision, handleEditorDidMount, flush } =
    useEventCapture(isFinished ? "" : sessionId);

  const [submitting, setSubmitting] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [submission, setSubmission] = useState<SubmissionAccepted | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const flushEvents = useCallback(async () => {
    const pending = await flush();
    if (pending === null) {
      addAlert("세션 ID를 설정한 뒤 이벤트를 전송할 수 있습니다.");
      return;
    }
    addAlert(
      pending === 0
        ? "모든 응시 이벤트가 전송되었습니다."
        : "전송하지 못한 이벤트는 보관 후 자동 재시도합니다.",
    );
  }, [addAlert, flush]);

  const submitCode = useCallback(async () => {
    if (!problem) {
      addAlert("문제를 불러온 뒤 제출할 수 있습니다.");
      return;
    }
    setSubmitting(true);
    setSubmission(null);
    try {
      await flush();
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
        accepted.status === "judge_failed"
          ? "제출은 저장됐지만 채점 서비스 호출에 실패했습니다."
          : "제출이 완료되었습니다.",
      );

      // 해금 상태 갱신 후, 다음 문제가 열렸으면 자동 이동
      const updated = await refreshProblems();
      const index = updated.findIndex((item) => item.id === problem.id);
      const next = updated[index + 1];
      if (next && next.status !== "locked") {
        selectProblem(next.id);
        addAlert("다음 문제가 해금되었습니다.");
      }
    } catch (error) {
      addAlert(error instanceof Error ? error.message : "제출에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }, [
    addAlert,
    code,
    flush,
    problem,
    refreshProblems,
    selectProblem,
    selectedLanguage,
    sessionId,
  ]);

  const finishExam = useCallback(async () => {
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        "응시를 종료하시겠습니까? 종료 후에는 제출·수정할 수 없습니다.",
      )
    ) {
      return;
    }
    setFinishing(true);
    try {
      await flush();
      const response = await fetch(
        `${PLATFORM_API_URL}/sessions/${encodeURIComponent(sessionId)}/finish`,
        { method: "POST" },
      );
      if (!response.ok) {
        throw new Error(`응시 종료 요청이 HTTP ${response.status}로 실패했습니다.`);
      }
      setFinished(true);
    } catch (error) {
      addAlert(error instanceof Error ? error.message : "응시 종료에 실패했습니다.");
    } finally {
      setFinishing(false);
    }
  }, [addAlert, flush, sessionId]);

  if (!sessionId) {
    return (
      <InviteScreen
        invite={invite}
        inviteError={inviteError}
        redeeming={redeeming}
        onRedeem={() => void redeemInvite()}
      />
    );
  }

  if (isFinished) {
    return <FinishedScreen candidateId={sessionInfo?.candidate_id} />;
  }

  return (
    <main className="flex h-screen flex-col bg-gray-900 font-sans text-white">
      <AlertStack alerts={alerts} />

      <IdeHeader
        sessionInfo={sessionInfo}
        editorRevision={editorRevision}
        online={online}
        transport={transport}
        problem={problem}
        submitting={submitting}
        finishing={finishing}
        onFlush={() => void flushEvents()}
        onSubmit={() => void submitCode()}
        onFinish={() => void finishExam()}
      />

      <div className="flex flex-1 overflow-hidden">
        <ProblemSidebar
          problems={problems}
          currentProblemId={currentProblemId}
          onSelectProblem={selectProblem}
          problem={problem}
          selectedLanguage={selectedLanguage}
          onSelectLanguage={selectLanguage}
          transport={transport}
          submission={submission}
          collapsed={sidebarCollapsed}
          onToggleCollapsed={() => setSidebarCollapsed((value) => !value)}
        />

        <EditorPane
          language={selectedLanguage}
          code={code}
          onChange={setCode}
          onMount={handleEditorDidMount}
        />
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

function FinishedScreen({ candidateId }: { candidateId?: string }) {
  return (
    <main className="flex h-screen flex-col items-center justify-center bg-gray-900 px-6 font-sans text-white">
      <div className="w-full max-w-md rounded-2xl border border-gray-700 bg-gray-800 p-10 text-center shadow-2xl">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-green-500/20 text-3xl text-green-400">
          ✓
        </div>
        <h1 className="text-2xl font-bold">응시가 종료되었습니다</h1>
        <p className="mt-3 text-sm leading-relaxed text-gray-400">
          제출과 코드 수정이 더 이상 불가능합니다. 창을 닫으셔도 됩니다.
        </p>
        {candidateId && (
          <p className="mt-6 font-mono text-xs text-gray-500">
            Candidate: {candidateId}
          </p>
        )}
      </div>
    </main>
  );
}
