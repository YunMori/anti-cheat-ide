"use client";

import dynamic from "next/dynamic";
import { type OnMount } from "@monaco-editor/react";

import { Skeleton, useTheme } from "@ide/ui";
import { MONACO_LANGUAGES } from "../lib/constants";
import type { SupportedLanguage } from "../lib/types";

function EditorSkeleton() {
  return (
    <div className="flex h-full flex-col gap-2 bg-surface p-4">
      {Array.from({ length: 12 }).map((_, index) => (
        <Skeleton
          key={index}
          className="h-4"
          style={{ width: `${40 + ((index * 37) % 55)}%` }}
        />
      ))}
    </div>
  );
}

// Monaco's editor wrapper is browser-only and heavy; load it in a separate
// client chunk so the initial IDE shell renders without it.
const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => <EditorSkeleton />,
});

interface EditorPaneProps {
  language: SupportedLanguage;
  code: string;
  onChange: (value: string) => void;
  onMount: OnMount;
}

export function EditorPane({
  language,
  code,
  onChange,
  onMount,
}: EditorPaneProps) {
  const { theme } = useTheme();

  return (
    <div className="relative flex-1 bg-surface">
      <MonacoEditor
        height="100%"
        language={MONACO_LANGUAGES[language]}
        theme={theme === "dark" ? "vs-dark" : "light"}
        value={code}
        onChange={(value) => onChange(value ?? "")}
        onMount={onMount}
        options={{
          automaticLayout: true,
          fontSize: 15,
          fontFamily: "Fira Code, Menlo, Monaco, Consolas, monospace",
          fontLigatures: true,
          minimap: { enabled: false },
          padding: { top: 20 },
          smoothScrolling: true,
          cursorBlinking: "smooth",
          cursorSmoothCaretAnimation: "on",
          lineNumbers: "on",
          renderLineHighlight: "all",
        }}
      />
    </div>
  );
}
