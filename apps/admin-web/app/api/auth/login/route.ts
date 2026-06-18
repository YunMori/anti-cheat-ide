import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  ADMIN_TOKEN_COOKIE,
  ADMIN_TOKEN_MAX_AGE,
  platformUrl,
} from "../../../../lib/platform";

export async function POST(request: Request) {
  const response = await fetch(platformUrl("auth/login"), {
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
  cookieStore.set(ADMIN_TOKEN_COOKIE, payload.access_token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ADMIN_TOKEN_MAX_AGE,
  });

  return NextResponse.json(payload.user);
}
