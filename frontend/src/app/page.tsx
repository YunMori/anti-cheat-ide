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
  const { transport, editorRevision, handleEditorDidMount, flush } =
    useEventCapture(sessionId);

  const [submitting, setSubmitting] = useState(false);
  const [submission, setSubmission] = useState<SubmissionAccepted | null>(null);

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
        accepted.judge_result
          ? `채점 완료: ${accepted.judge_result.passed_count}/${accepted.judge_result.total_count}`
          : accepted.status === "judge_failed"
            ? "제출은 저장됐지만 채점 서비스 호출에 실패했습니다."
            : "제출이 저장됐고 채점을 기다리고 있습니다.",
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
        onFlush={() => void flushEvents()}
        onSubmit={() => void submitCode()}
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
