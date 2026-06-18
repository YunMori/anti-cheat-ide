import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const PLATFORM_API_URL =
  process.env.NEXT_PUBLIC_PLATFORM_API_URL ?? "http://localhost:8001";

export async function POST(request: Request) {
  const response = await fetch(`${PLATFORM_API_URL.replace(/\/$/, "")}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: await request.text(),
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    return NextResponse.json(payload ?? { detail: "login failed" }, {
      status: response.status,
    });
  }

  const cookieStore = await cookies();
  cookieStore.set("platform_admin_token", payload.access_token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });

  return NextResponse.json(payload.user);
}
