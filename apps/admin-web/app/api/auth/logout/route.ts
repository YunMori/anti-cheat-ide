import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST() {
  (await cookies()).delete("platform_admin_token");
  return NextResponse.json({ ok: true });
}
