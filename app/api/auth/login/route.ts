import { NextRequest, NextResponse } from "next/server";
import { OAUTH_STATE_COOKIE, isAllowedAuthOrigin, oauthStateNonce, signOAuthState } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin") || "";
  if (!isAllowedAuthOrigin(origin)) {
    return NextResponse.json({ error: "Origem não permitida para autenticação." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }

  const projectId = process.env.MANUS_PROJECT_ID;
  const portal = process.env.MANUS_OAUTH_PORTAL_URL;
  if (!projectId || !portal) {
    return NextResponse.json({ error: "O login Manus ainda não está disponível." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }

  const redirectUri = `${origin}/api/auth/callback`;
  const nonce = oauthStateNonce();
  const state = signOAuthState(redirectUri, nonce);
  const authorizationUrl = new URL(`${portal.replace(/\/$/, "")}/app-auth`);
  authorizationUrl.search = new URLSearchParams({ appId: projectId, redirectUri, state, responseType: "code" }).toString();

  const response = NextResponse.json({ authorizationUrl: authorizationUrl.toString() }, { headers: { "Cache-Control": "no-store" } });
  const secure = origin.startsWith("https://");
  response.cookies.set(OAUTH_STATE_COOKIE, nonce, {
    httpOnly: true,
    secure,
    sameSite: secure ? "none" : "lax",
    path: "/api/auth/callback",
    maxAge: 300,
  });
  return response;
}
