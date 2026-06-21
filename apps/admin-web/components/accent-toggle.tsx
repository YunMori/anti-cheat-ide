"use client";

import { useEffect, useState } from "react";

const ACCENTS = ["teal", "blue", "violet"] as const;
type Accent = (typeof ACCENTS)[number];

const LABEL: Record<Accent, string> = {
  teal: "틸",
  blue: "블루",
  violet: "바이올렛",
};

const STORAGE_KEY = "console-accent";

/** 강조색(teal/blue/violet)을 순환 전환한다. <html data-accent>로 토큰을 스왑. */
export function AccentToggle() {
  const [accent, setAccent] = useState<Accent>("teal");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY) as Accent | null;
    if (stored && ACCENTS.includes(stored)) {
      // 마운트 시 외부 저장소(localStorage)의 사용자 강조색 설정을 1회 동기화.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAccent(stored);
      document.documentElement.dataset.accent = stored;
    }
  }, []);

  function cycle() {
    const next = ACCENTS[(ACCENTS.indexOf(accent) + 1) % ACCENTS.length];
    setAccent(next);
    document.documentElement.dataset.accent = next;
    window.localStorage.setItem(STORAGE_KEY, next);
  }

  return (
    <button
      type="button"
      onClick={cycle}
      title="강조색 변경"
      aria-label={`강조색: ${LABEL[accent]}`}
      className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted transition-colors hover:bg-surface-2 hover:text-text"
    >
      <span
        className="size-3 rounded-full"
        style={{ background: "var(--accent)" }}
        aria-hidden="true"
      />
      {LABEL[accent]}
    </button>
  );
}
