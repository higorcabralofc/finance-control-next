import { NextRequest, NextResponse } from "next/server";
import { APP_SESSION_COOKIE, OAUTH_STATE_COOKIE, isAllowedAuthOrigin, revokeFinoraSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin") || "";
  if (!isAllowedAuthOrigin(origin)) {
    return NextResponse.json({ error: "Origem não permitida para logout." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }
  let revocationConfirmed = false;
  try {
    const result = await revokeFinoraSession(request);
    revocationConfirmed = result.confirmed;
  } catch {
    revocationConfirmed = false;
  }
  const response = NextResponse.json(
    !revocationConfirmed
      ? { loggedOut: false, revocationConfirmed: false, error: "Não foi possível confirmar o encerramento da sessão no servidor." }
      : { loggedOut: true, revocationConfirmed: true },
    { status: revocationConfirmed ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
  const secure = origin.startsWith("https://");
  const sameSite = secure ? "none" : "lax";
  response.cookies.set(APP_SESSION_COOKIE, "", { httpOnly: true, secure, sameSite, path: "/", maxAge: 0 });
  response.cookies.set(OAUTH_STATE_COOKIE, "", { httpOnly: true, secure, sameSite, path: "/api/auth/callback", maxAge: 0 });
  return response;
}
