/** Platform API 프록시(/api/platform) 호출 헬퍼. */

export const PLATFORM_API_URL = "/api/platform";

async function send<T>(method: string, path: string, body?: object): Promise<T> {
  const response = await fetch(`${PLATFORM_API_URL}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(
      typeof payload?.detail === "string"
        ? payload.detail
        : `요청 실패 (${response.status})`,
    );
  }
  return response.json() as Promise<T>;
}

/** POST 요청(생성). */
export function post<T>(path: string, body: object): Promise<T> {
  return send<T>("POST", path, body);
}

/** PATCH 요청(부분 수정). */
export function patch<T>(path: string, body: object): Promise<T> {
  return send<T>("PATCH", path, body);
}

/** GET 요청. 실패 시 fallback 반환(목록 로딩 등에 사용). */
export async function get<T>(path: string, fallback: T, signal?: AbortSignal): Promise<T> {
  try {
    const response = await fetch(`${PLATFORM_API_URL}${path}`, { signal });
    return response.ok ? ((await response.json()) as T) : fallback;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    return fallback;
  }
}
