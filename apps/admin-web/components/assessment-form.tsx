"use client";

import { FormEvent, useState } from "react";
import { Card } from "@ide/ui";
import { post } from "../lib/api";
import type { Assessment } from "../lib/types";
import { ErrorText, SubmitButton, TextField } from "./ui-bits";

/** 새 시험 생성 폼. 생성 성공 시 onCreated로 결과를 전달한다. */
export function AssessmentForm({
  onCreated,
}: {
  onCreated: (assessment: Assessment) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      const assessment = await post<Assessment>("/assessments", {
        organization_id: form.get("organizationId"),
        title: form.get("title"),
        starts_at: new Date(String(form.get("startsAt"))).toISOString(),
        ends_at: new Date(String(form.get("endsAt"))).toISOString(),
      });
      onCreated(assessment);
      formElement.reset();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "시험 생성에 실패했습니다.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-5">
      <form className="flex flex-col gap-3" onSubmit={submit}>
        <TextField label="조직 ID" name="organizationId" placeholder="org_acme" />
        <TextField
          label="시험 제목"
          name="title"
          placeholder="2026 백엔드 개발자 코딩테스트"
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label="시작 시간" name="startsAt" type="datetime-local" />
          <TextField label="종료 시간" name="endsAt" type="datetime-local" />
        </div>
        <p className="text-xs text-muted">
          출제는 시작 전(시작 시간 이전)에만 가능합니다. 시험이 시작되면 문제가
          잠깁니다.
        </p>
        <SubmitButton busy={busy} label="시험 생성" />
        {error && <ErrorText message={error} />}
      </form>
    </Card>
  );
}
