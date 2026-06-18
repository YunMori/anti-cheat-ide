import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const PLATFORM_API_URL =
  process.env.NEXT_PUBLIC_PLATFORM_API_URL ?? "http://localhost:8001";

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

export async function GET(request: Request, context: RouteContext) {
  return proxy(request, context);
}

export async function POST(request: Request, context: RouteContext) {
  return proxy(request, context);
}

async function proxy(request: Request, context: RouteContext) {
  const token = (await cookies()).get("platform_admin_token")?.value;
  if (!token) {
    return NextResponse.json({ detail: "not authenticated" }, { status: 401 });
  }

  const { path } = await context.params;
  const url = new URL(request.url);
  const upstreamUrl = new URL(
    `${PLATFORM_API_URL.replace(/\/$/, "")}/${path.join("/")}`,
  );
  upstreamUrl.search = url.search;

  const response = await fetch(upstreamUrl, {
    method: request.method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": request.headers.get("content-type") ?? "application/json",
    },
    body: request.method === "GET" ? undefined : await request.text(),
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
