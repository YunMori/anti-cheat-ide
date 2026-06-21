"use client";

import { useEffect, useState } from "react";
import type { AdminUser } from "./types";

export type AuthState =
  | { status: "loading" }
  | { status: "anonymous" }
  | { status: "authenticated"; user: AdminUser };

/** /api/auth/me로 관리자 인증 상태를 확인하고 로그아웃 핸들러를 제공한다. */
export function useAdminAuth(): {
  auth: AuthState;
  logout: () => Promise<void>;
} {
  const [auth, setAuth] = useState<AuthState>({ status: "loading" });

  useEffect(() => {
    let active = true;
    fetch("/api/auth/me")
      .then((response) =>
        response.ok
          ? response.json()
          : Promise.reject(new Error("not authenticated")),
      )
      .then((user: AdminUser) => {
        if (active) setAuth({ status: "authenticated", user });
      })
      .catch(() => {
        if (active) setAuth({ status: "anonymous" });
      });
    return () => {
      active = false;
    };
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setAuth({ status: "anonymous" });
  }

  return { auth, logout };
}
