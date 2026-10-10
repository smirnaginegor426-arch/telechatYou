import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import * as schema from "@db/schema";
import * as relations from "@db/relations";
import { env } from "../lib/env";

const fullSchema = { ...schema, ...relations };

function createDatabase() {
  const connectionPool = createPool();
  return drizzle(connectionPool, { mode: "default", schema: fullSchema });
}

type Database = ReturnType<typeof createDatabase>;
let instance: Database | undefined;

function createPool() {
  if (!env.databaseUrl) throw new Error("DATABASE_URL is missing; copy .env.example to .env and configure your MySQL/TiDB connection");
  const url = new URL(env.databaseUrl);
  if (url.protocol !== "mysql:" && url.protocol !== "mysql2:") throw new Error("DATABASE_URL must use the mysql:// scheme");
  const hostname = url.hostname;
  const isLocal = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  const sslParam = url.searchParams.get("ssl");
  const sslDisabled = sslParam === "false" || sslParam === "0";
  const ssl = isLocal || sslDisabled ? undefined : { rejectUnauthorized: true };
  return mysql.createPool({
    host: hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.replace(/^\//, "")),
    ssl,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });
}

export function getDb(): Database {
  if (!instance) {
    instance = createDatabase();
  }
  // The assignment above initializes the instance on the first call.
  if (!instance) throw new Error("Database initialization failed");
  return instance;
}
