import { passthrough, platformUrl } from "../../../../lib/platform";

export async function POST(request: Request) {
  const response = await fetch(platformUrl("auth/signup"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: await request.text(),
    cache: "no-store",
  });

  return passthrough(response);
}
