import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import * as schema from "./schema";

// Neon serverless requires WebSocket
neonConfig.webSocketConstructor = ws;

function getConnectionString(): string {
  // Priority: env variable > shared compose
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  // Default: shared postgres from docker compose
  return "postgresql://postgres:postgres@localhost:5432/recruit_agent";
}

let pool: Pool;
let db: ReturnType<typeof drizzle>;

export function getDb() {
  if (db) return db;

  const connectionString = getConnectionString();
  // Check if it's a Neon connection
  if (connectionString.includes("neon.tech") || connectionString.includes("neon")) {
    pool = new Pool({ connectionString });
    db = drizzle(pool, { schema });
  } else {
    // Local Postgres - use standard drizzle
    const { drizzle: localDrizzle } = require("drizzle-orm/node-postgres");
    const { Pool: LocalPool } = require("pg");
    pool = new LocalPool({ connectionString });
    db = localDrizzle(pool, { schema });
  }
  return db;
}

export { schema };
