import pg, { type PoolClient, type QueryResultRow } from "pg"

pg.types.setTypeParser(1700, Number)
pg.types.setTypeParser(20, Number)
const globalDatabase = globalThis as typeof globalThis & { csolutionPool?: pg.Pool }
export const pool = globalDatabase.csolutionPool ?? new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  connectionTimeoutMillis: 5000
})
if (process.env.NODE_ENV !== "production") globalDatabase.csolutionPool = pool

export type Client = PoolClient

export async function rows<T extends QueryResultRow = QueryResultRow>(
  db: typeof pool | Client, sql: string, values: unknown[] = []
): Promise<T[]> {
  return (await db.query<T>(sql, values)).rows
}

export async function first<T extends QueryResultRow = QueryResultRow>(
  db: typeof pool | Client, sql: string, values: unknown[] = []
): Promise<T | undefined> {
  return (await rows<T>(db, sql, values))[0]
}

export async function transaction<T>(run: (db: Client) => Promise<T>): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    const result = await run(client)
    await client.query("COMMIT")
    return result
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}
