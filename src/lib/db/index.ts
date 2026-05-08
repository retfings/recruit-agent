import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

function getConnectionString(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  return "postgresql://postgres:postgres@localhost:5432/recruit_agent";
}

const pool = new Pool({
  connectionString: getConnectionString(),
  max: 10,
});

export const db = drizzle(pool, { schema });
export { schema };
