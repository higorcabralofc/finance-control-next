import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import { getDatabasePool } from "@/lib/db";

export const APP_SESSION_COOKIE = "webdev_app_session";
export const OAUTH_STATE_COOKIE = "finora_oauth_nonce";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
const PUBLISHED_ORIGINS = new Set([
  "https://finora-6oy7ebm2.manus.space",
  "https://8328-ixx7u8gf8p4sbgl5eadpn-1dbe4ee9.us5.manus.computer",
]);

type SessionClaims = {
  appId?: unknown;
  openId?: unknown;
  exp?: unknown;
  iat?: unknown;
  kind?: unknown;
  sid?: unknown;
  name?: unknown;
  email?: unknown;
};

type AuthenticatedUser = {
  openId: string;
  accountKey: string;
  displayName: string;
  email: string | null;
  isPreviewSession: boolean;
  sessionId: string | null;
};

type UserRow = RowDataPacket & {
  open_id: string;
  display_name: string;
  email: string | null;
  active?: number;
};

function getProjectId(): string {
  const id = process.env.MANUS_PROJECT_ID;
  if (!id) throw new Error("A autenticação Manus não está configurada.");
  return id;
}

function getJwtSecret(): string {
  const secret = process.env.MANUS_JWT_SECRET;
  if (!secret) throw new Error("A assinatura de sessão Manus não está configurada.");
  return secret;
}

function encodeBase64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeBase64Url(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signJwt(claims: Record<string, unknown>): string {
  const unsigned = `${encodeBase64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }))}.${encodeBase64Url(JSON.stringify(claims))}`;
  const signature = createHmac("sha256", getJwtSecret()).update(unsigned).digest("base64url");
  return `${unsigned}.${signature}`;
}

function verifyJwt(token: string, allowExpired = false): SessionClaims | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const unsigned = `${parts[0]}.${parts[1]}`;
    const expected = createHmac("sha256", getJwtSecret()).update(unsigned).digest();
    const supplied = Buffer.from(parts[2], "base64url");
    if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;

    const header = JSON.parse(decodeBase64Url(parts[0])) as Record<string, unknown>;
    const claims = JSON.parse(decodeBase64Url(parts[1])) as SessionClaims;
    if (header.alg !== "HS256" || claims.appId !== getProjectId() || typeof claims.openId !== "string"
      || claims.openId.length < 1 || claims.openId.length > 191 || typeof claims.exp !== "number"
      || (!allowExpired && claims.exp <= Math.floor(Date.now() / 1000))) return null;
    return claims;
  } catch {
    return null;
  }
}

function accountKeyFor(openId: string): string {
  return createHmac("sha256", getJwtSecret()).update(`${getProjectId()}:${openId}`).digest("hex").slice(0, 32);
}

function cleanDisplayName(value: unknown): string {
  if (typeof value !== "string") return "Conta Manus";
  const result = value.trim().replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 160);
  return result || "Conta Manus";
}

function cleanEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const result = value.trim().replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 320);
  return result || null;
}

export function isAllowedAuthOrigin(origin: string): boolean {
  try {
    const parsed = new URL(origin);
    if (parsed.origin !== origin || parsed.username || parsed.password) return false;
    if (PUBLISHED_ORIGINS.has(parsed.origin)) return true;
    return process.env.NODE_ENV !== "production"
      && (parsed.origin === "http://localhost:3000" || parsed.origin === "http://127.0.0.1:3000");
  } catch {
    return false;
  }
}

export function getSessionTokenFromRequest(request: NextRequest): string | null {
  return request.cookies.get(APP_SESSION_COOKIE)?.value || null;
}

export async function upsertFinoraUser(openId: string, displayName: unknown, email: unknown): Promise<void> {
  await getDatabasePool().execute(
    `INSERT INTO finora_users (open_id, display_name, email)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE display_name = VALUES(display_name), email = VALUES(email), updated_at = CURRENT_TIMESTAMP(3)`,
    [openId, cleanDisplayName(displayName), cleanEmail(email)],
  );
}

export async function createFinoraSession(openId: string): Promise<{ token: string; maxAge: number }> {
  const sessionId = randomUUID();
  const nowSeconds = Math.floor(Date.now() / 1000);
  const expiresSeconds = nowSeconds + SESSION_TTL_SECONDS;
  await getDatabasePool().execute(
    "INSERT INTO finora_sessions (session_id, open_id, expires_at) VALUES (?, ?, ?)",
    [sessionId, openId, expiresSeconds],
  );
  const token = signJwt({ appId: getProjectId(), openId, sid: sessionId, kind: "finora", iat: nowSeconds, exp: expiresSeconds });
  return { token, maxAge: SESSION_TTL_SECONDS };
}

