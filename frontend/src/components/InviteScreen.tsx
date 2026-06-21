"use client";

import { Button, Card, StateCard, ThemeToggle } from "@ide/ui";

import type { InvitePreview } from "../lib/types";

interface InviteScreenProps {
  invite: InvitePreview | null;
  inviteError: string;
  redeeming: boolean;
  onRedeem: () => void;
}

export function InviteScreen({
  invite,
  inviteError,
  redeeming,
  onRedeem,
}: InviteScreenProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg p-4 text-text sm:p-8">
      <Card className="w-full max-w-xl p-6 sm:p-8">
        <div className="mb-6 flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary font-bold text-primary-fg">
              AS
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-accent">
                Candidate invite
              </p>
              <h1 className="text-2xl font-bold">코딩 테스트 입장</h1>
            </div>
          </div>
          <ThemeToggle />
        </div>

        {invite ? (
          <div className="space-y-4 text-sm text-muted">
            <p>
              <strong className="text-text">{invite.assessment_title}</strong>{" "}
              시험에 응시합니다.
            </p>
            <div className="rounded-lg border border-border bg-surface-2 p-4 font-mono text-xs text-text">
              <p>Candidate: {invite.candidate_id}</p>
              <p>Expires: {new Date(invite.expires_at).toLocaleString()}</p>
            </div>
            <Button
              size="lg"
              className="w-full"
              disabled={redeeming || invite.used || Boolean(inviteError)}
              onClick={onRedeem}
            >
              {redeeming ? "세션 생성 중…" : "시험 시작"}
            </Button>
          </div>
        ) : inviteError ? null : (
          <StateCard
            tone="loading"
            title="초대 링크를 확인하는 중입니다"
          />
        )}

        {inviteError && (
          <div
            role="alert"
            className="mt-5 rounded-lg border border-danger/40 bg-risk-high-soft p-4 text-sm text-danger"
          >
            {inviteError}
          </div>
        )}
      </Card>
    </main>
  );
}
