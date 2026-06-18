"use client";

import { useCallback, useEffect, useState } from "react";

import { PLATFORM_API_URL } from "../constants";
import type { InvitePreview, SessionInfo } from "../types";

function readInitialInviteToken(): string {
  if (typeof window === "undefined") {
    return "";
  }
  return new URLSearchParams(window.location.search).get("invite") ?? "";
}

/**
 * 초대 토큰을 검증(미리보기)하고, 교환(redeem)해 세션을 생성한다.
 * 생성된 session_id를 반환하며, 이후 단계(세션/이벤트)는 이 값을 사용한다.
 */
export function useInvite() {
  const [sessionId, setSessionId] = useState("");
  const [inviteToken] = useState(readInitialInviteToken);
  const [invite, setInvite] = useState<InvitePreview | null>(null);
  const [inviteError, setInviteError] = useState(() =>
    readInitialInviteToken() ? "" : "초대 링크에 invite token이 없습니다.",
  );
  const [redeeming, setRedeeming] = useState(false);

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
        setInviteError(
          error instanceof Error ? error.message : "초대 링크 확인에 실패했습니다.",
        );
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
      setInviteError(
        error instanceof Error ? error.message : "시험 시작에 실패했습니다.",
      );
    } finally {
      setRedeeming(false);
    }
  }, [invite?.used, inviteToken]);

  return { sessionId, invite, inviteError, redeeming, redeemInvite };
}
