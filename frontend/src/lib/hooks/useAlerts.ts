"use client";

import { useCallback, useState } from "react";

import type { Alert } from "../types";

/** 5초 후 자동으로 사라지는 토스트 알림 목록을 관리한다. */
export function useAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);

  const addAlert = useCallback((message: string) => {
    const id = crypto.randomUUID();
    setAlerts((current) => [...current, { id, message }]);
    window.setTimeout(() => {
      setAlerts((current) => current.filter((alert) => alert.id !== id));
    }, 5_000);
  }, []);

  return { alerts, addAlert };
}
