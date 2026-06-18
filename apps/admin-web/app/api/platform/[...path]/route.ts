import {
  getAdminToken,
  passthrough,
  platformUrl,
  unauthorized,
} from "../../../../lib/platform";

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
  const token = await getAdminToken();
  if (!token) {
    return unauthorized();
  }

  const { path } = await context.params;
  const url = new URL(request.url);
  const upstreamUrl = new URL(platformUrl(path.join("/")));
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

  return passthrough(response);
}
