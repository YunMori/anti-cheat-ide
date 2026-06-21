"use client";

import { Card, cn, riskTone } from "@ide/ui";

/** 대시보드 KPI 단일 카드. */
export function KpiCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number | string;
  tone?: "default" | "accent" | "high";
}) {
  return (
    <Card className="p-5">
      <p className="text-xs text-muted">{label}</p>
      <strong
        className={cn(
          "mt-2 block text-3xl font-bold",
          tone === "accent" && "text-accent",
          tone === "high" && "text-risk-high",
          tone === "default" && "text-text",
        )}
      >
        {value}
      </strong>
    </Card>
  );
}

/** 위험 점수 막대 게이지(높이 5px, 최대 폭 70px). 색은 점수 밴드로 결정. */
export function RiskGauge({ score }: { score: number }) {
  const tone = riskTone(score);
  const width = Math.max(4, Math.min(100, score));
  const color =
    tone === "high"
      ? "var(--risk-high)"
      : tone === "medium"
        ? "var(--risk-medium)"
        : "var(--risk-low)";
  return (
    <span
      className="inline-block h-[5px] w-[70px] overflow-hidden rounded-full bg-surface-2 align-middle"
      aria-hidden="true"
    >
      <span
        className="block h-full rounded-full"
        style={{ width: `${width}%`, background: color }}
      />
    </span>
  );
}
