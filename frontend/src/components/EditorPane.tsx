"use client";

import Editor, { type OnMount } from "@monaco-editor/react";

import { MONACO_LANGUAGES } from "../lib/constants";
import type { SupportedLanguage } from "../lib/types";

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
  return (
    <div className="relative flex-1">
      <Editor
        height="100%"
        language={MONACO_LANGUAGES[language]}
        theme="vs-dark"
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
