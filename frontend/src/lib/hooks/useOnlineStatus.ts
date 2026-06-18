"use client";

import { useEffect, useState } from "react";

/** 브라우저 네트워크 연결 상태(online/offline)를 추적한다. */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(true);

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

  return online;
}
