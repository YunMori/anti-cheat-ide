import { NextResponse } from "next/server";

import {
  getAdminToken,
  passthrough,
  platformUrl,
  unauthorized,
} from "../../../../lib/platform";

type RouteContext = {
  params: Promise<{ sessionId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { sessionId } = await context.params;
  const token = await getAdminToken();
  if (!token) {
    return unauthorized();
  }

  try {
    const response = await fetch(
      platformUrl(`sessions/${encodeURIComponent(sessionId)}/risk`),
      {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    return passthrough(response);
  } catch {
    return NextResponse.json(
      { detail: "Platform API is unreachable" },
      { status: 502 },
    );
  }
}
