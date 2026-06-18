"use client";

import { type OnMount } from "@monaco-editor/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { INITIAL_TRANSPORT_STATE, PLATFORM_API_URL } from "../constants";
import { SessionEventClient } from "../session-event-client";

/**
 * 응시 행동 이벤트 수집의 핵심 훅.
 *
 * - sessionId가 생기면 SessionEventClient를 시작/정지하고,
 * - 창 포커스 변화를 focus_change 이벤트로 캡처하며,
 * - Monaco 에디터에 key/paste/code_change 리스너를 붙인다.
 * - flush()로 즉시 전송하고, transport/editorRevision 상태를 노출한다.
 */
export function useEventCapture(sessionId: string) {
  const [transport, setTransport] = useState(INITIAL_TRANSPORT_STATE);
  const [editorRevision, setEditorRevision] = useState(0);
  const eventClientRef = useRef<SessionEventClient | null>(null);
  const editorRevisionRef = useRef(0);
  const editorDisposablesRef = useRef<Array<{ dispose: () => void }>>([]);
  const lastFocusRef = useRef<boolean | null>(null);

  useEffect(() => {
    if (!sessionId) {
      return;
    }

    const client = new SessionEventClient({
      apiBaseUrl: PLATFORM_API_URL,
      sessionId,
      onStateChange: setTransport,
    });
    eventClientRef.current = client;
    client.start();

    const captureFocus = (focused: boolean) => {
      if (lastFocusRef.current === focused) {
        return;
      }

      lastFocusRef.current = focused;
      client.capture({
        type: "focus_change",
        timestamp: Date.now(),
        editor_revision: editorRevisionRef.current,
        focused,
      });
    };

    const handleFocus = () => captureFocus(true);
    const handleBlur = () => captureFocus(false);
    const handleVisibilityChange = () => {
      captureFocus(
        document.visibilityState === "visible" && document.hasFocus(),
      );
    };

    captureFocus(document.visibilityState === "visible" && document.hasFocus());
    window.addEventListener("focus", handleFocus);
    window.addEventListener("blur", handleBlur);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("blur", handleBlur);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      client.stop();
      eventClientRef.current = null;
    };
  }, [sessionId]);

  useEffect(
    () => () => {
      editorDisposablesRef.current.forEach((disposable) => disposable.dispose());
      editorDisposablesRef.current = [];
    },
    [],
  );

  const handleEditorDidMount: OnMount = useCallback((editor) => {
    editorDisposablesRef.current.forEach((disposable) => disposable.dispose());

    const cursorOffset = () => {
      const model = editor.getModel();
      const position = editor.getPosition();
      return model && position ? model.getOffsetAt(position) : 0;
    };

    editorDisposablesRef.current = [
      editor.onKeyDown((event) => {
        eventClientRef.current?.capture({
          type: "keydown",
          timestamp: Date.now(),
          editor_revision: editorRevisionRef.current,
          key: event.browserEvent.key,
          code: event.browserEvent.code,
          cursor_offset: cursorOffset(),
        });
      }),
      editor.onKeyUp((event) => {
        eventClientRef.current?.capture({
          type: "keyup",
          timestamp: Date.now(),
          editor_revision: editorRevisionRef.current,
          key: event.browserEvent.key,
          code: event.browserEvent.code,
          cursor_offset: cursorOffset(),
        });
      }),
      editor.onDidPaste((event) => {
        const model = editor.getModel();
        const insertedCharacterCount =
          model?.getValueInRange(event.range).length ?? 0;

        eventClientRef.current?.capture({
          type: "paste",
          timestamp: Date.now(),
          editor_revision: editorRevisionRef.current,
          inserted_character_count: insertedCharacterCount,
          cursor_offset: cursorOffset(),
        });
      }),
      editor.onDidChangeModelContent((event) => {
        editorRevisionRef.current += 1;
        setEditorRevision(editorRevisionRef.current);
        const insertedCharacterCount = event.changes.reduce(
          (total, change) => total + change.text.length,
          0,
        );
        const deletedCharacterCount = event.changes.reduce(
          (total, change) => total + change.rangeLength,
          0,
        );

        eventClientRef.current?.capture({
          type: "code_change",
          timestamp: Date.now(),
          editor_revision: editorRevisionRef.current,
          inserted_character_count: insertedCharacterCount,
          deleted_character_count: deletedCharacterCount,
          cursor_offset: cursorOffset(),
        });
      }),
    ];
  }, []);

  /** 큐를 즉시 전송한다. 반환값은 전송 후 남은 이벤트 수, 클라이언트가 없으면 null. */
  const flush = useCallback(async (): Promise<number | null> => {
    const client = eventClientRef.current;
    if (!client) {
      return null;
    }
    await client.flushNow();
    return client.pendingEvents;
  }, []);

  return { transport, editorRevision, handleEditorDidMount, flush };
}
