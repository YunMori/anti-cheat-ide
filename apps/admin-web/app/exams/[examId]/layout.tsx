"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { StateCard } from "@ide/ui";
import { useAdminAuth } from "../../../lib/auth";
import { get } from "../../../lib/api";
import type { Assessment } from "../../../lib/types";
import { ConsoleShell } from "../../../components/console";

export default function ExamLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ examId: string }>;
}) {
  const { examId } = use(params);
  const { auth, logout } = useAdminAuth();
  const router = useRouter();
  const [exams, setExams] = useState<Assessment[]>([]);
  const [loaded, setLoaded] = useState(false);

  const role =
    auth.status === "authenticated" ? auth.user.role : null;

  useEffect(() => {
    if (auth.status === "anonymous") router.replace("/");
    if (auth.status === "authenticated" && !auth.user.role) router.replace("/");
  }, [auth, router]);

  useEffect(() => {
    if (role) {
      void get<Assessment[]>("/assessments", []).then((items) => {
        setExams(items);
        setLoaded(true);
      });
    }
  }, [role]);

  if (!role || !loaded) {
    return (
      <main className="grid min-h-screen place-items-center p-10">
        <StateCard tone="loading" title="콘솔을 불러오는 중" description="잠시만 기다려 주세요." />
      </main>
    );
  }

  const exam = exams.find((item) => item.id === examId) ?? null;

  return (
    <ConsoleShell value={{ examId, exam, exams, role, logout }}>
      {children}
    </ConsoleShell>
  );
}
