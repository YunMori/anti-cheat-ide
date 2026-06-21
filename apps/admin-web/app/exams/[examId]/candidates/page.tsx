"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { Button, Card, cn } from "@ide/ui";
import { useConsole } from "../../../../components/console";
import { get, post } from "../../../../lib/api";
import type { ParticipantStatus } from "../../../../lib/types";
import {
  Eyebrow,
  ErrorText,
  InfoNote,
  SubmitButton,
  TextField,
  formatDateTime,
  participantStatusLabel,
} from "../../../../components/ui-bits";

export default function CandidatesPage() {
  const { examId } = useConsole();
  const [participants, setParticipants] = useState<ParticipantStatus[]>([]);

  const reload = useCallback(() => {
    void get<ParticipantStatus[]>(
      `/assessments/${encodeURIComponent(examId)}/participants`,
      [],
    ).then(setParticipants);
  }, [examId]);

  useEffect(() => {
    reload();
  }, [reload]);

  return (
    <section className="space-y-5">
      <header className="space-y-1">
        <Eyebrow>Candidates</Eyebrow>
        <h1 className="text-2xl font-bold text-text">응시자 초대</h1>
      </header>

      <div className="grid gap-5 lg:grid-cols-[360px_1fr]">
        <InviteForm examId={examId} onCreated={reload} />

        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-sm font-bold text-text">
              초대된 응시자 {participants.length}
            </h2>
          </div>
          <div className="grid grid-cols-[1.4fr_0.8fr_1fr] gap-2 bg-surface-2 px-4 py-2 text-[11px] font-semibold uppercase text-muted">
            <span>응시자</span>
            <span>상태</span>
            <span>발급 시각</span>
          </div>
          {participants.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted">
              아직 초대한 응시자가 없습니다.
            </p>
          ) : (
            participants.map((p) => (
              <div
                key={p.candidate_id}
                className="grid grid-cols-[1.4fr_0.8fr_1fr] items-center gap-2 border-t border-border px-4 py-3 text-sm"
              >
                <span className="truncate font-mono text-text">{p.candidate_id}</span>
                <span
                  className={cn(
                    "text-xs",
                    p.redeemed ? "text-success" : "text-muted",
                  )}
                >
                  {participantStatusLabel(p)}
                </span>
                <span className="font-mono text-xs text-muted">
                  {formatDateTime(p.invited_at)}
                </span>
              </div>
            ))
          )}
        </Card>
      </div>
    </section>
  );
}

function InviteForm({
  examId,
  onCreated,
}: {
  examId: string;
  onCreated: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");
  const [copied, setCopied] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const invite = await post<{ invite_url: string }>(
        `/assessments/${encodeURIComponent(examId)}/invites`,
        {
          candidate_id: String(form.get("candidateId")),
          expires_at: new Date(String(form.get("expiresAt"))).toISOString(),
        },
      );
      setInviteUrl(invite.invite_url);
      setCopied(false);
      onCreated();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "초대 링크 생성에 실패했습니다.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
    } catch {
      setError("클립보드 복사에 실패했습니다. 링크를 직접 선택해 복사하세요.");
    }
  }

  return (
    <Card className="p-5">
      <h2 className="text-sm font-bold text-text">1회용 인증 링크 생성</h2>
      <form className="mt-4 flex flex-col gap-3" onSubmit={submit}>
        <TextField
          label="응시자 ID"
          name="candidateId"
          placeholder="candidate_20260001"
        />
        <TextField label="만료 시간" name="expiresAt" type="datetime-local" />
        <InfoNote>
          <strong className="text-text">식별 기준</strong>
          <span>candidate_id = 사람</span>
          <span>초대 링크 교환 시 session_id가 생성됩니다</span>
        </InfoNote>
        <SubmitButton busy={busy} label="초대 링크 생성" />
        {inviteUrl && (
          <output className="flex flex-col gap-2 rounded-lg border border-border bg-surface-2 p-3 text-xs">
            <Button
              variant="secondary"
              size="sm"
              type="button"
              onClick={() => void copyLink()}
            >
              {copied ? "복사됨 ✓" : "링크 복사"}
            </Button>
            <span className="break-all font-mono text-muted">{inviteUrl}</span>
          </output>
        )}
        {error && <ErrorText message={error} />}
      </form>
    </Card>
  );
}
