"use client";

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
              onClick={onRedeem}
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
