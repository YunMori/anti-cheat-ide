"use client";

import type { ReactNode } from "react";
import { Button, Field, Input } from "@ide/ui";
import type { ParticipantStatus } from "../lib/types";

/** 화면 상단의 accent 아이브로우 라벨. */
export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="text-xs font-bold uppercase tracking-wider text-accent">
      {children}
    </p>
  );
}

export function TextField({
  label,
  name,
  type = "text",
  placeholder,
  defaultValue,
  required = true,
  disabled = false,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  defaultValue?: string;
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <Field label={label} htmlFor={`field-${name}`}>
      <Input
        id={`field-${name}`}
        name={name}
        type={type}
        placeholder={placeholder}
        defaultValue={defaultValue}
        required={required}
        disabled={disabled}
      />
    </Field>
  );
}

export function SubmitButton({
  busy,
  label,
  disabled = false,
}: {
  busy: boolean;
  label: string;
  disabled?: boolean;
}) {
  return (
    <Button type="submit" disabled={busy || disabled} className="self-start">
      {busy ? "처리 중…" : label}
    </Button>
  );
}

export function ErrorText({ message }: { message: string }) {
  return (
    <p role="alert" className="text-sm text-danger">
      {message}
    </p>
  );
}

export function InfoNote({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border-l-2 border-accent bg-surface-2 px-4 py-3 font-mono text-xs text-muted">
      {children}
    </div>
  );
}

/** "자동 탈락 금지" 등 정책 고지를 위한 앰버 배너. */
export function PolicyBanner() {
  return (
    <aside
      className="flex items-start gap-3 rounded-xl border-l-4 border-warning bg-risk-medium-soft p-4"
      aria-label="검토 정책"
    >
      <span
        className="flex size-6 shrink-0 items-center justify-center rounded-full bg-warning font-bold text-white"
        aria-hidden="true"
      >
        !
      </span>
      <p className="text-sm text-text">
        <strong className="mr-1 font-bold">자동 탈락 금지.</strong>
        탐지 점수만으로 응시자를 탈락시키지 않습니다. 신호별 근거와 시험 맥락을
        사람이 검토해야 합니다.
      </p>
    </aside>
  );
}

export function participantStatusLabel(participant: ParticipantStatus): string {
  if (!participant.redeemed) return "초대됨";
  if (participant.session_status === "finished") return "응시 종료";
  if (participant.session_status === "submitted") return "제출 완료";
  return "응시 중";
}

/** ISO 문자열을 "MM.DD HH:mm"로 표시. */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(date.getMonth() + 1)}.${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