export async function getAuthenticatedUser(request: NextRequest): Promise<AuthenticatedUser | null> {
  const token = getSessionTokenFromRequest(request);
  if (!token) return null;
  const claims = verifyJwt(token);
  if (!claims || typeof claims.openId !== "string") return null;
  const openId = claims.openId;
  const pool = getDatabasePool();

  if (claims.kind === "finora") {
    if (typeof claims.sid !== "string") return null;
    const [rows] = await pool.execute<UserRow[]>(
      `SELECT u.open_id, u.display_name, u.email,
              (s.revoked_at IS NULL AND s.expires_at > ?) AS active
       FROM finora_sessions s
       INNER JOIN finora_users u ON u.open_id = s.open_id
       WHERE s.session_id = ? AND s.open_id = ? LIMIT 1`,
      [Math.floor(Date.now() / 1000), claims.sid, openId],
    );
    const row = rows[0];
    if (!row || Number(row.active) !== 1) return null;
    return {
      openId,
      accountKey: accountKeyFor(openId),
      displayName: cleanDisplayName(row.display_name),
      email: cleanEmail(row.email),
      isPreviewSession: false,
      sessionId: claims.sid,
    };
  }

  // Preview injects a platform-signed session using this same cookie contract.
  const displayName = cleanDisplayName(claims.name);
  const email = cleanEmail(claims.email);
  const [rows] = await pool.execute<UserRow[]>(
    "SELECT open_id, display_name, email FROM finora_users WHERE open_id = ? LIMIT 1",
    [openId],
  );
  if (rows[0]) {
    return {
      openId,
      accountKey: accountKeyFor(openId),
      displayName: cleanDisplayName(rows[0].display_name),
      email: cleanEmail(rows[0].email),
      isPreviewSession: true,
      sessionId: null,
    };
  }
  await upsertFinoraUser(openId, displayName, email);
  return { openId, accountKey: accountKeyFor(openId), displayName, email, isPreviewSession: true, sessionId: null };
}

type SessionRevocationResult =
  | { confirmed: true; reason: "revoked" | "already-revoked" }
  | { confirmed: false; reason: "missing-token" | "invalid-token" | "not-application-session" | "session-record-not-found" };

type RevocationRow = RowDataPacket & { revoked_at: Date | string | null };

export async function revokeFinoraSession(request: NextRequest): Promise<SessionRevocationResult> {
  const token = getSessionTokenFromRequest(request);
  if (!token) return { confirmed: false, reason: "missing-token" };
  const claims = verifyJwt(token, true);
  if (!claims || typeof claims.sid !== "string" || typeof claims.openId !== "string") return { confirmed: false, reason: "invalid-token" };
  if (claims.kind !== "finora") return { confirmed: false, reason: "not-application-session" };
  const sessionId = claims.sid;
  const openId = claims.openId;

  const pool = getDatabasePool();
  const [result] = await pool.execute<ResultSetHeader>(
    "UPDATE finora_sessions SET revoked_at = CURRENT_TIMESTAMP(3) WHERE session_id = ? AND open_id = ? AND revoked_at IS NULL",
    [sessionId, openId],
  );
  if (result.affectedRows > 0) return { confirmed: true, reason: "revoked" };

  const [rows] = await pool.execute<RevocationRow[]>(
    "SELECT revoked_at FROM finora_sessions WHERE session_id = ? AND open_id = ? LIMIT 1",
    [sessionId, openId],
  );
  if (rows[0]?.revoked_at) return { confirmed: true, reason: "already-revoked" };
  return { confirmed: false, reason: "session-record-not-found" };
}

export function oauthStateNonce(): string {
  return randomBytes(32).toString("base64url");
}

export function signOAuthState(redirectUri: string, nonce: string): string {
  return Buffer.from(JSON.stringify({ redirectUri, nonce }), "utf8").toString("base64");
}

export function parseOAuthState(state: string): { redirectUri: string; nonce: string } | null {
  try {
    const value = JSON.parse(Buffer.from(state, "base64").toString("utf8")) as Record<string, unknown>;
    if (typeof value.redirectUri !== "string" || typeof value.nonce !== "string") return null;
    return { redirectUri: value.redirectUri, nonce: value.nonce };
  } catch {
    return null;
  }
}
