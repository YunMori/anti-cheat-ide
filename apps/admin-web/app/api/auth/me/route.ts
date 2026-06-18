import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const PLATFORM_API_URL =
  process.env.NEXT_PUBLIC_PLATFORM_API_URL ?? "http://localhost:8001";

export async function GET() {
  const token = (await cookies()).get("platform_admin_token")?.value;
  if (!token) {
    return NextResponse.json({ detail: "not authenticated" }, { status: 401 });
  }

  const response = await fetch(`${PLATFORM_API_URL.replace(/\/$/, "")}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const body = await response.text();

  return new NextResponse(body, {
    status: response.status,
    headers: {
      "content-type": response.headers.get("content-type") ?? "application/json",
    },
  });
}
