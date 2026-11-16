import { NextRequest, NextResponse } from "next/server";
import {
  APP_SESSION_COOKIE,
  OAUTH_STATE_COOKIE,
  createFinoraSession,
  isAllowedAuthOrigin,
  parseOAuthState,
  upsertFinoraUser,
} from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clearStateCookie(response: NextResponse, origin: string) {
  const secure = origin.startsWith("https://");
  response.cookies.set(OAUTH_STATE_COOKIE, "", {
    httpOnly: true,
    secure,
    sameSite: secure ? "none" : "lax",
    path: "/api/auth/callback",
    maxAge: 0,
  });
}

function returnToLogin(origin: string) {
  const response = NextResponse.redirect(new URL("/?auth_error=1", origin));
  clearStateCookie(response, origin);
  return response;
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const stateValue = requestUrl.searchParams.get("state");
  const nonceCookie = request.cookies.get(OAUTH_STATE_COOKIE)?.value;
  const state = stateValue ? parseOAuthState(stateValue) : null;

  if (!state) {
    return NextResponse.json({ error: "O retorno de autenticação é inválido." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  let callbackUrl: URL;
  try {
    callbackUrl = new URL(state.redirectUri);
  } catch {
    return NextResponse.json({ error: "O retorno de autenticação é inválido." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  const origin = callbackUrl.origin;
  const expectedRedirectUri = `${origin}/api/auth/callback`;
  if (!isAllowedAuthOrigin(origin) || callbackUrl.username || callbackUrl.password
    || callbackUrl.pathname !== "/api/auth/callback" || callbackUrl.search || callbackUrl.hash
    || state.redirectUri !== expectedRedirectUri) {
    return NextResponse.json({ error: "Origem não permitida para autenticação." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  if (!code || !nonceCookie || state.nonce !== nonceCookie) return returnToLogin(origin);

  const projectId = process.env.MANUS_PROJECT_ID;
  const oauthApi = process.env.MANUS_OAUTH_API_URL;
  if (!projectId || !oauthApi) return returnToLogin(origin);

  try {
    const apiBase = oauthApi.replace(/\/$/, "");
    const exchangeResponse = await fetch(`${apiBase}/webdev.v1.WebDevAuthPublicService/ExchangeToken`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ clientId: projectId, grantType: "authorization_code", code, redirectUri: expectedRedirectUri }),
    });
    const exchange = await exchangeResponse.json() as Record<string, unknown>;
    if (!exchangeResponse.ok || exchange.error || typeof exchange.accessToken !== "string" || !exchange.accessToken) {
      return returnToLogin(origin);
    }

    const identityResponse = await fetch(`${apiBase}/webdev.v1.WebDevAuthPublicService/GetUserInfo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ accessToken: exchange.accessToken }),
    });
    const identity = await identityResponse.json() as Record<string, unknown>;
    if (!identityResponse.ok || identity.error || typeof identity.openId !== "string"
      || identity.openId.length < 1 || identity.openId.length > 191) {
      return returnToLogin(origin);
    }

    const name = typeof identity.name === "string" ? identity.name : "Conta Manus";
    const email = typeof identity.email === "string" ? identity.email : null;
    await upsertFinoraUser(identity.openId, name, email);
    const session = await createFinoraSession(identity.openId);
    const response = NextResponse.redirect(new URL("/", origin));
    clearStateCookie(response, origin);
    const secure = origin.startsWith("https://");
    response.cookies.set(APP_SESSION_COOKIE, session.token, {
      httpOnly: true,
      secure,
      sameSite: secure ? "none" : "lax",
      path: "/",
      maxAge: session.maxAge,
    });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch {
    return returnToLogin(origin);
  }
}
