export type TransportStatus =
  | "idle"
  | "queued"
  | "sending"
  | "synced"
  | "retrying"
  | "error";

export interface TransportState {
  status: TransportStatus;
  clientId: string;
  pendingEvents: number;
  lastError?: string;
  lastSentAt?: number;
}

interface EventBase {
  id: string;
  timestamp: number;
  editor_revision: number;
}

interface KeyEvent extends EventBase {
  type: "keydown" | "keyup";
  key: string;
  code: string;
  cursor_offset: number;
}

interface PasteEvent extends EventBase {
  type: "paste";
  inserted_character_count: number;
  cursor_offset: number;
}

interface CodeChangeEvent extends EventBase {
  type: "code_change";
  inserted_character_count: number;
  deleted_character_count: number;
  cursor_offset: number;
}

interface FocusChangeEvent extends EventBase {
  type: "focus_change";
  focused: boolean;
}

export type SessionEvent =
  | KeyEvent
  | PasteEvent
  | CodeChangeEvent
  | FocusChangeEvent;

export type CapturedEvent = SessionEvent extends infer Event
  ? Event extends SessionEvent
    ? Omit<Event, "id">
    : never
  : never;

interface PersistedQueue {
  clientId: string;
  nextSequence: number;
  events: SessionEvent[];
}

interface AcceptedBatch {
  next_sequence: number;
}

interface SequenceConflict {
  detail?: {
    expected_sequence_start?: number;
  };
}

interface SessionEventClientOptions {
  apiBaseUrl: string;
  sessionId: string;
  onStateChange: (state: TransportState) => void;
  batchIntervalMs?: number;
}

const SCHEMA_VERSION = "1.0";
const STORAGE_PREFIX = "candidate-session-events";
const MAX_BATCH_SIZE = 250;

function createUuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function isPersistedQueue(value: unknown): value is PersistedQueue {
  if (!value || typeof value !== "object") {
    return false;
  }

  const queue = value as Partial<PersistedQueue>;
  return (
    typeof queue.clientId === "string" &&
    typeof queue.nextSequence === "number" &&
    Array.isArray(queue.events)
  );
}

export class SessionEventClient {
  private readonly apiBaseUrl: string;
  private readonly sessionId: string;
  private readonly storageKey: string;
  private readonly batchIntervalMs: number;
  private onStateChange: (state: TransportState) => void;
  private queue: PersistedQueue;
  private timer: number | undefined;
  private sending = false;
  private lastSentAt: number | undefined;

  constructor({
    apiBaseUrl,
    sessionId,
    onStateChange,
    batchIntervalMs = 2_000,
  }: SessionEventClientOptions) {
    this.apiBaseUrl = apiBaseUrl.replace(/\/+$/, "");
    this.sessionId = sessionId;
    this.storageKey = `${STORAGE_PREFIX}:${sessionId}`;
    this.batchIntervalMs = batchIntervalMs;
    this.onStateChange = onStateChange;
    this.queue = this.loadQueue();
    this.emitState(this.queue.events.length > 0 ? "queued" : "idle");
  }

  get clientId(): string {
    return this.queue.clientId;
  }

  get pendingEvents(): number {
    return this.queue.events.length;
  }

  start(): void {
    if (this.timer !== undefined) {
      return;
    }

    this.timer = window.setInterval(() => {
      void this.flush();
    }, this.batchIntervalMs);
    window.addEventListener("online", this.handleOnline);
    void this.flush();
  }

  stop(): void {
    if (this.timer !== undefined) {
      window.clearInterval(this.timer);
      this.timer = undefined;
    }

    window.removeEventListener("online", this.handleOnline);
    void this.flush(true);
    this.onStateChange = () => undefined;
  }

  capture(event: CapturedEvent): void {
    this.queue.events.push({
      ...event,
      id: `evt_${this.queue.clientId}_${createUuid()}`,
    } as SessionEvent);

    const persisted = this.persistQueue();
    this.emitState(
      persisted ? "queued" : "error",
      persisted ? undefined : "브라우저 저장소에 이벤트 큐를 저장하지 못했습니다.",
    );
  }

  async flushNow(): Promise<void> {
    await this.flush();
  }

  private readonly handleOnline = (): void => {
    void this.flush();
  };

  private loadQueue(): PersistedQueue {
    try {
      const stored = window.localStorage.getItem(this.storageKey);
      if (stored) {
        const parsed: unknown = JSON.parse(stored);
        if (isPersistedQueue(parsed)) {
          return parsed;
        }
      }
    } catch {
      // Continue with an in-memory queue and surface persistence failures later.
    }

    return {
      clientId: createUuid(),
      nextSequence: 0,
      events: [],
    };
  }

  private persistQueue(): boolean {
    try {
      window.localStorage.setItem(this.storageKey, JSON.stringify(this.queue));
      return true;
    } catch {
      return false;
    }
  }

  private async flush(keepalive = false): Promise<void> {
    if (this.sending || this.queue.events.length === 0) {
      if (!this.sending && this.queue.events.length === 0) {
        this.emitState("synced");
      }
      return;
    }

    const events = this.queue.events.slice(0, MAX_BATCH_SIZE);
    const sequenceStart = this.queue.nextSequence;
    this.sending = true;
    this.emitState("sending");

    try {
      const response = await fetch(
        `${this.apiBaseUrl}/sessions/${encodeURIComponent(this.sessionId)}/events`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            schema_version: SCHEMA_VERSION,
            session_id: this.sessionId,
            sequence_start: sequenceStart,
            sent_at: Date.now(),
            events,
          }),
          keepalive,
        },
      );

      if (response.ok) {
        const accepted = (await response.json()) as AcceptedBatch;
        this.acceptBatch(events, accepted.next_sequence);
        return;
      }

      if (response.status === 409) {
        const conflict = (await response.json()) as SequenceConflict;
        const expected = conflict.detail?.expected_sequence_start;
        throw new Error(
          `이벤트 sequence 충돌이 발생했습니다. 서버 예상값: ${
            expected ?? "unknown"
          }. 다른 탭을 닫고 감독자에게 문의하세요.`,
        );
      }

      throw new Error(`Platform API가 HTTP ${response.status}로 응답했습니다.`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "이벤트 전송에 실패했습니다.";
      this.emitState("retrying", message);
    } finally {
      this.sending = false;
    }
  }

  private acceptBatch(events: SessionEvent[], nextSequence: number): void {
    const acceptedIds = new Set(events.map((event) => event.id));
    this.queue.events = this.queue.events.filter(
      (event) => !acceptedIds.has(event.id),
    );
    this.queue.nextSequence = nextSequence;
    this.lastSentAt = Date.now();

    const persisted = this.persistQueue();
    this.emitState(
      persisted
        ? this.queue.events.length > 0
          ? "queued"
          : "synced"
        : "error",
      persisted ? undefined : "전송 결과를 브라우저 저장소에 기록하지 못했습니다.",
    );
  }

  private emitState(status: TransportStatus, lastError?: string): void {
    this.onStateChange({
      status,
      clientId: this.queue.clientId,
      pendingEvents: this.queue.events.length,
      lastError,
      lastSentAt: this.lastSentAt,
    });
  }
}
