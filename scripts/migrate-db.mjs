import mysql from "mysql2/promise";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const connectionUrl = process.env.DATABASE_URL || process.env.DRIZZLE_DATABASE_URL;
if (!connectionUrl) throw new Error("DATABASE_URL não está disponível para executar a migração.");

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const migrationsDirectory = path.resolve(scriptDirectory, "../migrations");
const migrationName = "001_finora_auth_and_finance.sql";
const version = migrationName.replace(/\.sql$/, "");
const migrationSql = await readFile(path.join(migrationsDirectory, migrationName), "utf8");
const connection = await mysql.createConnection(connectionUrl);

try {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS finora_schema_migrations (
      version VARCHAR(100) NOT NULL PRIMARY KEY,
      applied_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  const [existing] = await connection.execute("SELECT version FROM finora_schema_migrations WHERE version = ? LIMIT 1", [version]);
  if (Array.isArray(existing) && existing.length > 0) {
    console.log(`Migração ${version} já aplicada.`);
  } else {
    for (const statement of migrationSql.split(";").map((item) => item.trim()).filter(Boolean)) {
      await connection.query(statement);
    }
    await connection.execute("INSERT INTO finora_schema_migrations (version) VALUES (?)", [version]);
    console.log(`Migração ${version} aplicada.`);
  }
} finally {
  await connection.end();
}
