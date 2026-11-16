import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ authenticated: false }, { status: 401, headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json({
      authenticated: true,
      user: { accountKey: user.accountKey, displayName: user.displayName, email: user.email },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Não foi possível validar a sessão." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
