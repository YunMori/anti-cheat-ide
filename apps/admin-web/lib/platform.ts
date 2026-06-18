import { cookies } from "next/headers";
import { NextResponse } from "next/server";

/** 관리자 토큰을 담는 httpOnly 쿠키 이름. */
export const ADMIN_TOKEN_COOKIE = "platform_admin_token";

/** 관리자 토큰 쿠키 유효기간(초). 12시간. */
export const ADMIN_TOKEN_MAX_AGE = 60 * 60 * 12;

/** 끝의 슬래시를 제거해 정규화한 Platform API 베이스 URL. */
export const PLATFORM_API_BASE_URL = (
  process.env.NEXT_PUBLIC_PLATFORM_API_URL ?? "http://localhost:8001"
).replace(/\/$/, "");

/** Platform API의 절대 URL을 만든다. */
export function platformUrl(path: string): string {
  return `${PLATFORM_API_BASE_URL}/${path.replace(/^\//, "")}`;
}

/** 요청 쿠키에서 관리자 토큰을 읽는다(없으면 undefined). */
export async function getAdminToken(): Promise<string | undefined> {
  return (await cookies()).get(ADMIN_TOKEN_COOKIE)?.value;
}

/** 인증되지 않은 요청에 대한 401 응답. */
export function unauthorized(): NextResponse {
  return NextResponse.json({ detail: "not authenticated" }, { status: 401 });
}

/** 업스트림 응답의 본문·상태·content-type을 그대로 클라이언트로 전달한다. */
export async function passthrough(response: Response): Promise<NextResponse> {
  const body = await response.text();
  return new NextResponse(body, {
    status: response.status,
    headers: {
      "content-type": response.headers.get("content-type") ?? "application/json",
    },
  });
}
