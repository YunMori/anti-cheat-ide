import { NextResponse } from "next/server";
import { cookies } from "next/headers";

type RouteContext = {
  params: Promise<{ sessionId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { sessionId } = await context.params;
  const baseUrl = process.env.NEXT_PUBLIC_PLATFORM_API_URL ?? "http://localhost:8001";
  const token = (await cookies()).get("platform_admin_token")?.value;

  if (!token) {
    return NextResponse.json({ detail: "not authenticated" }, { status: 401 });
  }

  try {
    const response = await fetch(
      `${baseUrl.replace(/\/$/, "")}/sessions/${encodeURIComponent(sessionId)}/risk`,
      {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    const body = await response.text();

    return new NextResponse(body, {
      status: response.status,
      headers: {
        "content-type": response.headers.get("content-type") ?? "application/json",
      },
    });
  } catch {
    return NextResponse.json(
      { detail: "Platform API is unreachable" },
      { status: 502 },
    );
  }
}
