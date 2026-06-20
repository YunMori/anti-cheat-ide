import type { SupportedLanguage } from "./types";
import type {
  TransportState,
  TransportStatus,
} from "./session-event-client";

export const INITIAL_CODE = "";

export const PLATFORM_API_URL =
  process.env.NEXT_PUBLIC_PLATFORM_API_URL ?? "http://localhost:8001";

export const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
  python: "Python 3.12",
  javascript: "JavaScript ES2022",
  cpp: "C++20",
  java: "Java 21",
};

export const MONACO_LANGUAGES: Record<SupportedLanguage, string> = {
  python: "python",
  javascript: "javascript",
  cpp: "cpp",
  java: "java",
};

export const DEFAULT_STARTERS: Record<SupportedLanguage, string> = {
  python: "# 여기에 작성하세요\n",
  javascript: "// 여기에 작성하세요\n",
  cpp: "#include <iostream>\n\nint main() {\n    \n    return 0;\n}\n",
  java: "public class Main {\n    public static void main(String[] args) {\n        \n    }\n}\n",
};

export const INITIAL_TRANSPORT_STATE: TransportState = {
  status: "idle",
  clientId: "not-configured",
  pendingEvents: 0,
};

export const STATUS_LABELS: Record<TransportStatus, string> = {
  idle: "대기 중",
  queued: "전송 대기",
  sending: "전송 중",
  synced: "동기화 완료",
  retrying: "재시도 중",
  error: "설정 오류",
};

export const STATUS_COLORS: Record<TransportStatus, string> = {
  idle: "text-muted",
  queued: "text-warning",
  sending: "text-accent",
  synced: "text-success",
  retrying: "text-warning",
  error: "text-danger",
};
