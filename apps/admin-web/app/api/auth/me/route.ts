import {
  getAdminToken,
  passthrough,
  platformUrl,
  unauthorized,
} from "../../../../lib/platform";

export async function GET() {
  const token = await getAdminToken();
  if (!token) {
    return unauthorized();
  }

  const response = await fetch(platformUrl("auth/me"), {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  return passthrough(response);
}
