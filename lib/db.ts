import { createPool, type Pool } from "mysql2/promise";

declare global {
  // eslint-disable-next-line no-var
  var finoraDatabasePool: Pool | undefined;
}

export function getDatabasePool(): Pool {
  if (globalThis.finoraDatabasePool) return globalThis.finoraDatabasePool;

  const connectionUrl = process.env.DATABASE_URL || process.env.DRIZZLE_DATABASE_URL;
  if (!connectionUrl) throw new Error("O banco do Finora não está configurado.");

  globalThis.finoraDatabasePool = createPool(connectionUrl);
  return globalThis.finoraDatabasePool;
}
