"use client";

import { useRouter } from "next/navigation";
import { Badge, Card } from "@ide/ui";
import { useConsole } from "../../../../components/console";
import { AssessmentForm } from "../../../../components/assessment-form";
import { Eyebrow, InfoNote, formatDateTime } from "../../../../components/ui-bits";
import { STATUS_META } from "../../../../lib/types";

export default function SettingsPage() {
  const { exam, role } = useConsole();
  const router = useRouter();

  return (
    <section className="max-w-3xl space-y-6">
      <header className="space-y-1">
        <Eyebrow>Assessment</Eyebrow>
        <h1 className="text-2xl font-bold text-text">시험 설정</h1>
      </header>

      {exam && (
        <Card className="space-y-4 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-text">현재 시험</h2>
            <Badge tone={STATUS_META[exam.status].tone}>
              {STATUS_META[exam.status].label}
            </Badge>
          </div>
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            <Meta term="조직 ID" value={exam.organization_id} mono />
            <Meta term="시험 제목" value={exam.title} />
            <Meta term="시작 시간" value={formatDateTime(exam.starts_at)} mono />
            <Meta term="종료 시간" value={formatDateTime(exam.ends_at)} mono />
          </dl>
          <InfoNote>
            <span>시험 일정·제목 수정은 현재 버전에서 지원하지 않습니다.</span>
            <span>새 구성이 필요하면 아래에서 새 시험을 생성하세요.</span>
          </InfoNote>
        </Card>
      )}

      {role === "admin" && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-text">새 시험 만들기</h2>
          <AssessmentForm
            onCreated={(assessment) =>
              router.push(`/exams/${assessment.id}/dashboard`)
            }
          />
        </div>
      )}
    </section>
  );
}

function Meta({
  term,
  value,
  mono = false,
}: {
  term: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] uppercase text-muted">{term}</dt>
      <dd className={`truncate text-sm text-text ${mono ? "font-mono" : ""}`}>
        {value}
      </dd>
    </div>
  );
}
