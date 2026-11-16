import { NextRequest, NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2/promise";
import { getAuthenticatedUser, isAllowedAuthOrigin, upsertFinoraUser } from "@/lib/auth";
import { getDatabasePool } from "@/lib/db";
import { emptyFinanceSnapshot, validateFinanceSnapshot, type FinanceSnapshot } from "@/lib/finance-snapshot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX_BODY_BYTES = 1_000_000;

type SnapshotRow = RowDataPacket & { revision: number | string; snapshot: FinanceSnapshot | string; updated_at: string | Date };

function noStoreJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store, max-age=0" } });
}

function accountMismatch() {
  return noStoreJson({ accountMismatch: true, error: "A conta ativa neste dispositivo mudou." }, 403);
}

function parseSnapshot(value: FinanceSnapshot | string): FinanceSnapshot | null {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) as unknown : value;
    return validateFinanceSnapshot(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return noStoreJson({ error: "É necessário entrar para acessar os dados." }, 401);
    if (request.headers.get("x-finora-account-key") !== user.accountKey) return accountMismatch();
    await upsertFinoraUser(user.openId, user.displayName, user.email);
    const [rows] = await getDatabasePool().execute<SnapshotRow[]>(
      "SELECT revision, snapshot, updated_at FROM finora_finance_snapshots WHERE open_id = ? LIMIT 1",
      [user.openId],
    );
    if (!rows[0]) return noStoreJson({ exists: false, revision: 0, snapshot: null, updatedAt: null });
    const snapshot = parseSnapshot(rows[0].snapshot);
    if (!snapshot) return noStoreJson({ error: "O conjunto financeiro salvo não passou na validação." }, 500);
    return noStoreJson({ exists: true, revision: Number(rows[0].revision), snapshot, updatedAt: rows[0].updated_at });
  } catch {
    return noStoreJson({ error: "Não foi possível carregar os dados financeiros." }, 503);
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!isAllowedAuthOrigin(request.headers.get("origin") || "")) {
      return noStoreJson({ error: "Origem não permitida para sincronização." }, 403);
    }
    const user = await getAuthenticatedUser(request);
    if (!user) return noStoreJson({ error: "É necessário entrar para sincronizar os dados." }, 401);
    if (request.headers.get("x-finora-account-key") !== user.accountKey) return accountMismatch();

    const contentLength = Number(request.headers.get("content-length") || "0");
    if (contentLength > MAX_BODY_BYTES) return noStoreJson({ error: "O conjunto financeiro excede o limite permitido." }, 413);
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).length > MAX_BODY_BYTES) return noStoreJson({ error: "O conjunto financeiro excede o limite permitido." }, 413);

    let body: unknown;
    try {
      body = JSON.parse(rawBody) as unknown;
    } catch {
      return noStoreJson({ error: "A solicitação de sincronização está inválida." }, 400);
    }
    if (typeof body !== "object" || body === null || Array.isArray(body)) return noStoreJson({ error: "A solicitação de sincronização está inválida." }, 400);
    const requestBody = body as Record<string, unknown>;
    const expectedRevision = requestBody.expectedRevision;
    const snapshot = requestBody.snapshot;
    if (typeof expectedRevision !== "number" || !Number.isInteger(expectedRevision) || expectedRevision < 0
      || !validateFinanceSnapshot(snapshot)) {
      return noStoreJson({ error: "Os dados não passaram na validação financeira." }, 400);
    }

    await upsertFinoraUser(user.openId, user.displayName, user.email);
    const connection = await getDatabasePool().getConnection();
    try {
      await connection.beginTransaction();
      await connection.execute("SELECT open_id FROM finora_users WHERE open_id = ? FOR UPDATE", [user.openId]);
      const [rows] = await connection.execute<SnapshotRow[]>(
        "SELECT revision, snapshot, updated_at FROM finora_finance_snapshots WHERE open_id = ? FOR UPDATE",
        [user.openId],
      );
      const current = rows[0];
      const currentRevision = current ? Number(current.revision) : 0;
      if (currentRevision !== expectedRevision) {
        await connection.rollback();
        return noStoreJson({
          conflict: true,
          revision: currentRevision,
          snapshot: current ? parseSnapshot(current.snapshot) : emptyFinanceSnapshot(),
        }, 409);
      }

      const nextRevision = currentRevision + 1;
      const serializedSnapshot = JSON.stringify(snapshot);
      if (current) {
        await connection.execute(
          "UPDATE finora_finance_snapshots SET revision = ?, snapshot = ?, updated_at = UTC_TIMESTAMP(3) WHERE open_id = ? AND revision = ?",
          [nextRevision, serializedSnapshot, user.openId, currentRevision],
        );
      } else {
        await connection.execute(
          "INSERT INTO finora_finance_snapshots (open_id, revision, snapshot, updated_at) VALUES (?, ?, ?, UTC_TIMESTAMP(3))",
          [user.openId, nextRevision, serializedSnapshot],
        );
      }
      await connection.commit();
      return noStoreJson({ saved: true, revision: nextRevision, updatedAt: new Date().toISOString() });
    } catch {
      await connection.rollback();
      return noStoreJson({ error: "Não foi possível gravar a sincronização." }, 503);
    } finally {
      connection.release();
    }
  } catch {
    return noStoreJson({ error: "Não foi possível validar a sessão para sincronização." }, 503);
  }
}
